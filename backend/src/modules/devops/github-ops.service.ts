import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, createHash } from 'crypto';
import { request as httpsRequest } from 'https';
import { gunzipSync } from 'zlib';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GithubDiffDto } from './dto/github-diff.dto';
import { ApplyPrDto } from './dto/apply-pr.dto';
import { ActionsDebugDto } from './dto/actions-debug.dto';
import { RepoMemoryService } from './repo-memory.service';

type GithubFileInput = { path: string; content: string };

@Injectable()
export class GithubOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly repoMemory: RepoMemoryService,
  ) {}

  async diffAgainstRepo(userId: string, dto: GithubDiffDto) {
    const token = await this.requireGithubToken(userId);
    const { owner, repo, repoUrl } = this.repoMemory.parseGithubRepo(dto.repoUrl);
    const branch = dto.branch?.trim() || 'main';

    const files: Array<{
      path: string;
      status: 'added' | 'modified' | 'unchanged';
      before: string;
      after: string;
      beforeSha: string | null;
      beforeLines: number;
      afterLines: number;
      hunks: string[];
    }> = [];

    for (const file of dto.files) {
      const normalizedPath = this.normalizePath(file.path);
      const remote = await this.getFileContent(owner, repo, normalizedPath, branch, token);
      const before = remote?.content ?? '';
      const after = file.content.replace(/\r\n/g, '\n');
      const status: 'added' | 'modified' | 'unchanged' =
        before === ''
          ? 'added'
          : before === after
            ? 'unchanged'
            : 'modified';

      files.push({
        path: normalizedPath,
        status,
        before,
        after,
        beforeSha: remote?.sha ?? null,
        beforeLines: before ? before.split('\n').length : 0,
        afterLines: after.split('\n').length,
        hunks: this.buildUnifiedDiff(normalizedPath, before, after).slice(0, 80),
      });
    }

    const summary = {
      added: files.filter((f) => f.status === 'added').length,
      modified: files.filter((f) => f.status === 'modified').length,
      unchanged: files.filter((f) => f.status === 'unchanged').length,
    };

    await this.repoMemory.recordEvent(
      userId,
      repoUrl,
      'diff',
      `Compared ${files.length} file(s) against ${owner}/${repo}@${branch}`,
      { summary, paths: files.map((f) => ({ path: f.path, status: f.status })) },
      { branch },
    );

    return { repoUrl, branch, summary, files };
  }

  async applyPullRequest(userId: string, dto: ApplyPrDto) {
    const token = await this.requireGithubToken(userId);
    const { owner, repo, repoUrl } = this.repoMemory.parseGithubRepo(dto.repoUrl);
    const baseBranch = dto.baseBranch?.trim() || 'main';
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const headBranch = (dto.headBranch?.trim() || `devmat/${stamp}`).replace(/\s+/g, '-');
    const files = dto.files.map((f) => ({
      path: this.normalizePath(f.path),
      content: f.content.replace(/\r\n/g, '\n'),
    }));

    if (files.length === 0) {
      throw new BadRequestException('Select at least one file to apply');
    }

    const baseRef = await this.githubJson<{ object: { sha: string } }>(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
      token,
    );
    const baseSha = baseRef.object.sha;
    const baseCommit = await this.githubJson<{ tree: { sha: string }; sha: string }>(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${baseSha}`,
      token,
    );

    const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
    for (const file of files) {
      const blob = await this.githubJson<{ sha: string }>(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        token,
        'POST',
        {
          content: Buffer.from(file.content, 'utf8').toString('base64'),
          encoding: 'base64',
        },
      );
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }

    const tree = await this.githubJson<{ sha: string }>(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      token,
      'POST',
      {
        base_tree: baseCommit.tree.sha,
        tree: treeItems,
      },
    );

    const commit = await this.githubJson<{ sha: string; html_url?: string }>(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      token,
      'POST',
      {
        message: dto.title?.trim() || `chore: apply DevMat AI generated configs`,
        tree: tree.sha,
        parents: [baseSha],
      },
    );

    // Create or update branch ref
    try {
      await this.githubJson(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        token,
        'POST',
        {
          ref: `refs/heads/${headBranch}`,
          sha: commit.sha,
        },
      );
    } catch {
      await this.githubJson(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(headBranch)}`,
        token,
        'PATCH',
        { sha: commit.sha, force: true },
      );
    }

    const title = dto.title?.trim() || `DevMat AI: update infrastructure & CI/CD`;
    const body =
      dto.body?.trim() ||
      [
        '## Summary',
        'This pull request was created by **DevMat AI**.',
        '',
        '### Files',
        ...files.map((f) => `- \`${f.path}\``),
        '',
        'Please review diffs carefully before merging.',
      ].join('\n');

    let pull: { number: number; html_url: string; state: string };
    try {
      pull = await this.githubJson<{ number: number; html_url: string; state: string }>(
        `https://api.github.com/repos/${owner}/${repo}/pulls`,
        token,
        'POST',
        {
          title,
          head: headBranch,
          base: baseBranch,
          body,
        },
      );
    } catch (error) {
      // If PR already exists for this head/base, locate it.
      const existing = await this.githubJson<Array<{ number: number; html_url: string; state: string }>>(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${headBranch}`)}`,
        token,
      );
      if (!existing[0]) throw error;
      pull = existing[0];
    }

    await this.repoMemory.recordEvent(
      userId,
      repoUrl,
      'pr',
      `Opened PR #${pull.number} on ${owner}/${repo}`,
      {
        prUrl: pull.html_url,
        prNumber: pull.number,
        headBranch,
        baseBranch,
        files: files.map((f) => f.path),
        versionId: dto.versionId ?? null,
      },
      {
        branch: baseBranch,
        lastVersionId: dto.versionId,
        lastPrUrl: pull.html_url,
        lastPrNumber: pull.number,
      },
    );

    return {
      repoUrl,
      baseBranch,
      headBranch,
      commitSha: commit.sha,
      prNumber: pull.number,
      prUrl: pull.html_url,
      files: files.map((f) => f.path),
    };
  }

  async listActionRuns(userId: string, repoUrl: string, branch?: string, limit = 10) {
    const token = await this.requireGithubToken(userId);
    const { owner, repo } = this.repoMemory.parseGithubRepo(repoUrl);
    const perPage = Math.min(Math.max(limit || 10, 1), 30);
    const query = new URLSearchParams({
      per_page: String(perPage),
      ...(branch ? { branch } : {}),
    });

    const result = await this.githubJson<{
      workflow_runs: Array<{
        id: number;
        name: string;
        status: string;
        conclusion: string | null;
        html_url: string;
        head_branch: string;
        event: string;
        created_at: string;
        updated_at: string;
        display_title?: string;
      }>;
    }>(`https://api.github.com/repos/${owner}/${repo}/actions/runs?${query.toString()}`, token);

    return {
      runs: (result.workflow_runs || []).map((run) => ({
        id: String(run.id),
        name: run.name,
        title: run.display_title || run.name,
        status: run.status,
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
        headBranch: run.head_branch,
        event: run.event,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      })),
    };
  }

  async debugLatestAction(userId: string, dto: ActionsDebugDto) {
    const token = await this.requireGithubToken(userId);
    const { owner, repo, repoUrl } = this.repoMemory.parseGithubRepo(dto.repoUrl);
    const branch = dto.branch?.trim();

    let runId = dto.runId?.trim();
    let runMeta: {
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      head_branch: string;
      display_title?: string;
    } | null = null;

    if (!runId) {
      const listed = await this.listActionRuns(userId, repoUrl, branch, 15);
      const failed =
        listed.runs.find((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'cancelled') ||
        listed.runs[0];
      if (!failed) {
        throw new BadRequestException('No GitHub Actions runs found for this repository');
      }
      runId = failed.id;
      runMeta = {
        id: Number(failed.id),
        name: failed.name,
        status: failed.status,
        conclusion: failed.conclusion,
        html_url: failed.htmlUrl,
        head_branch: failed.headBranch,
        display_title: failed.title,
      };
    } else {
      runMeta = await this.githubJson(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
        token,
      );
    }

    const jobs = await this.githubJson<{
      jobs: Array<{
        id: number;
        name: string;
        conclusion: string | null;
        status: string;
        html_url: string;
      }>;
    }>(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, token);

    const failedJob =
      jobs.jobs.find((j) => j.conclusion === 'failure' || j.conclusion === 'timed_out') ||
      jobs.jobs[0];

    if (!failedJob) {
      throw new BadRequestException('No jobs found for the selected workflow run');
    }

    const logText = await this.fetchJobLogs(owner, repo, failedJob.id, token);
    const clipped = logText.slice(-14000);
    const diagnosis = await this.aiService.debugError(
      [
        `GitHub Actions run diagnosis`,
        `Repository: ${owner}/${repo}`,
        `Run: ${runMeta?.display_title || runMeta?.name || runId}`,
        `Branch: ${runMeta?.head_branch || branch || 'unknown'}`,
        `Job: ${failedJob.name}`,
        `Conclusion: ${failedJob.conclusion || failedJob.status}`,
        '',
        '---- LOG TAIL ----',
        clipped,
      ].join('\n'),
    );

    await this.repoMemory.recordEvent(
      userId,
      repoUrl,
      'actions_debug',
      `Debugged Actions run ${runId} (${failedJob.name})`,
      {
        runId,
        jobId: failedJob.id,
        conclusion: failedJob.conclusion,
        diagnosis,
      },
      {
        branch: runMeta?.head_branch || branch,
        lastActionsRunId: String(runId),
        lastActionsStatus: runMeta?.conclusion || runMeta?.status || failedJob.conclusion || failedJob.status,
      },
    );

    return {
      repoUrl,
      run: {
        id: String(runId),
        name: runMeta?.name,
        title: runMeta?.display_title || runMeta?.name,
        status: runMeta?.status,
        conclusion: runMeta?.conclusion,
        htmlUrl: runMeta?.html_url,
        headBranch: runMeta?.head_branch,
      },
      job: {
        id: String(failedJob.id),
        name: failedJob.name,
        status: failedJob.status,
        conclusion: failedJob.conclusion,
        htmlUrl: failedJob.html_url,
      },
      logExcerpt: clipped.slice(-4000),
      diagnosis,
    };
  }

  private async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch: string,
    token: string,
  ): Promise<{ content: string; sha: string } | null> {
    try {
      const data = await this.githubJson<{
        type: string;
        encoding?: string;
        content?: string;
        sha: string;
      }>(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
        token,
      );

      if (data.type !== 'file' || !data.content) {
        return null;
      }

      const decoded =
        data.encoding === 'base64'
          ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8')
          : data.content;

      return { content: decoded.replace(/\r\n/g, '\n'), sha: data.sha };
    } catch (error) {
      if (error instanceof BadRequestException && /404|Not Found/i.test(error.message)) {
        return null;
      }
      throw error;
    }
  }

  private async fetchJobLogs(owner: string, repo: string, jobId: number, token: string): Promise<string> {
    const raw = await this.githubRaw(
      `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
      token,
    );

    try {
      return gunzipSync(raw).toString('utf8');
    } catch {
      return raw.toString('utf8');
    }
  }

  private buildUnifiedDiff(path: string, before: string, after: string): string[] {
    if (before === after) {
      return [`--- a/${path}`, `+++ b/${path}`, '@@ unchanged @@'];
    }

    const beforeLines = before === '' ? [] : before.split('\n');
    const afterLines = after === '' ? [] : after.split('\n');
    const hunks: string[] = [`--- a/${path}`, `+++ b/${path}`, `@@ -1,${beforeLines.length || 0} +1,${afterLines.length || 0} @@`];

    const max = Math.max(beforeLines.length, afterLines.length);
    for (let i = 0; i < max; i += 1) {
      const left = beforeLines[i];
      const right = afterLines[i];
      if (left === right) {
        if (left !== undefined) hunks.push(` ${left}`);
        continue;
      }
      if (left !== undefined) hunks.push(`-${left}`);
      if (right !== undefined) hunks.push(`+${right}`);
    }

    return hunks;
  }

  private normalizePath(path: string) {
    return path.replace(/\\/g, '/').replace(/^\.?\//, '').trim();
  }

  private async requireGithubToken(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { githubTokenEnc: true },
    });

    if (!user?.githubTokenEnc) {
      throw new UnauthorizedException('Connect GitHub first to use this feature');
    }

    const token = this.decryptToken(user.githubTokenEnc);
    if (!token) {
      throw new UnauthorizedException('GitHub token is invalid. Reconnect GitHub.');
    }

    return token;
  }

  private tokenCryptoKey() {
    const secret = this.configService.getOrThrow<string>('jwtSecret', { infer: true });
    return createHash('sha256').update(secret).digest();
  }

  private decryptToken(payload: string): string | undefined {
    try {
      const [ivB64, tagB64, cipherB64] = payload.split('.');
      if (!ivB64 || !tagB64 || !cipherB64) return undefined;
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.tokenCryptoKey(),
        Buffer.from(ivB64, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(cipherB64, 'base64url')),
        decipher.final(),
      ]).toString('utf-8');
    } catch {
      return undefined;
    }
  }

  private githubJson<T>(
    url: string,
    token: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = httpsRequest(
        url,
        {
          method,
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'DevMat-AI',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(payload
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode && res.statusCode >= 400) {
              let detail = raw;
              try {
                detail = (JSON.parse(raw) as { message?: string }).message || raw;
              } catch {
                // keep raw
              }
              reject(new BadRequestException(`GitHub API ${method} failed (${res.statusCode}): ${detail}`));
              return;
            }

            if (!raw) {
              resolve({} as T);
              return;
            }

            try {
              resolve(JSON.parse(raw) as T);
            } catch {
              reject(new BadRequestException('Invalid JSON from GitHub API'));
            }
          });
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  private githubRaw(url: string, token: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'DevMat-AI',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
        (res) => {
          // Follow one redirect (GitHub logs endpoint redirects to a short-lived URL)
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            this.githubRaw(res.headers.location, token).then(resolve).catch(reject);
            res.resume();
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new BadRequestException(`GitHub log download failed (${res.statusCode})`));
              return;
            }
            resolve(buf);
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  }
}

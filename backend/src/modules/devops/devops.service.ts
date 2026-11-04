import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AnalyzePackageDto } from './dto/analyze-package.dto';
import { GenerateInfraDto } from './dto/generate-infra.dto';
import { ImproveConfigDto } from './dto/improve-config.dto';
import { LogAnalyzerDto } from './dto/log-analyzer.dto';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';
import { ChatRole, CloudTarget, FileKind, Project, SourceType } from '@prisma/client';
import { request as httpsRequest } from 'https';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { posix as pathPosix } from 'path';
import { OnboardRepoDto } from './dto/onboard-repo.dto';
import { RepoMemoryService } from './repo-memory.service';

export type DetectedService = {
  name: string;
  kind: 'frontend' | 'backend' | 'database' | 'worker' | 'unknown';
  framework?: string;
  language?: string;
  portHint?: number;
  envHints?: string[];
};

export type AnalysisResult = {
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  services: DetectedService[];
  dependencies: string[];
  devDependencies: string[];
  notes?: string[];
};

export type InfraBundle = {
  files: { path: string; content: string; kind: FileKind }[];
  costEstimate: string;
  securityFindings: string;
};

type HealthStatus = 'pass' | 'warn';

type RepoHealthCheck = {
  id: string;
  title: string;
  status: HealthStatus;
  details: string;
  fix: string;
};

type SecretRisk = {
  severity: 'low' | 'medium' | 'high';
  path: string;
  finding: string;
  recommendation: string;
};

type GithubRepoListItem = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  updatedAt: string;
  language: string | null;
};

type RepoPackageDescriptor = {
  path: string;
  packageJson: Record<string, any>;
};

type RepoAnalysisContext = {
  rootEntries: string[];
  repoPaths: string[];
  packageFiles: RepoPackageDescriptor[];
  existingConfig: string;
  promptContext: string;
  summary: string;
};

@Injectable()
export class DevopsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly repoMemory: RepoMemoryService,
  ) {}

  async analyzePackage(userId: string, dto: AnalyzePackageDto) {
    const pkg = this.parsePackageJson(dto.packageJson);
    const analysis = this.detectStack(pkg);

    const project = await this.prisma.project.create({
      data: {
        userId,
        name: dto.projectName || pkg.name || 'project',
        repoUrl: dto.repoUrl,
        sourceType: dto.sourceType ?? SourceType.packageJson,
        cloudTarget: dto.cloudTarget,
        summary: pkg.description,
        detectedStack: analysis,
        versions: {
          create: {
            label: 'analysis-1',
            cloudTarget: dto.cloudTarget,
            analysis,
          },
        },
      },
      include: {
        versions: true,
      },
    });

    return {
      project,
      analysis,
      versionId: project.versions[0].id,
    };
  }

  async analyzeRepo(userId: string, dto: AnalyzeRepoDto) {
    const usingProvidedToken = Boolean(dto.githubToken);
    const token = dto.githubToken || (await this.getStoredGithubToken(userId));
    const branch = dto.branch ?? 'main';
    let repoContext: RepoAnalysisContext;

    try {
      repoContext = await this.buildRepoAnalysisContext(
        dto.repoUrl,
        branch,
        token,
      );
    } catch (err) {
      if (this.isGithubUnauthorizedError(err)) {
        if (usingProvidedToken) {
          throw new BadRequestException('GitHub token is invalid or expired. Reconnect GitHub and try again.');
        }

        await this.clearStoredGithubConnection(userId);

        try {
          repoContext = await this.buildRepoAnalysisContext(
            dto.repoUrl,
            branch,
          );
        } catch {
          throw new BadRequestException('Stored GitHub connection expired or was revoked. Reconnect GitHub and try again.');
        }
      } else {
        throw err;
      }
    }

    const projectName = dto.projectName ?? this.nameFromRepo(dto.repoUrl);
    const analysis = this.detectStack(this.mergeRepoPackagesToPseudoPackage(projectName, repoContext.packageFiles));

    const project = await this.prisma.project.create({
      data: {
        userId,
        name: projectName,
        repoUrl: dto.repoUrl,
        sourceType: dto.sourceType ?? SourceType.github,
        cloudTarget: dto.cloudTarget,
        summary: repoContext.summary,
        detectedStack: analysis,
        versions: {
          create: {
            label: 'analysis-1',
            cloudTarget: dto.cloudTarget,
            analysis,
          },
        },
      },
      include: {
        versions: true,
      },
    });

    try {
      await this.repoMemory.recordEvent(
        userId,
        dto.repoUrl,
        'analysis',
        `Analyzed ${projectName} on ${branch}`,
        { versionId: project.versions[0].id, services: analysis.services },
        {
          branch,
          cloudTarget: dto.cloudTarget,
          analysis: analysis as unknown as Record<string, unknown>,
          lastVersionId: project.versions[0].id,
        },
      );
    } catch {
      // Memory must never block analysis.
    }

    return {
      project,
      analysis,
      versionId: project.versions[0].id,
      repoContext,
    };
  }

  async onboardRepo(userId: string, dto: OnboardRepoDto) {
    const repoAnalysis = await this.analyzeRepo(userId, {
      repoUrl: dto.repoUrl,
      branch: dto.branch,
      githubToken: dto.githubToken,
      projectName: dto.projectName,
      cloudTarget: dto.cloudTarget,
      sourceType: SourceType.github,
    });

    const { owner, repo } = this.parseGithubRepo(dto.repoUrl);
    const token = dto.githubToken || (await this.getStoredGithubToken(userId));
    const branch = dto.branch || 'main';
    const [repoMeta, repoLanguages, treePaths] = await Promise.all([
      this.fetchGithubRepoMeta(owner, repo, token),
      this.fetchGithubLanguages(owner, repo, token),
      this.fetchGithubTreePaths(owner, repo, branch, token),
    ]);

    const rootEntries = await this.fetchGithubRootEntries(owner, repo, branch, token);
    const repoPaths = treePaths.length > 0 ? treePaths : rootEntries;

    const checks = this.buildRepoHealthChecks(repoAnalysis.analysis, repoPaths);
    const healthScore = this.computeHealthScore(checks);
    const recommendations = checks.filter((check) => check.status === 'warn').map((check) => check.fix);

    const explainResult = await this.aiService.generateCicd({
      actionType: 'explain',
      projectDescription: repoMeta.description || repoAnalysis.project.name,
      stackInfo: this.describeStack(repoAnalysis.analysis),
      cloudProvider: (dto.cloudTarget || CloudTarget.local).toString(),
      userRequest: [
        'Provide practical DevOps hardening and rollout guidance for this repository.',
        `Detected warnings: ${recommendations.join('; ') || 'none'}`,
      ].join('\n'),
    });

    let generatedInfra: { versionId: string; files: any[]; costEstimate: string; securityFindings: string } | null = null;
    if (dto.autoGenerateInfra ?? true) {
      generatedInfra = await this.generateInfra(userId, {
        projectId: repoAnalysis.project.id,
        cloudTarget: dto.cloudTarget ?? CloudTarget.local,
        actionType: 'generate',
        label: `auto-onboard-${new Date().toISOString()}`,
      });
    }

    return {
      project: repoAnalysis.project,
      analysis: repoAnalysis.analysis,
      versionId: repoAnalysis.versionId,
      repoInsights: {
        owner,
        repo,
        defaultBranch: repoMeta.default_branch,
        stars: repoMeta.stargazers_count,
        openIssues: repoMeta.open_issues_count,
        languages: Object.keys(repoLanguages),
        hasCi: this.hasEntry(repoPaths, ['.github/workflows', '.github']),
        hasDocker: this.hasEntry(repoPaths, ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']),
        hasKubernetes: this.hasEntry(repoPaths, ['k8s', 'kubernetes', 'helm', '.yaml', '.yml']),
        hasTerraform: this.hasEntry(repoPaths, ['terraform', '.tf']),
        healthScore,
        checks,
      },
      autoFixPlan: recommendations,
      rolloutGuidance: explainResult.explanation,
      generatedInfra,
    };
  }

  async scanRepoReadiness(userId: string, dto: AnalyzeRepoDto) {
    const usingProvidedToken = Boolean(dto.githubToken);
    const branch = dto.branch ?? 'main';
    let token = dto.githubToken || (await this.getStoredGithubToken(userId));

    try {
      const { owner, repo } = this.parseGithubRepo(dto.repoUrl);
      const [treePaths, rootEntries, packageFiles] = await Promise.all([
        this.fetchGithubTreePaths(owner, repo, branch, token),
        this.fetchGithubRootEntries(owner, repo, branch, token),
        this.fetchRepoPackageDescriptors(owner, repo, branch, token),
      ]);

      const repoPaths = treePaths.length > 0 ? treePaths : rootEntries;
      const projectName = dto.projectName ?? this.nameFromRepo(dto.repoUrl);
      const analysis = this.detectStack(
        this.mergeRepoPackagesToPseudoPackage(projectName, packageFiles),
      );
      const checks = this.buildRepoHealthChecks(analysis, repoPaths);
      const secretRisks = this.detectSecretRisks(repoPaths);

      const baseScore = this.computeHealthScore(checks);
      const penalty = Math.min(secretRisks.length * 8, 32);
      const readinessScore = Math.max(0, baseScore - penalty);
      const readinessResult = {
        analysis,
        readinessScore,
        maturity: this.readinessBand(readinessScore),
        checks,
        secretRisks,
      };

      try {
        await this.repoMemory.recordEvent(
          userId,
          dto.repoUrl,
          'readiness',
          `Readiness score ${readinessScore}/100 (${readinessResult.maturity})`,
          readinessResult as unknown as Record<string, unknown>,
          {
            branch,
            analysis: analysis as unknown as Record<string, unknown>,
            readiness: readinessResult as unknown as Record<string, unknown>,
          },
        );
      } catch {
        // Memory must never block readiness.
      }

      return readinessResult;
    } catch (err) {
      if (this.isGithubUnauthorizedError(err)) {
        if (usingProvidedToken) {
          throw new BadRequestException(
            'GitHub token is invalid or expired. Reconnect GitHub and try again.',
          );
        }

        await this.clearStoredGithubConnection(userId);
        token = undefined;

        const { owner, repo } = this.parseGithubRepo(dto.repoUrl);
        const [treePaths, rootEntries, packageFiles] = await Promise.all([
          this.fetchGithubTreePaths(owner, repo, branch),
          this.fetchGithubRootEntries(owner, repo, branch),
          this.fetchRepoPackageDescriptors(owner, repo, branch),
        ]);

        const repoPaths = treePaths.length > 0 ? treePaths : rootEntries;
        const projectName = dto.projectName ?? this.nameFromRepo(dto.repoUrl);
        const analysis = this.detectStack(
          this.mergeRepoPackagesToPseudoPackage(projectName, packageFiles),
        );
        const checks = this.buildRepoHealthChecks(analysis, repoPaths);
        const secretRisks = this.detectSecretRisks(repoPaths);
        const baseScore = this.computeHealthScore(checks);
        const penalty = Math.min(secretRisks.length * 8, 32);
        const readinessScore = Math.max(0, baseScore - penalty);

        return {
          analysis,
          readinessScore,
          maturity: this.readinessBand(readinessScore),
          checks,
          secretRisks,
        };
      }

      throw err;
    }
  }

  async connectGithub(userId: string, accessToken: string) {
    const profile = await this.fetchGithubProfile(accessToken);
    const now = new Date();

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        githubUsername: profile.login,
        githubAvatarUrl: profile.avatar_url ?? null,
        githubTokenEnc: this.encryptToken(accessToken),
        githubConnectedAt: now,
      },
    });

    return {
      connected: true,
      username: updated.githubUsername,
      avatarUrl: updated.githubAvatarUrl,
      connectedAt: updated.githubConnectedAt?.toISOString() ?? null,
    };
  }

  async disconnectGithub(userId: string) {
    await this.clearStoredGithubConnection(userId);
    return { disconnected: true };
  }

  async getGithubStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        githubUsername: true,
        githubAvatarUrl: true,
        githubConnectedAt: true,
        githubTokenEnc: true,
      },
    });

    const connected = !!user?.githubTokenEnc;
    return {
      connected,
      username: connected ? user?.githubUsername ?? null : null,
      avatarUrl: connected ? user?.githubAvatarUrl ?? null : null,
      connectedAt: connected ? user?.githubConnectedAt?.toISOString() ?? null : null,
    };
  }

  async listGithubRepos(userId: string, limit = 15) {
    const token = await this.getStoredGithubToken(userId);
    if (!token) {
      throw new BadRequestException('GitHub is not connected. Connect GitHub first to list repositories.');
    }

    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 15;

    try {
      const repos = await this.fetchGithubJson<Array<{
        id: number;
        name: string;
        full_name: string;
        private: boolean;
        html_url: string;
        default_branch: string;
        updated_at: string;
        language: string | null;
      }>>(`https://api.github.com/user/repos?sort=updated&per_page=${safeLimit}`, token);

      return {
        repos: repos.map((repo) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          htmlUrl: repo.html_url,
          defaultBranch: repo.default_branch || 'main',
          updatedAt: repo.updated_at,
          language: repo.language ?? null,
        })),
      };
    } catch (err) {
      if (this.isGithubUnauthorizedError(err)) {
        await this.clearStoredGithubConnection(userId);
        throw new BadRequestException('GitHub token expired or revoked. Please reconnect GitHub.');
      }

      throw err;
    }
  }

  async getGithubOauthUrl(userId: string, redirectPath?: string) {
    const { clientId, redirectUri, scope } = this.githubConfig();
    const safeRedirectPath = redirectPath && redirectPath.startsWith('/') ? redirectPath : '/devops';

    const state = await this.jwtService.signAsync(
      { sub: userId, redirectPath: safeRedirectPath },
      { expiresIn: '10m' },
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      allow_signup: 'true',
    });

    return { url: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }

  async handleGithubOauthCallback(code?: string, state?: string) {
    const frontendUrl = this.configService.getOrThrow<string>('frontendUrl', { infer: true }).replace(/\/$/, '');
    const fallback = `${frontendUrl}/devops?github=error`;

    if (!code || !state) {
      return { redirectTo: `${fallback}&reason=missing_code_or_state` };
    }

    let payload: { sub: string; redirectPath?: string | null };
    try {
      payload = await this.jwtService.verifyAsync(state);
    } catch {
      return { redirectTo: `${fallback}&reason=invalid_state` };
    }

    let accessToken: string;
    try {
      accessToken = await this.exchangeGithubCodeForToken(code);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'token_exchange_failed';
      return { redirectTo: `${fallback}&reason=${encodeURIComponent(reason)}` };
    }

    const status = await this.connectGithub(payload.sub, accessToken);
    const redirectPath = payload.redirectPath || '/devops';
    return {
      redirectTo: `${frontendUrl}${redirectPath}?github=connected&username=${encodeURIComponent(status.username || '')}`,
    };
  }

  async generateInfra(userId: string, dto: GenerateInfraDto) {
    let project: Project;
    let analysis: AnalysisResult;
    let repoContext: RepoAnalysisContext | undefined;

    if (dto.repoUrl) {
      const repoAnalysis = await this.analyzeRepo(userId, {
        repoUrl: dto.repoUrl,
        branch: dto.branch,
        githubToken: dto.githubToken,
        cloudTarget: dto.cloudTarget,
      });
      project = repoAnalysis.project as Project;
      analysis = repoAnalysis.analysis as AnalysisResult;
      repoContext = (repoAnalysis as any).repoContext as RepoAnalysisContext | undefined;
    } else {
      ({ project, analysis } = await this.resolveProjectAndAnalysis(userId, dto));

      // For saved GitHub projects, rebuild repository context to avoid generic boilerplate output.
      if (project.repoUrl) {
        const branch = dto.branch ?? 'main';
        const token = dto.githubToken || (await this.getStoredGithubToken(userId));
        try {
          repoContext = await this.buildRepoAnalysisContext(project.repoUrl, branch, token);
        } catch {
          // Keep generation resilient even if repo context cannot be fetched.
          repoContext = undefined;
        }
      }
    }

    const existingConfig = this.mergePromptSections(dto.existingConfig, repoContext?.existingConfig);
    const userRequest = this.mergePromptSections(
      dto.userRequest,
      this.repoAwareStrictDevopsInstructions(repoContext?.promptContext),
    );

    const cicd = await this.aiService.generateCicd({
      projectDescription: project.summary || project.name,
      stackInfo: this.describeStack(analysis),
      cloudProvider: dto.cloudTarget,
      existingConfig,
      userRequest,
      actionType: dto.actionType,
      mode: dto.actionType,
    });

    const bundle = this.composeBundle(cicd, dto.cloudTarget, project.name, analysis, repoContext);

    // If no persisted project exists (ephemeral analysisJson path), skip DB writes and return bundle directly.
    if (project.id === 'ephemeral') {
      const result = {
        versionId: 'ephemeral',
        files: bundle.files.map((file, idx) => ({ ...file, id: `ephemeral-${idx}`, projectVersionId: 'ephemeral', createdAt: new Date().toISOString() })),
        costEstimate: bundle.costEstimate,
        securityFindings: bundle.securityFindings,
      } as any;

      try {
        await this.prisma.request.create({
          data: {
            userId,
            type: 'cicd',
            input: JSON.stringify(dto),
            output: JSON.stringify(result),
          },
        });
      } catch {
        // History logging should never block generation.
      }

      return result;
    }

    const version = await this.prisma.projectVersion.create({
      data: {
        projectId: project.id,
        label: dto.label || `infra-${new Date().toISOString()}`,
        cloudTarget: dto.cloudTarget,
        analysis,
        files: {
          create: bundle.files.map((file) => ({
            path: file.path,
            content: file.content,
            kind: file.kind,
          })),
        },
      },
      include: { files: true },
    });

    const result = {
      versionId: version.id,
      files: version.files,
      costEstimate: bundle.costEstimate,
      securityFindings: bundle.securityFindings,
    };

    try {
      await this.prisma.request.create({
        data: {
          userId,
          type: 'cicd',
          input: JSON.stringify(dto),
          output: JSON.stringify(result),
        },
      });
    } catch {
      // History logging should never block generation.
    }

    if (project.repoUrl || dto.repoUrl) {
      try {
        await this.repoMemory.recordEvent(
          userId,
          project.repoUrl || dto.repoUrl!,
          'generate',
          `Generated ${result.files.length} infra/CI file(s)`,
          { versionId: result.versionId, paths: result.files.map((f: { path: string }) => f.path) },
          {
            branch: dto.branch,
            cloudTarget: dto.cloudTarget,
            analysis: analysis as unknown as Record<string, unknown>,
            lastVersionId: result.versionId,
          },
        );
      } catch {
        // Memory must never block generation.
      }
    }

    return result;
  }

  async improveConfig(userId: string, dto: ImproveConfigDto) {
    const version = await this.prisma.projectVersion.findFirst({
      where: {
        id: dto.projectVersionId,
        project: { userId },
      },
      include: { project: true },
    });

    if (!version) {
      throw new NotFoundException('Project version not found');
    }

    const cloudProvider = dto.cloudTarget ?? version.cloudTarget ?? undefined;

    const cicd = await this.aiService.generateCicd({
      projectDescription: version.project.summary || version.project.name,
      stackInfo: this.describeStack((version.analysis as AnalysisResult) ?? undefined),
      cloudProvider,
      existingConfig: dto.currentContent,
      userRequest: dto.userRequest || `Improve only ${dto.filePath}`,
      actionType: 'modify',
      mode: 'modify',
    });

    const improvedContent = this.pickContentForPath(dto.filePath, cicd) || dto.currentContent;

    await this.prisma.generatedFile.upsert({
      where: {
        projectVersionId_path: {
          projectVersionId: version.id,
          path: dto.filePath,
        },
      },
      update: { content: improvedContent },
      create: {
        projectVersionId: version.id,
        path: dto.filePath,
        content: improvedContent,
        kind: this.kindFromPath(dto.filePath),
      },
    });

    return { content: improvedContent };
  }

  async analyzeLog(dto: LogAnalyzerDto) {
    return this.aiService.debugError([dto.context, dto.log].filter(Boolean).join('\n\n'));
  }

  async listProjects(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      include: { versions: { include: { files: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getLatestGeneratedBundle(userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          include: { files: true },
        },
      },
    });

    const latestVersion = project?.versions?.[0];
    if (!project || !latestVersion || latestVersion.files.length === 0) {
      return { files: [] };
    }

    return {
      projectId: project.id,
      projectName: project.name,
      versionId: latestVersion.id,
      analysis: latestVersion.analysis as AnalysisResult,
      cloudTarget: latestVersion.cloudTarget,
      files: latestVersion.files,
    };
  }

  async getChat(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        project: { select: { userId: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    if (session.project && session.project.userId !== userId) {
      throw new ForbiddenException('Chat session does not belong to the current user');
    }

    const { project: _project, ...safeSession } = session;
    return safeSession;
  }

  async addChatMessage(sessionId: string, role: ChatRole, content: string) {
    return this.prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
      },
    });
  }

  private parsePackageJson(raw: string): Record<string, any> {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new BadRequestException('Invalid package.json content');
    }
  }

  private detectStack(pkg: Record<string, any>): AnalysisResult {
    const dependencies = Object.keys(pkg.dependencies ?? {});
    const devDependencies = Object.keys(pkg.devDependencies ?? {});
    const deps = new Set<string>([...dependencies, ...devDependencies]);
    const services: DetectedService[] = [];
    const notes: string[] = [];

    const has = (name: string) => deps.has(name);

    if (has('next') || has('react')) {
      services.push({ name: 'frontend', kind: 'frontend', framework: has('next') ? 'Next.js' : 'React', language: 'typescript', portHint: 3000 });
    }

    if (has('@nestjs/core') || has('@nestjs/common') || has('@nestjs/platform-express')) {
      services.push({ name: 'backend', kind: 'backend', framework: 'NestJS', language: 'typescript', portHint: 4000 });
    } else if (has('express') || has('fastify') || has('koa')) {
      services.push({
        name: 'backend',
        kind: 'backend',
        framework: has('fastify') ? 'Fastify' : has('koa') ? 'Koa' : 'Express',
        language: 'javascript',
        portHint: 4000,
      });
    }

    if (has('prisma') || has('@prisma/client')) {
      services.push({ name: 'database', kind: 'database', framework: 'Prisma', language: 'sql', envHints: ['DATABASE_URL'] });
    }

    if (has('bull') || has('@nestjs/bull')) {
      services.push({ name: 'worker', kind: 'worker', framework: 'BullMQ', language: 'typescript' });
    }

    if (services.length === 0) {
      services.push({ name: 'app', kind: 'unknown' });
      notes.push('No framework detected; review manually.');
    }

    const packageManager: AnalysisResult['packageManager'] = pkg.packageManager?.includes('pnpm')
      ? 'pnpm'
      : pkg.packageManager?.includes('yarn')
        ? 'yarn'
        : pkg.packageManager?.includes('bun')
          ? 'bun'
          : 'npm';

    return {
      packageManager,
      services,
      dependencies,
      devDependencies,
      notes,
    };
  }

  private describeStack(analysis?: AnalysisResult) {
    if (!analysis) return 'Stack unknown';

    const services = analysis.services
      .map((svc) => `${svc.kind}${svc.framework ? ` (${svc.framework})` : ''}`)
      .join(', ');

    return `Services: ${services}. Package manager: ${analysis.packageManager}.`;
  }

  private composeBundle(
    cicd: Awaited<ReturnType<AiService['generateCicd']>>,
    cloudTarget: CloudTarget,
    projectName: string,
    analysis: AnalysisResult,
    repoContext?: RepoAnalysisContext,
  ): InfraBundle {
    const workflowFiles = this.buildWorkflowFiles(cicd.githubActions, analysis, repoContext, cloudTarget);

    const files: InfraBundle['files'] = [
      { path: 'Dockerfile', content: cicd.dockerfile, kind: FileKind.dockerfile },
      { path: 'docker-compose.yml', content: cicd.dockerCompose, kind: FileKind.dockerCompose },
      ...workflowFiles,
      { path: 'k8s/app.yaml', content: cicd.kubernetes, kind: FileKind.kubernetes },
      { path: '.env.example', content: cicd.env, kind: FileKind.env },
      { path: 'devops/README.md', content: this.buildReadme(projectName, cloudTarget, analysis, cicd), kind: FileKind.readme },
      { path: 'devops/COSTS.md', content: this.estimateCosts(cloudTarget), kind: FileKind.cost },
      { path: 'devops/SECURITY.md', content: this.securitySummary(), kind: FileKind.security },
    ];

    return {
      files,
      costEstimate: this.estimateCosts(cloudTarget),
      securityFindings: this.securitySummary(),
    };
  }

  private buildWorkflowFiles(
    defaultWorkflow: string,
    analysis: AnalysisResult,
    repoContext?: RepoAnalysisContext,
    cloudTarget?: CloudTarget,
  ): InfraBundle['files'] {
    const fallbackWorkflow = this.buildProductionFallbackWorkflow(analysis);
    const aiWorkflow = this.normalizeWorkflowContent(defaultWorkflow) || fallbackWorkflow;
    const defaultFiles: InfraBundle['files'] = [
      { path: '.github/workflows/ci-cd.yml', content: aiWorkflow, kind: FileKind.githubActions },
    ];

    if (!repoContext) {
      return defaultFiles;
    }

    const hasFrontend = analysis.services.some((service) => service.kind === 'frontend');
    const hasBackend = analysis.services.some((service) => service.kind === 'backend');
    if (!hasFrontend || !hasBackend) {
      return defaultFiles;
    }

    const frontendPkg = this.pickPackageByRole(repoContext.packageFiles, 'frontend');
    const backendPkg = this.pickPackageByRole(repoContext.packageFiles, 'backend');

    if (!frontendPkg || !backendPkg) {
      return defaultFiles;
    }

    return [
      {
        path: '.github/workflows/frontend-ci.yml',
        content: this.buildServiceWorkflowYaml('Frontend', frontendPkg, cloudTarget, repoContext),
        kind: FileKind.githubActions,
      },
      {
        path: '.github/workflows/backend-ci.yml',
        content: this.buildServiceWorkflowYaml('Backend', backendPkg, cloudTarget, repoContext),
        kind: FileKind.githubActions,
      },
    ];
  }

  private normalizeWorkflowContent(content?: string): string | undefined {
    const value = (content || '').trim();
    if (!value) return undefined;
    if (value === 'Not required' || value === 'Not applicable' || value === 'Not requested') {
      return undefined;
    }
    if (!value.includes('jobs:') || value.split('\n').length < 20) {
      return undefined;
    }
    return value;
  }

  private buildProductionFallbackWorkflow(analysis: AnalysisResult): string {
    const hasBackend = analysis.services.some((service) => service.kind === 'backend');
    const hasFrontend = analysis.services.some((service) => service.kind === 'frontend');

    if (!hasBackend || !hasFrontend) {
      return [
        'name: DevMat CI-CD',
        '',
        'on:',
        '  push:',
        '    branches: ["main", "master"]',
        '  pull_request:',
        '    branches: ["main", "master"]',
        '',
        'jobs:',
        '  build-test:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - name: Checkout',
        '        uses: actions/checkout@v4',
        '      - name: Setup Node',
        '        uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 20',
        '          cache: npm',
        '      - name: Install dependencies',
        '        run: npm ci',
        '      - name: Lint',
        '        run: npm run lint --if-present',
        '      - name: Build',
        '        run: npm run build --if-present',
      ].join('\n');
    }

    return this.buildRepoAwareCombinedWorkflow(
      { path: 'frontend/package.json', packageJson: { scripts: { lint: 'npm run lint', build: 'npm run build' } } },
      { path: 'backend/package.json', packageJson: { scripts: { lint: 'npm run lint', build: 'npm run build', test: 'npm test' }, dependencies: { prisma: '^1.0.0' } } },
    );
  }

  private buildRepoAwareCombinedWorkflow(
    frontendPkg: RepoPackageDescriptor,
    backendPkg: RepoPackageDescriptor,
    _cloudTarget?: CloudTarget,
  ): string {
    const frontendDir = pathPosix.dirname(frontendPkg.path) === '.' ? 'frontend' : pathPosix.dirname(frontendPkg.path);
    const backendDir = pathPosix.dirname(backendPkg.path) === '.' ? 'backend' : pathPosix.dirname(backendPkg.path);
    const backendScripts = backendPkg.packageJson.scripts ?? {};
    const frontendScripts = frontendPkg.packageJson.scripts ?? {};
    const hasPrisma = Boolean(
      backendPkg.packageJson.dependencies?.prisma ||
      backendPkg.packageJson.devDependencies?.prisma,
    );

    const lines = [
      'name: DevMat CI-CD',
      '',
      'on:',
      '  push:',
      '    branches: ["main", "master"]',
      '    tags:',
      '      - "v*"',
      '  pull_request:',
      '    branches: ["main", "master"]',
      '',
      'concurrency:',
      '  group: opsmate-${{ github.ref }}',
      '  cancel-in-progress: true',
      '',
      'jobs:',
      '  backend:',
      '    name: Backend Build + Test',
      '    runs-on: ubuntu-latest',
      '    defaults:',
      '      run:',
      `        working-directory: ${backendDir}`,
      '    steps:',
      '      - name: Checkout',
      '        uses: actions/checkout@v4',
      '',
      '      - name: Setup Node',
      '        uses: actions/setup-node@v4',
      '        with:',
      '          node-version: 20',
      '          cache: npm',
      `          cache-dependency-path: ${backendDir}/package-lock.json`,
      '',
      '      - name: Install dependencies',
      '        run: npm ci',
      '',
    ];

    if (hasPrisma) {
      lines.push('      - name: Generate Prisma client');
      lines.push('        run: npx prisma generate');
      lines.push('        env:');
      lines.push('          DATABASE_URL: postgresql://devmate:devmate_password@localhost:5432/devmate_ai?schema=public');
      lines.push('');
    }

    lines.push('      - name: Lint backend');
    lines.push(`        run: ${backendScripts.lint ? 'npm run lint' : 'npm run lint --if-present'}`);
    lines.push('');
    lines.push('      - name: Build backend');
    lines.push(`        run: ${backendScripts.build ? 'npm run build' : 'npm run build --if-present'}`);
    lines.push('');
    lines.push('      - name: Test backend');
    lines.push(`        run: ${backendScripts.test ? 'npm test -- --runInBand --passWithNoTests' : 'npm test --if-present -- --runInBand --passWithNoTests'}`);
    lines.push('');
    lines.push('  frontend:');
    lines.push('    name: Frontend Build + Lint');
    lines.push('    runs-on: ubuntu-latest');
    lines.push('    defaults:');
    lines.push('      run:');
    lines.push(`        working-directory: ${frontendDir}`);
    lines.push('    steps:');
    lines.push('      - name: Checkout');
    lines.push('        uses: actions/checkout@v4');
    lines.push('');
    lines.push('      - name: Setup Node');
    lines.push('        uses: actions/setup-node@v4');
    lines.push('        with:');
    lines.push('          node-version: 20');
    lines.push('          cache: npm');
    lines.push(`          cache-dependency-path: ${frontendDir}/package-lock.json`);
    lines.push('');
    lines.push('      - name: Install dependencies');
    lines.push('        run: npm ci');
    lines.push('');
    lines.push('      - name: Lint frontend');
    lines.push(`        run: ${frontendScripts.lint ? 'npm run lint' : 'npm run lint --if-present'}`);
    lines.push('');
    lines.push('      - name: Build frontend');
    lines.push(`        run: ${frontendScripts.build ? 'npm run build' : 'npm run build --if-present'}`);
    lines.push('        env:');
    lines.push('          NEXT_PUBLIC_API_URL: http://localhost:4000');
    lines.push('');
    lines.push('  security-scan:');
    lines.push('    name: Security Scan');
    lines.push('    runs-on: ubuntu-latest');
    lines.push('    needs: [backend, frontend]');
    lines.push('    permissions:');
    lines.push('      security-events: write');
    lines.push('      contents: read');
    lines.push('    steps:');
    lines.push('      - name: Checkout');
    lines.push('        uses: actions/checkout@v4');
    lines.push('');
    lines.push('      - name: Trivy filesystem scan');
    lines.push('        uses: aquasecurity/trivy-action@0.28.0');
    lines.push('        with:');
    lines.push('          scan-type: fs');
    lines.push('          scan-ref: .');
    lines.push('          format: table');
    lines.push('          severity: CRITICAL,HIGH');
    lines.push('          exit-code: 1');
    lines.push('');
    lines.push('  docker:');
    lines.push('    name: Build and Push Containers');
    lines.push('    runs-on: ubuntu-latest');
    lines.push('    needs: [backend, frontend, security-scan]');
    lines.push("    if: github.event_name == 'push'");
    lines.push('    permissions:');
    lines.push('      contents: read');
    lines.push('      packages: write');
    lines.push('    steps:');
    lines.push('      - name: Checkout');
    lines.push('        uses: actions/checkout@v4');
    lines.push('');
    lines.push('      - name: Setup Docker Buildx');
    lines.push('        uses: docker/setup-buildx-action@v3');
    lines.push('');
    lines.push('      - name: Check Docker Hub credentials');
    lines.push('        id: dockerhub_check');
    lines.push('        run: |');
    lines.push('          if [ -n "${{ secrets.DOCKERHUB_USERNAME }}" ] && [ -n "${{ secrets.DOCKERHUB_TOKEN }}" ]; then');
    lines.push('            echo "available=true" >> $GITHUB_OUTPUT');
    lines.push('          else');
    lines.push('            echo "available=false" >> $GITHUB_OUTPUT');
    lines.push('          fi');
    lines.push('');
    lines.push('      - name: Login to Docker Hub');
    lines.push("        if: steps.dockerhub_check.outputs.available == 'true'");
    lines.push('        uses: docker/login-action@v3');
    lines.push('        with:');
    lines.push('          username: ${{ secrets.DOCKERHUB_USERNAME }}');
    lines.push('          password: ${{ secrets.DOCKERHUB_TOKEN }}');
    lines.push('');
    lines.push('      - name: Set image tag');
    lines.push('        run: echo "IMAGE_TAG=${GITHUB_SHA::7}" >> $GITHUB_ENV');
    lines.push('');
    lines.push(`      - name: Build backend image`);
    lines.push(`        run: docker build -t \${{ secrets.DOCKERHUB_USERNAME }}/opsmate-backend:\${IMAGE_TAG} ./${backendDir}`);
    lines.push('');
    lines.push(`      - name: Build frontend image`);
    lines.push(`        run: docker build -t \${{ secrets.DOCKERHUB_USERNAME }}/opsmate-frontend:\${IMAGE_TAG} ./${frontendDir}`);
    lines.push('');
    lines.push('      - name: Push backend image');
    lines.push("        if: steps.dockerhub_check.outputs.available == 'true'");
    lines.push('        run: docker push ${{ secrets.DOCKERHUB_USERNAME }}/opsmate-backend:${IMAGE_TAG}');
    lines.push('');
    lines.push('      - name: Push frontend image');
    lines.push("        if: steps.dockerhub_check.outputs.available == 'true'");
    lines.push('        run: docker push ${{ secrets.DOCKERHUB_USERNAME }}/opsmate-frontend:${IMAGE_TAG}');
    lines.push('');
    lines.push('  deploy-staging:');
    lines.push('    name: Deploy Staging');
    lines.push('    runs-on: ubuntu-latest');
    lines.push('    needs: [docker]');
    lines.push("    if: github.ref == 'refs/heads/main'");
    lines.push('    environment: staging');
    lines.push('    steps:');
    lines.push('      - name: Deployment gate');
    lines.push('        run: echo "Add staging deployment command here (ssh/kubectl/terraform)."');
    lines.push('');
    lines.push('  deploy-production:');
    lines.push('    name: Deploy Production');
    lines.push('    runs-on: ubuntu-latest');
    lines.push('    needs: [docker]');
    lines.push("    if: startsWith(github.ref, 'refs/tags/v')");
    lines.push('    environment: production');
    lines.push('    steps:');
    lines.push('      - name: Deployment gate');
    lines.push('        run: echo "Add production deployment command here with rollback hooks and approval gates."');

    return lines.join('\n');
  }

  private pickPackageByRole(
    packageFiles: RepoPackageDescriptor[],
    role: 'frontend' | 'backend',
  ): RepoPackageDescriptor | undefined {
    const roleRegex =
      role === 'frontend'
        ? /(^|\/)(frontend|client|web|ui|apps\/web)(\/|$)/i
        : /(^|\/)(backend|api|server|services\/api|apps\/api)(\/|$)/i;

    return packageFiles.find((pkg) => roleRegex.test(pkg.path));
  }

  private buildServiceWorkflowYaml(
    name: 'Frontend' | 'Backend',
    pkg: RepoPackageDescriptor,
    cloudTarget?: CloudTarget,
    repoContext?: RepoAnalysisContext,
  ): string {
    const dir = pathPosix.dirname(pkg.path) === '.' ? '' : pathPosix.dirname(pkg.path);
    const scripts = pkg.packageJson.scripts ?? {};
    const packageManager = this.detectPackageManager(pkg.packageJson.packageManager);
    const nodeVersion = this.ensureNodeVersionTag(this.detectNodeVersion(pkg.packageJson.engines?.node));
    const serviceSlug = name.toLowerCase();
    const dockerfilePath = this.findDockerfilePath(dir, repoContext?.repoPaths || []);
    const dockerContext = dir || '.';
    const lockFilePath = packageManager === 'pnpm'
      ? `${dir ? `${dir}/` : ''}pnpm-lock.yaml`
      : packageManager === 'yarn'
        ? `${dir ? `${dir}/` : ''}yarn.lock`
        : `${dir ? `${dir}/` : ''}package-lock.json`;
    const imageRepo = `${'${{ secrets.DOCKERHUB_USERNAME }}'}/${'${{ github.event.repository.name }}'}-${serviceSlug}`;
    const defaultPort = name === 'Frontend' ? '3000:80' : '5000:5000';
    const healthPort = name === 'Frontend' ? '3000' : '5000';
    const healthCheck = name === 'Frontend'
      ? `curl -fsS http://localhost:${healthPort} || exit 1`
      : `curl -fsS http://localhost:${healthPort} || curl -fsS http://localhost:${healthPort}/health || exit 1`;
    const packageCachePath = packageManager === 'pnpm'
      ? '~/.pnpm-store'
      : packageManager === 'yarn'
        ? '~/.cache/yarn'
        : '~/.npm';
    const installCommand = this.installCommandForPackageManager(packageManager);
    const runLint = scripts.lint ? this.runScriptCommand(packageManager, 'lint') : undefined;
    const runTest = scripts.test ? this.runScriptCommand(packageManager, 'test') : undefined;
    const runBuild = scripts.build ? this.runScriptCommand(packageManager, 'build') : undefined;
    const lintCommand = runLint || `echo "Missing lint script in ${pkg.path}" && exit 1`;
    const testCommand = runTest || `echo "Missing test script in ${pkg.path}" && exit 1`;

    const withWorkDir = (command: string) =>
      dir ? `cd ${dir}\\n          ${command}` : command;

    const pathFilter = dir ? `${dir}/**` : '**/*';
    const workflowFile = name === 'Frontend' ? 'frontend-ci.yml' : 'backend-ci.yml';

    const lines = [
      `name: ${name} CI`,
      '',
      'on:',
      '  push:',
      '    branches: [ main ]',
      '    paths:',
      `      - '${pathFilter}'`,
      `      - '.github/workflows/${workflowFile}'`,
      '  pull_request:',
      '    branches: [ main ]',
      '    paths:',
      `      - '${pathFilter}'`,
      `      - '.github/workflows/${workflowFile}'`,
      '',
      'permissions:',
      '  contents: read',
      '  packages: write',
      ...(name === 'Backend' ? ['  security-events: write'] : []),
      '',
      'jobs:',
      `  ${serviceSlug}-ci:`,
      '    runs-on: ubuntu-latest',
      ...(name === 'Backend'
        ? [
            '    strategy:',
            '      fail-fast: true',
            '      matrix:',
            `        node-version: [18.x, ${nodeVersion}]`,
          ]
        : []),
      '    steps:',
      '      - name: Checkout',
      '        uses: actions/checkout@v4',
      '      - name: Setup Node',
      '        uses: actions/setup-node@v4',
      '        with:',
      `          node-version: '${name === 'Backend' ? '${{ matrix.node-version }}' : nodeVersion}'`,
      `          cache: '${packageManager === 'npm' ? 'npm' : packageManager}'`,
      `          cache-dependency-path: ${lockFilePath}`,
      '      - name: Cache dependencies',
      '        uses: actions/cache@v3',
      '        with:',
      '          path: |',
      `            ${packageCachePath}`,
      `            ${dir ? `${dir}/node_modules` : 'node_modules'}`,
      `          key: ${'${{ runner.os }}'}-node-${'${{ hashFiles(\'**/package-lock.json\') }}'}`,
      '      - name: Install dependencies',
      `        run: |\\n          ${withWorkDir(installCommand)}`,
      '      - name: Lint',
      `        run: |\\n          ${withWorkDir(lintCommand)}`,
      '      - name: Test',
      `        run: |\\n          ${withWorkDir(testCommand)}`,
    ];

    if (runBuild) {
      lines.push('      - name: Build');
      lines.push(`        run: |\\n          ${withWorkDir(runBuild)}`);
    }

    lines.push('      - name: Summary');
    lines.push('        run: echo "Build/test completed for ' + name + ' ✅" >> $GITHUB_STEP_SUMMARY');

    if (name === 'Backend') {
      lines.push('      - name: Security audit');
      lines.push('        run: |\\n          npm audit --audit-level=moderate');
      lines.push('        continue-on-error: true');
    }

    lines.push('');
    lines.push('  docker:');
    lines.push(`    needs: ${serviceSlug}-ci`);
    lines.push('    runs-on: ubuntu-latest');
    lines.push('    steps:');
    lines.push('      - name: Checkout');
    lines.push('        uses: actions/checkout@v4');
    lines.push('      - name: Set up Docker Buildx');
    lines.push('        uses: docker/setup-buildx-action@v3');

    lines.push('      - name: Check Docker Hub credentials');
    lines.push('        id: dockerhub-check');
    lines.push('        run: |');
    lines.push(`          if [ -n "${'${{ secrets.DOCKERHUB_USERNAME }}'}" ] && [ -n "${'${{ secrets.DOCKERHUB_TOKEN }}'}" ]; then`);
    lines.push('            echo "available=true" >> $GITHUB_OUTPUT');
    lines.push('          else');
    lines.push('            echo "available=false" >> $GITHUB_OUTPUT');
    lines.push('          fi');

    lines.push('      - name: Login to Docker Hub');
    lines.push("        if: steps.dockerhub-check.outputs.available == 'true'");
    lines.push('        uses: docker/login-action@v3');
    lines.push('        with:');
    lines.push('          username: ${{ secrets.DOCKERHUB_USERNAME }}');
    lines.push('          password: ${{ secrets.DOCKERHUB_TOKEN }}');

    lines.push('      - name: Set version');
    lines.push('        run: echo "VERSION=$(git rev-parse --short HEAD)" >> $GITHUB_ENV');

    lines.push('      - name: Build Docker image (PR)');
    lines.push("        if: github.event_name == 'pull_request'");
    lines.push('        run: |');
    lines.push('          DOCKER_BUILDKIT=1 docker build \\');
    lines.push(`            --file ./${dockerfilePath} \\`);
    lines.push('            --cache-from=type=registry,ref=${{ secrets.DOCKERHUB_USERNAME }}/${{ github.event.repository.name }}-' + serviceSlug + ':latest \\');
    lines.push(`            --tag ${serviceSlug}:$VERSION ./${dockerContext}`);

    lines.push('      - name: Build & Push Docker image');
    lines.push("        if: github.event_name == 'push' && github.ref == 'refs/heads/main' && steps.dockerhub-check.outputs.available == 'true'");
    lines.push('        run: |');
    lines.push('          docker buildx build \\');
    lines.push(`            --file ./${dockerfilePath} \\`);
    lines.push(`            --cache-from=type=registry,ref=${imageRepo}:latest \\`);
    lines.push('            --cache-to=type=inline \\');
    lines.push(`            --tag ${imageRepo}:latest \\`);
    lines.push(`            --tag ${imageRepo}:$VERSION \\`);
    lines.push('            --push \\');
    lines.push(`            ./${dockerContext}`);

    lines.push('      - name: Build Docker image (no push)');
    lines.push("        if: github.event_name == 'push' && github.ref == 'refs/heads/main' && steps.dockerhub-check.outputs.available == 'false'");
    lines.push('        run: |');
    lines.push('          DOCKER_BUILDKIT=1 docker build \\');
    lines.push(`            --file ./${dockerfilePath} \\`);
    lines.push(`            --tag ${serviceSlug}:$VERSION ./${dockerContext}`);

    lines.push('      - name: Scan Docker image');
    lines.push("        if: github.event_name == 'pull_request' || steps.dockerhub-check.outputs.available == 'false'");
    lines.push('        uses: aquasecurity/trivy-action@master');
    lines.push('        with:');
    lines.push(`          image-ref: ${serviceSlug}:${'${{ env.VERSION }}'}`);
    lines.push('          format: table');
    lines.push('          exit-code: 1');

    lines.push('      - name: Scan pushed Docker image');
    lines.push("        if: github.event_name == 'push' && github.ref == 'refs/heads/main' && steps.dockerhub-check.outputs.available == 'true'");
    lines.push('        uses: aquasecurity/trivy-action@master');
    lines.push('        with:');
    lines.push(`          image-ref: ${imageRepo}:${'${{ env.VERSION }}'}`);
    lines.push('          format: table');
    lines.push('          exit-code: 1');

    lines.push('      - name: Summary');
    lines.push('        run: echo "Docker build/scan completed for ' + name + ' ✅" >> $GITHUB_STEP_SUMMARY');

    lines.push('');
    lines.push('  deploy:');
    lines.push('    needs: docker');
    lines.push('    runs-on: ubuntu-latest');
    lines.push("    if: github.event_name == 'push' && github.ref == 'refs/heads/main'");
    lines.push('    steps:');
    lines.push('      - name: Checkout code');
    lines.push('        uses: actions/checkout@v4');
    lines.push('      - name: Check secrets');
    lines.push('        run: |');
    lines.push('          if [ -z "${{ secrets.DOCKER_USERNAME }}" ] && [ -z "${{ secrets.DOCKERHUB_USERNAME }}" ]; then echo "Missing Docker username secret"; exit 1; fi');
    lines.push('          if [ -z "${{ secrets.DOCKERHUB_TOKEN }}" ]; then echo "Missing DOCKERHUB_TOKEN"; exit 1; fi');

    if (cloudTarget === CloudTarget.vercel) {
      lines.push('      - name: Deploy to Vercel');
      lines.push('        run: |');
      lines.push('          echo "Configure VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID secrets."');
      lines.push('          npx vercel --prod --token "${{ secrets.VERCEL_TOKEN }}" || exit 1');
      lines.push('      - name: Summary');
      lines.push('        run: echo "Vercel deploy completed ✅" >> $GITHUB_STEP_SUMMARY');
      return lines.join('\n');
    }

    if (cloudTarget === CloudTarget.ecs || cloudTarget === CloudTarget.eks) {
      lines.push('      - name: Configure AWS credentials');
      lines.push('        uses: aws-actions/configure-aws-credentials@v4');
      lines.push('        with:');
      lines.push('          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}');
      lines.push('          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}');
      lines.push('          aws-region: ${{ secrets.AWS_REGION }}');
      lines.push('      - name: Deploy to AWS');
      lines.push('        run: |');
      if (cloudTarget === CloudTarget.ecs) {
        lines.push('          echo "Update ECS service task definition with image tag $VERSION"');
      } else {
        lines.push('          echo "Update EKS deployment image with tag $VERSION and run rollout status"');
      }
      lines.push('      - name: Summary');
      lines.push('        run: echo "AWS deploy stage completed ✅" >> $GITHUB_STEP_SUMMARY');
      return lines.join('\n');
    }

    lines.push('      - name: Prepare deploy SSH key and vars');
    lines.push('        id: deploy-vars');
    lines.push('        shell: bash');
    lines.push('        run: |');
    lines.push('          host="$(printf \'%s\' "${{ secrets.EC2_HOST }}" | tr -d \'\\r\\n\' | xargs)"');
    lines.push('          user="$(printf \'%s\' "${{ secrets.EC2_USERNAME }}" | tr -d \'\\r\\n\' | xargs)"');
    lines.push('          if [ -z "$host" ]; then echo "EC2_HOST secret is empty or invalid"; exit 1; fi');
    lines.push('          if [ -z "$user" ]; then echo "EC2_USERNAME secret is empty or invalid"; exit 1; fi');
    lines.push('          echo "ec2_host=$host" >> "$GITHUB_OUTPUT"');
    lines.push('          echo "ec2_user=$user" >> "$GITHUB_OUTPUT"');
    lines.push('          if [ -z "${{ secrets.EC2_SSH_KEY }}" ]; then echo "EC2_SSH_KEY secret is empty"; exit 1; fi');
    lines.push('          printf "%s" "${{ secrets.EC2_SSH_KEY }}" | tr -d "\\r" > "$RUNNER_TEMP/ec2_deploy_key"');
    lines.push('          chmod 600 "$RUNNER_TEMP/ec2_deploy_key"');
    lines.push('      - name: Executing remote ssh commands to deploy');
    lines.push('        uses: appleboy/ssh-action@v1.0.3');
    lines.push('        with:');
    lines.push('          host: ${{ steps.deploy-vars.outputs.ec2_host }}');
    lines.push('          username: ${{ steps.deploy-vars.outputs.ec2_user }}');
    lines.push('          key_path: /github/runner_temp/ec2_deploy_key');
    lines.push('          script: |');
    lines.push('            echo "${{ secrets.DOCKERHUB_TOKEN }}" | docker login -u "${{ secrets.DOCKERHUB_USERNAME }}" --password-stdin');
    lines.push(`            docker pull ${imageRepo}:latest`);
    lines.push(`            docker stop old-${serviceSlug} || true`);
    lines.push(`            docker rm -f old-${serviceSlug} || true`);
    lines.push(`            if docker ps -a --format '{{.Names}}' | grep -Eq '^${serviceSlug}$'; then docker rename ${serviceSlug} old-${serviceSlug}; fi`);
    lines.push(`            PORT_MAPPING="${defaultPort}"`);
    lines.push(`            docker run -d --name ${serviceSlug} --restart unless-stopped -p "$PORT_MAPPING" ${imageRepo}:latest`);
    lines.push('            sleep 8');
    lines.push(`            if ! ${healthCheck}; then`);
    lines.push(`              docker logs ${serviceSlug} || true`);
    lines.push(`              docker rm -f ${serviceSlug} || true`);
    lines.push(`              if docker ps -a --format '{{.Names}}' | grep -Eq '^old-${serviceSlug}$'; then docker rename old-${serviceSlug} ${serviceSlug} && docker start ${serviceSlug}; fi`);
    lines.push('              exit 1');
    lines.push('            fi');
    lines.push(`            docker rm -f old-${serviceSlug} || true`);
    lines.push('            docker image prune -f');
    lines.push('      - name: Summary');
    lines.push('        run: echo "Deployment completed with health check ✅" >> $GITHUB_STEP_SUMMARY');

    if (cloudTarget) {
      lines.push('');
      lines.push('      # Target environment hint');
      lines.push(`      # cloudTarget: ${cloudTarget}`);
    }

    return lines.join('\n');
  }

  private findDockerfilePath(serviceDir: string, repoPaths: string[]): string {
    const normalized = new Set(repoPaths.map((path) => path.toLowerCase()));
    const candidates = [
      serviceDir ? `${serviceDir}/Dockerfile` : 'Dockerfile',
      'Dockerfile',
    ];

    for (const candidate of candidates) {
      if (normalized.has(candidate.toLowerCase())) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private detectPackageManager(rawPackageManager?: string): 'npm' | 'pnpm' | 'yarn' {
    const value = (rawPackageManager || '').toLowerCase();
    if (value.includes('pnpm')) return 'pnpm';
    if (value.includes('yarn')) return 'yarn';
    return 'npm';
  }

  private detectNodeVersion(rawNodeEngine?: string): string {
    if (!rawNodeEngine || typeof rawNodeEngine !== 'string') {
      return '20';
    }

    const match = rawNodeEngine.match(/(\d{2})/);
    return match ? match[1] : '20';
  }

  private installCommandForPackageManager(packageManager: 'npm' | 'pnpm' | 'yarn'): string {
    if (packageManager === 'pnpm') {
      return 'corepack enable && pnpm install --frozen-lockfile';
    }

    if (packageManager === 'yarn') {
      return 'corepack enable && yarn install --frozen-lockfile';
    }

    return 'npm ci';
  }

  private runScriptCommand(packageManager: 'npm' | 'pnpm' | 'yarn', script: string): string {
    if (packageManager === 'pnpm') {
      return `pnpm run ${script}`;
    }

    if (packageManager === 'yarn') {
      return `yarn ${script}`;
    }

    return `npm run ${script}`;
  }

  private ensureNodeVersionTag(nodeVersion: string): string {
    if (!nodeVersion) return '20.x';
    if (nodeVersion.endsWith('.x')) return nodeVersion;
    if (/^\d+$/.test(nodeVersion)) return `${nodeVersion}.x`;
    return nodeVersion;
  }

  private lockfilePathForPackageManager(packageManager: 'npm' | 'pnpm' | 'yarn', dir: string): string {
    const base = dir ? `${dir}/` : '';

    if (packageManager === 'pnpm') {
      return `${base}pnpm-lock.yaml`;
    }

    if (packageManager === 'yarn') {
      return `${base}yarn.lock`;
    }

    return `${base}package-lock.json`;
  }

  private buildReadme(projectName: string, cloudTarget: CloudTarget, analysis: AnalysisResult, cicd: Awaited<ReturnType<AiService['generateCicd']>>) {
    return [
      `# ${projectName} DevOps Bundle`,
      '',
      `Target: ${cloudTarget}`,
      '',
      '## Detected Stack',
      this.describeStack(analysis),
      '',
      '## What is included',
      '- Dockerfile',
      '- docker-compose.yml',
      '- GitHub Actions CI',
      '- Kubernetes manifest',
      '- .env.example',
      '- Cost and security notes',
      '',
      '## Setup',
      cicd.setupInstructions,
      '',
      '## Validation',
      cicd.validation,
    ].join('\n');
  }

  private estimateCosts(cloudTarget: CloudTarget) {
    switch (cloudTarget) {
      case CloudTarget.ecs:
        return 'ECS Fargate (t4g.small equivalents) with 1-2 services: ~$25-45/month plus data transfer.';
      case CloudTarget.eks:
        return 'EKS with managed node group (t4g.medium x1) and ALB: ~$60-90/month baseline.';
      case CloudTarget.vercel:
        return 'Vercel Pro hobby scale for frontend: ~$20-40/month; backend still needs a runtime.';
      case CloudTarget.digitalocean:
        return 'DigitalOcean App Platform or K8s (s-1vcpu-2gb x1-2): ~$12-40/month baseline.';
      case CloudTarget.local:
      default:
        return 'Local docker-compose: compute/storage cost is zero; consider resources for CI minutes.';
    }
  }

  private securitySummary() {
    return [
      'Security checks:',
      '- Use non-root containers where possible.',
      '- No hardcoded secrets; rely on environment variables and secret stores.',
      '- Restrict exposed ports to required services.',
      '- Add health probes and resource limits for Kubernetes.',
      '- Enable branch protections and required checks in CI.',
    ].join('\n');
  }

  private kindFromPath(path: string): FileKind | null {
    if (path.includes('Dockerfile')) return FileKind.dockerfile;
    if (path.includes('docker-compose')) return FileKind.dockerCompose;
    if (path.includes('workflows')) return FileKind.githubActions;
    if (path.includes('kubernetes')) return FileKind.kubernetes;
    if (path.includes('.env')) return FileKind.env;
    if (path.toLowerCase().includes('readme')) return FileKind.readme;
    return null;
  }

  private pickContentForPath(path: string, cicd: Awaited<ReturnType<AiService['generateCicd']>>) {
    if (path.includes('Dockerfile')) return cicd.dockerfile;
    if (path.includes('docker-compose')) return cicd.dockerCompose;
    if (path.includes('ci.yml') || path.includes('workflow')) return cicd.githubActions;
    if (path.includes('kubernetes')) return cicd.kubernetes;
    if (path.includes('.env')) return cicd.env;
    return cicd.explanation;
  }

  private buildRepoHealthChecks(analysis: AnalysisResult, repoPaths: string[]): RepoHealthCheck[] {
    const checks: RepoHealthCheck[] = [];
    const hasCi = this.hasEntry(repoPaths, ['.github/workflows', '.github']);
    const hasDocker = this.hasEntry(repoPaths, ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']);
    const hasK8s = this.hasEntry(repoPaths, ['k8s', 'kubernetes', 'helm']);
    const hasEnvExample = this.hasEntry(repoPaths, ['.env.example', '.env.sample']);
    const hasTests = analysis.dependencies.includes('jest') || analysis.devDependencies.includes('jest') || analysis.devDependencies.includes('vitest');

    checks.push({
      id: 'ci',
      title: 'Continuous Integration',
      status: hasCi ? 'pass' : 'warn',
      details: hasCi ? 'GitHub workflow configuration detected in repository tree.' : 'No GitHub Actions workflow was detected in the repository tree.',
      fix: 'Add .github/workflows/ci.yml using repository-specific lint, test, and build commands.',
    });

    checks.push({
      id: 'containerization',
      title: 'Containerization',
      status: hasDocker ? 'pass' : 'warn',
      details: hasDocker ? 'Docker configuration files detected.' : 'No Dockerfile or docker-compose definition was detected in the repository tree.',
      fix: 'Generate production Dockerfile(s) and docker-compose using detected services, scripts, and ports.',
    });

    checks.push({
      id: 'orchestration',
      title: 'Kubernetes Readiness',
      status: hasK8s ? 'pass' : 'warn',
      details: hasK8s ? 'Kubernetes/Helm-related files detected.' : 'No Kubernetes or Helm descriptors were detected in repository files.',
      fix: 'Generate Kubernetes manifests with probes, limits, and rollout strategy aligned to detected services.',
    });

    checks.push({
      id: 'env-template',
      title: 'Environment Contract',
      status: hasEnvExample ? 'pass' : 'warn',
      details: hasEnvExample ? '.env template file is present.' : 'No .env.example or .env.sample file detected for portability.',
      fix: 'Add .env.example documenting required runtime variables inferred from repository code and scripts.',
    });

    checks.push({
      id: 'tests',
      title: 'Automated Test Coverage',
      status: hasTests ? 'pass' : 'warn',
      details: hasTests ? 'Testing dependencies detected.' : 'No test dependency detected in package manifest.',
      fix: 'Add Jest or Vitest smoke tests and run them in CI before deployment.',
    });

    return checks;
  }

  private computeHealthScore(checks: RepoHealthCheck[]) {
    const passCount = checks.filter((check) => check.status === 'pass').length;
    return Math.round((passCount / checks.length) * 100);
  }

  private detectSecretRisks(repoPaths: string[]): SecretRisk[] {
    const findings: SecretRisk[] = [];
    const normalized = repoPaths.map((path) => path.toLowerCase());

    const hasEnvFile = normalized.some((path) => /(^|\/)\.env($|\.)/.test(path));
    const hasEnvTemplate = normalized.some((path) =>
      ['.env.example', '.env.sample', '.env.template'].some((template) => path.endsWith(template)),
    );

    if (hasEnvFile && !hasEnvTemplate) {
      findings.push({
        severity: 'high',
        path: '.env',
        finding: 'Environment file appears committed without a matching template file.',
        recommendation: 'Remove tracked .env files and commit only .env.example with placeholder values.',
      });
    }

    const highRiskPattern = /(id_rsa|id_dsa|\.pem$|\.p12$|\.pfx$|\.key$|service-account.*\.json$|credentials\.json$)/;
    for (const path of repoPaths) {
      const lower = path.toLowerCase();
      if (highRiskPattern.test(lower)) {
        findings.push({
          severity: 'high',
          path,
          finding: 'Potential private key or cloud credential file detected in repository tree.',
          recommendation: 'Rotate exposed credentials immediately and move secrets to a secure secret manager.',
        });
      }

      if (/(secret|token|apikey|api_key|password)/.test(lower) && /\.txt$|\.json$|\.env$/.test(lower)) {
        findings.push({
          severity: 'medium',
          path,
          finding: 'File path indicates possible committed secret material.',
          recommendation: 'Run a full secret scan and replace sensitive values with injected runtime variables.',
        });
      }
    }

    return findings.slice(0, 12);
  }

  private readinessBand(score: number) {
    if (score >= 85) return 'production-ready';
    if (score >= 70) return 'staging-ready';
    if (score >= 50) return 'development-ready';
    return 'early';
  }

  private hasEntry(entries: string[], expected: string[]) {
    const normalized = entries.map((entry) => entry.toLowerCase());
    return expected.some((value) => normalized.some((entry) => entry.includes(value.toLowerCase())));
  }

  private toGithubRawUrl(repoUrl: string, branch: string, path = 'package.json') {
    const normalized = repoUrl.replace(/\.git$/, '');
    if (normalized.includes('raw.githubusercontent.com')) {
      return normalized;
    }

    const match = normalized.match(/github.com\/(.+?)\/(.+?)(?:$|#|\/)/);
    if (!match) {
      throw new BadRequestException('Unsupported repo URL; provide a GitHub URL or raw package.json URL');
    }

    const owner = match[1];
    const repo = match[2];
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }

  private fetchRemoteText(url: string, token?: string, errorMessage?: (status?: number) => string | undefined): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: 'GET',
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'DevMat-AI',
              }
            : {
                'User-Agent': 'DevMat-AI',
              },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            const message = errorMessage?.(res.statusCode) || `Failed to fetch remote file (status ${res.statusCode})`;
            reject(new BadRequestException(message));
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        },
      );

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  private async fetchFirstAvailablePackageJson(repoUrl: string, branch: string, token?: string) {
    const { owner, repo } = this.parseGithubRepo(repoUrl);
    const rootEntries = await this.listGithubRootEntriesDetailed(owner, repo, branch, token);

    const prioritizedDirs = rootEntries
      .filter((item) => item.type === 'dir')
      .map((item) => item.name)
      .filter((name) => /^(frontend|backend|web|api|apps|app|client|server)/i.test(name));

    const possiblePaths = [
      'package.json',
      'frontend/package.json',
      'backend/package.json',
      ...prioritizedDirs.map((dir) => `${dir}/package.json`),
    ];

    const attempted: string[] = [];

    for (const path of possiblePaths) {
      const url = this.toGithubRawUrl(repoUrl, branch, path);
      try {
        const content = await this.fetchRemoteText(url, token, (status) => {
          if (status === 404) return 'not_found';
          return undefined;
        });
        return { content, path };
      } catch (err) {
        attempted.push(path);
        if (!(err instanceof BadRequestException) || (err.message && !err.message.includes('not_found'))) {
          throw err;
        }
      }
    }

    throw new BadRequestException(
      `No package.json found on branch ${branch}. Tried: ${attempted.join(', ')}. Place a package.json at repo root or add one under frontend/ or backend/.`,
    );
  }

  private async buildRepoAnalysisContext(repoUrl: string, branch: string, token?: string): Promise<RepoAnalysisContext> {
    const { owner, repo } = this.parseGithubRepo(repoUrl);
    const rootEntriesDetailed = await this.listGithubRootEntriesDetailed(owner, repo, branch, token);
    const rootEntries = rootEntriesDetailed.map((item) => item.name);
    const treePaths = await this.fetchGithubTreePaths(owner, repo, branch, token);
    const allPaths = treePaths.length > 0 ? treePaths : rootEntries;

    const packagePaths = this.rankRepoPaths(
      allPaths.filter((path) => path.endsWith('/package.json') || path === 'package.json'),
      8,
    );

    const packageFiles: RepoPackageDescriptor[] = [];
    for (const packagePath of packagePaths) {
      const content = await this.fetchOptionalRepoFile(repoUrl, branch, packagePath, token);
      if (!content) continue;

      try {
        packageFiles.push({
          path: packagePath,
          packageJson: this.parsePackageJson(content),
        });
      } catch {
        // Ignore non-JSON package manifests.
      }
    }

    if (packageFiles.length === 0) {
      const fallback = await this.fetchFirstAvailablePackageJson(repoUrl, branch, token);
      packageFiles.push({ path: fallback.path, packageJson: this.parsePackageJson(fallback.content) });
    }

    const envFileCandidates = this.rankRepoPaths(
      allPaths.filter((path) => /(^|\/)\.env(\.example|\.sample)?$/i.test(path)),
      5,
    );
    const infraFileCandidates = this.rankRepoPaths(
      allPaths.filter((path) => this.isInfrastructurePath(path)),
      15,
    );
    const repoDocCandidates = this.rankRepoPaths(
      allPaths.filter((path) => this.isRepoDocPath(path)),
      5,
    );

    const snippetPaths = this.rankRepoPaths([
      ...envFileCandidates,
      ...infraFileCandidates,
      ...repoDocCandidates,
    ], 18);

    const snippets: Array<{ path: string; content: string }> = [];
    for (const path of snippetPaths) {
      const content = await this.fetchOptionalRepoFile(repoUrl, branch, path, token);
      if (!content) continue;
      snippets.push({ path, content: content.slice(0, 2000) });
    }

    const existingConfig = snippets
      .map((snippet) => `### ${snippet.path}\n${snippet.content}`)
      .join('\n\n')
      .slice(0, 12000);

    const packageSummaries = packageFiles
      .map((pkg) => {
        const scripts = Object.keys(pkg.packageJson.scripts ?? {});
        const deps = Object.keys(pkg.packageJson.dependencies ?? {}).slice(0, 20);
        const devDeps = Object.keys(pkg.packageJson.devDependencies ?? {}).slice(0, 12);
        return [
          `- ${pkg.path}`,
          `  name: ${pkg.packageJson.name || 'unknown'}`,
          `  scripts: ${scripts.join(', ') || 'none'}`,
          `  deps: ${deps.join(', ') || 'none'}`,
          `  devDeps: ${devDeps.join(', ') || 'none'}`,
        ].join('\n');
      })
      .join('\n');

    const topDirs = rootEntriesDetailed
      .filter((entry) => entry.type === 'dir')
      .map((entry) => entry.name)
      .slice(0, 20)
      .join(', ');

    const existingInfraPaths = this.rankRepoPaths(
      allPaths.filter((path) => this.isInfrastructurePath(path)),
      30,
    );

    const envKeys = this.extractEnvKeys(snippets.map((snippet) => snippet.content).join('\n'));

    const promptContext = [
      `Repository: ${repoUrl}`,
      `Branch: ${branch}`,
      `Top-level directories: ${topDirs || 'none'}`,
      '',
      'Detected package manifests:',
      packageSummaries || '- none',
      '',
      `Existing infrastructure files: ${existingInfraPaths.join(', ') || 'none'}`,
      `Environment variable keys detected: ${envKeys.join(', ') || 'none'}`,
      '',
      'Repository snippets:',
      existingConfig || 'No config snippets found.',
    ].join('\n').slice(0, 14000);

    const primaryPackage = packageFiles[0]?.packageJson;
    const summary = primaryPackage?.description || `Repository analysis for ${repo}`;

    return {
      rootEntries,
      repoPaths: allPaths,
      packageFiles,
      existingConfig,
      promptContext,
      summary,
    };
  }

  private mergeRepoPackagesToPseudoPackage(projectName: string, packageFiles: RepoPackageDescriptor[]) {
    const mergedDependencies: Record<string, string> = {};
    const mergedDevDependencies: Record<string, string> = {};
    const packageManagers: string[] = [];

    for (const pkg of packageFiles) {
      Object.assign(mergedDependencies, pkg.packageJson.dependencies ?? {});
      Object.assign(mergedDevDependencies, pkg.packageJson.devDependencies ?? {});
      if (typeof pkg.packageJson.packageManager === 'string') {
        packageManagers.push(pkg.packageJson.packageManager);
      }
    }

    return {
      name: projectName,
      dependencies: mergedDependencies,
      devDependencies: mergedDevDependencies,
      packageManager: packageManagers[0] ?? 'npm',
    };
  }

  private async fetchGithubTreePaths(owner: string, repo: string, branch: string, token?: string): Promise<string[]> {
    try {
      const result = await this.fetchGithubJson<{ tree?: Array<{ path?: string; type?: string }> }>(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        token,
      );

      return (result.tree ?? [])
        .map((entry) => entry.path)
        .filter((path): path is string => Boolean(path))
        .filter((path) => !path.includes('node_modules/') && !path.includes('.git/'));
    } catch {
      return [];
    }
  }

  private async fetchRepoPackageDescriptors(
    owner: string,
    repo: string,
    branch: string,
    token?: string,
  ): Promise<RepoPackageDescriptor[]> {
    const treePaths = await this.fetchGithubTreePaths(owner, repo, branch, token);
    const packagePaths = this.rankRepoPaths(
      treePaths.filter((path) => path.endsWith('/package.json') || path === 'package.json'),
      10,
    );

    const files: RepoPackageDescriptor[] = [];
    for (const packagePath of packagePaths) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${packagePath}`;
      try {
        const content = await this.fetchRemoteText(rawUrl, token, (status) => {
          if (status === 404) return 'not_found';
          return undefined;
        });
        files.push({
          path: packagePath,
          packageJson: this.parsePackageJson(content),
        });
      } catch (err) {
        if (err instanceof BadRequestException && (err.message || '').includes('not_found')) {
          continue;
        }
        throw err;
      }
    }

    if (files.length === 0) {
      const fallback = await this.fetchRemoteText(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`,
        token,
      );
      files.push({ path: 'package.json', packageJson: this.parsePackageJson(fallback) });
    }

    return files;
  }

  private async fetchOptionalRepoFile(repoUrl: string, branch: string, path: string, token?: string): Promise<string | undefined> {
    const url = this.toGithubRawUrl(repoUrl, branch, path);
    try {
      return await this.fetchRemoteText(url, token, (status) => {
        if (status === 404) return 'not_found';
        return undefined;
      });
    } catch (err) {
      if (err instanceof BadRequestException && (err.message || '').includes('not_found')) {
        return undefined;
      }

      throw err;
    }
  }

  private rankRepoPaths(paths: string[], limit: number): string[] {
    const unique = Array.from(new Set(paths));
    const rankScore = (path: string) => {
      let score = path.split('/').length;
      if (/(^|\/)package\.json$/i.test(path)) score -= 3;
      if (/^(frontend|backend|apps|app|services)\//i.test(path)) score -= 2;
      if (/docker|compose|k8s|kubernetes|workflow|github|helm|terraform|env/i.test(path)) score -= 2;
      return score;
    };

    return unique.sort((a, b) => rankScore(a) - rankScore(b)).slice(0, limit);
  }

  private isInfrastructurePath(path: string): boolean {
    return /(^|\/)(Dockerfile|docker-compose(\.ya?ml)?|compose\.ya?ml|\.github\/workflows\/.*\.ya?ml|k8s\/|kubernetes\/|helm\/|terraform\/|.*\.tf$|.*\.env(\.example|\.sample)?)$/i.test(path);
  }

  private isRepoDocPath(path: string): boolean {
    return /(^|\/)(README\.md|readme\.md|next\.config\.(js|ts|mjs)|nest-cli\.json|vite\.config\.(js|ts|mjs)|requirements\.txt|pyproject\.toml|go\.mod|pom\.xml|build\.gradle)$/i.test(path);
  }

  private extractEnvKeys(content: string): string[] {
    const keys = new Set<string>();
    const lines = content.split('\n');

    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned || cleaned.startsWith('#')) continue;
      const match = cleaned.match(/^([A-Z][A-Z0-9_]{1,})\s*=/);
      if (match) keys.add(match[1]);
      if (keys.size >= 30) break;
    }

    return Array.from(keys);
  }

  private mergePromptSections(primary?: string, secondary?: string): string | undefined {
    const sections = [primary?.trim(), secondary?.trim()].filter(Boolean) as string[];
    if (sections.length === 0) return undefined;
    return sections.join('\n\n').slice(0, 16000);
  }

  private repoAwareStrictDevopsInstructions(repoContext?: string): string {
    const strictRules = [
      'You are a Senior DevOps Engineer with expertise in Docker, Kubernetes, CI/CD, AWS/GCP, and full-stack production deployments.',
      'Analyze the provided repository context and generate a COMPLETE, PRODUCTION-READY DevOps setup.',
      'Do NOT produce boilerplate or generic templates.',
      'All Docker, compose, and CI/CD commands must match detected scripts/dependencies/project layout.',
      'Auto-detect frontend/backend separation, required services (db/cache/worker), env wiring, and runtime ports.',
      'Output should be deployment-ready with minimal manual edits.',
    ].join('\n');

    if (!repoContext?.trim()) {
      return strictRules;
    }

    return [
      strictRules,
      '',
      'Repository analysis context:',
      repoContext,
    ].join('\n').slice(0, 18000);
  }

  private fetchGithubJson<T>(url: string, token?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'DevMat-AI',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
              const raw = Buffer.concat(chunks).toString('utf-8');
              let detail: string | undefined;
              try {
                const parsed = JSON.parse(raw) as { message?: string };
                detail = parsed?.message;
              } catch {
                detail = raw?.trim() || undefined;
              }

              if (res.statusCode === 401) {
                reject(new BadRequestException('GitHub authentication failed (status 401).'));
                return;
              }

              const suffix = detail ? `: ${detail}` : '';
              reject(new BadRequestException(`GitHub API request failed (status ${res.statusCode})${suffix}`));
            });
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T);
            } catch {
              reject(new BadRequestException('Invalid JSON from GitHub API'));
            }
          });
        },
      );

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  private githubConfig() {
    const clientId = this.configService.get<string>('github.clientId', { infer: true });
    const clientSecret = this.configService.get<string>('github.clientSecret', { infer: true });
    const redirectUri = this.configService.get<string>('github.redirectUri', { infer: true });

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI.');
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
      scope: 'repo read:org workflow',
    };
  }

  private async exchangeGithubCodeForToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUri } = this.githubConfig();
    const payload = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent': 'DevMat-AI',
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as { access_token?: string; error?: string; error_description?: string };
              if (parsed.error || !parsed.access_token) {
                reject(new BadRequestException(parsed.error_description || parsed.error || 'GitHub token exchange failed'));
                return;
              }
              resolve(parsed.access_token);
            } catch {
              reject(new BadRequestException('Invalid token exchange response from GitHub'));
            }
          });
        },
      );

      req.on('error', (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }

  private async fetchGithubProfile(token: string): Promise<{ login: string; avatar_url?: string }> {
    return this.fetchGithubJson<{ login: string; avatar_url?: string }>('https://api.github.com/user', token);
  }

  private async fetchGithubRepoMeta(owner: string, repo: string, token?: string) {
    return this.fetchGithubJson<{
      default_branch: string;
      stargazers_count: number;
      open_issues_count: number;
      description: string | null;
    }>(`https://api.github.com/repos/${owner}/${repo}`, token);
  }

  private async fetchGithubLanguages(owner: string, repo: string, token?: string) {
    return this.fetchGithubJson<Record<string, number>>(
      `https://api.github.com/repos/${owner}/${repo}/languages`,
      token,
    );
  }

  private async fetchGithubRootEntries(owner: string, repo: string, branch: string, token?: string): Promise<string[]> {
    const items = await this.listGithubRootEntriesDetailed(owner, repo, branch, token);
    return items.map((item) => item.name);
  }

  private async listGithubRootEntriesDetailed(
    owner: string,
    repo: string,
    branch: string,
    token?: string,
  ): Promise<Array<{ name: string; type: 'file' | 'dir' | string }>> {
    return this.fetchGithubJson<Array<{ name: string; type: string }>>(
      `https://api.github.com/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(branch)}`,
      token,
    );
  }

  private parseGithubRepo(repoUrl: string): { owner: string; repo: string } {
    const normalized = repoUrl.replace(/\.git$/, '');
    const match = normalized.match(/github.com\/([^/]+)\/([^/#?]+)/i);
    if (!match) {
      throw new BadRequestException('Unsupported GitHub URL. Use format: https://github.com/org/repo');
    }

    return { owner: match[1], repo: match[2] };
  }

  private async getStoredGithubToken(userId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { githubTokenEnc: true },
    });

    if (!user?.githubTokenEnc) {
      return undefined;
    }

    return this.decryptToken(user.githubTokenEnc);
  }

  private async clearStoredGithubConnection(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        githubUsername: null,
        githubAvatarUrl: null,
        githubTokenEnc: null,
        githubConnectedAt: null,
      },
    });
  }

  private isGithubUnauthorizedError(err: unknown): boolean {
    return err instanceof BadRequestException && (err.message || '').includes('status 401');
  }

  private encryptToken(raw: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.tokenCryptoKey(), iv);
    const encrypted = Buffer.concat([cipher.update(raw, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
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
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(cipherB64, 'base64url')),
        decipher.final(),
      ]);
      return decrypted.toString('utf-8');
    } catch {
      return undefined;
    }
  }

  private tokenCryptoKey() {
    const secret = this.configService.getOrThrow<string>('jwtSecret', { infer: true });
    return createHash('sha256').update(secret).digest();
  }

  private nameFromRepo(repoUrl: string) {
    const parts = repoUrl.split('/').filter(Boolean);
    return parts[parts.length - 1]?.replace('.git', '') || 'project';
  }

  private async resolveProjectAndAnalysis(userId: string, dto: GenerateInfraDto): Promise<{ project: Project; analysis: AnalysisResult }> {
    if (!dto.projectId && !dto.analysisJson) {
      throw new BadRequestException('Provide projectId or analysisJson');
    }

    if (dto.analysisJson) {
      return {
        project: {
          id: 'ephemeral',
          userId,
          name: 'project',
          repoUrl: null,
          sourceType: SourceType.packageJson,
          cloudTarget: dto.cloudTarget,
          summary: null,
          detectedStack: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Project,
        analysis: JSON.parse(dto.analysisJson) as AnalysisResult,
      };
    }

    const project = await this.prisma.project.findFirst({
      where: {
        id: dto.projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const latestVersion = await this.prisma.projectVersion.findFirst({
      where: { projectId: project.id },
      orderBy: { generatedAt: 'desc' },
    });

    if (!latestVersion) {
      throw new NotFoundException('No analysis found for project');
    }

    return { project, analysis: latestVersion.analysis as AnalysisResult };
  }
}

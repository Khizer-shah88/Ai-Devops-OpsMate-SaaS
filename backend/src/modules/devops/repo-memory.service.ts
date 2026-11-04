import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CloudTarget, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpsertRepoMemoryDto } from './dto/repo-memory.dto';

@Injectable()
export class RepoMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  parseGithubRepo(repoUrl: string): { owner: string; repo: string; repoUrl: string } {
    const normalized = repoUrl.trim().replace(/\.git$/, '');
    const match = normalized.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (!match) {
      throw new BadRequestException('Unsupported GitHub URL. Use format: https://github.com/org/repo');
    }
    const owner = match[1];
    const repo = match[2];
    return {
      owner,
      repo,
      repoUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  private asJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }

  async list(userId: string, limit = 20) {
    const take = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 50) : 20;
    return this.prisma.repoMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take,
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  async getByRepo(userId: string, repoUrl: string) {
    const parsed = this.parseGithubRepo(repoUrl);
    const memory = await this.prisma.repoMemory.findUnique({
      where: {
        repo_memory_user_repo_url: {
          userId,
          repoUrl: parsed.repoUrl,
        },
      },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
    });

    if (!memory) {
      throw new NotFoundException('No memory found for this repository yet');
    }

    return memory;
  }

  async upsert(userId: string, dto: UpsertRepoMemoryDto) {
    const parsed = this.parseGithubRepo(dto.repoUrl);

    const memory = await this.prisma.repoMemory.upsert({
      where: {
        repo_memory_user_repo_url: {
          userId,
          repoUrl: parsed.repoUrl,
        },
      },
      create: {
        userId,
        repoUrl: parsed.repoUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        lastBranch: dto.branch,
        cloudTarget: dto.cloudTarget,
        analysis: this.asJson(dto.analysis),
        readiness: this.asJson(dto.readiness),
        lastVersionId: dto.lastVersionId,
        notes: dto.notes,
      },
      update: {
        lastBranch: dto.branch ?? undefined,
        cloudTarget: dto.cloudTarget ?? undefined,
        analysis: this.asJson(dto.analysis),
        readiness: this.asJson(dto.readiness),
        lastVersionId: dto.lastVersionId ?? undefined,
        notes: dto.notes ?? undefined,
      },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (dto.eventType && dto.eventSummary) {
      await this.prisma.repoMemoryEvent.create({
        data: {
          memoryId: memory.id,
          type: dto.eventType,
          summary: dto.eventSummary,
          payload: this.asJson(dto.eventPayload),
        },
      });
    }

    return this.prisma.repoMemory.findUniqueOrThrow({
      where: { id: memory.id },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
    });
  }

  async recordEvent(
    userId: string,
    repoUrl: string,
    type: string,
    summary: string,
    payload?: Record<string, unknown>,
    extras?: {
      branch?: string;
      cloudTarget?: CloudTarget;
      analysis?: Record<string, unknown>;
      readiness?: Record<string, unknown>;
      lastVersionId?: string;
      lastPrUrl?: string;
      lastPrNumber?: number;
      lastActionsRunId?: string;
      lastActionsStatus?: string;
    },
  ) {
    const parsed = this.parseGithubRepo(repoUrl);

    const memory = await this.prisma.repoMemory.upsert({
      where: {
        repo_memory_user_repo_url: {
          userId,
          repoUrl: parsed.repoUrl,
        },
      },
      create: {
        userId,
        repoUrl: parsed.repoUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        lastBranch: extras?.branch,
        cloudTarget: extras?.cloudTarget,
        analysis: this.asJson(extras?.analysis),
        readiness: this.asJson(extras?.readiness),
        lastVersionId: extras?.lastVersionId,
        lastPrUrl: extras?.lastPrUrl,
        lastPrNumber: extras?.lastPrNumber,
        lastActionsRunId: extras?.lastActionsRunId,
        lastActionsStatus: extras?.lastActionsStatus,
      },
      update: {
        lastBranch: extras?.branch ?? undefined,
        cloudTarget: extras?.cloudTarget ?? undefined,
        analysis: this.asJson(extras?.analysis),
        readiness: this.asJson(extras?.readiness),
        lastVersionId: extras?.lastVersionId ?? undefined,
        lastPrUrl: extras?.lastPrUrl ?? undefined,
        lastPrNumber: extras?.lastPrNumber ?? undefined,
        lastActionsRunId: extras?.lastActionsRunId ?? undefined,
        lastActionsStatus: extras?.lastActionsStatus ?? undefined,
      },
    });

    await this.prisma.repoMemoryEvent.create({
      data: {
        memoryId: memory.id,
        type,
        summary,
        payload: this.asJson(payload),
      },
    });

    return memory;
  }
}

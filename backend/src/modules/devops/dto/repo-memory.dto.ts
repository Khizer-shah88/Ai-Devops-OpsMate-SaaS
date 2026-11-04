import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CloudTarget } from '@prisma/client';

export class UpsertRepoMemoryDto {
  @IsString()
  repoUrl!: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsEnum(CloudTarget)
  @IsOptional()
  cloudTarget?: CloudTarget;

  @IsObject()
  @IsOptional()
  analysis?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  readiness?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  lastVersionId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsOptional()
  eventType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  eventSummary?: string;

  @IsObject()
  @IsOptional()
  eventPayload?: Record<string, unknown>;
}

import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CloudTarget } from '@prisma/client';

export class GenerateInfraDto {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  repoUrl?: string;

  @IsString()
  @IsOptional()
  branch?: string = 'main';

  @IsString()
  @IsOptional()
  githubToken?: string;

  @IsEnum(CloudTarget)
  cloudTarget: CloudTarget;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  existingConfig?: string;

  @IsString()
  @IsOptional()
  userRequest?: string;

  @IsString()
  @IsOptional()
  analysisJson?: string;

  @IsString()
  @IsOptional()
  actionType?: 'generate' | 'modify' | 'validate' | 'explain';
}

import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CloudTarget, SourceType } from '@prisma/client';

export class AnalyzeRepoDto {
  @IsString()
  repoUrl: string;

  @IsString()
  @IsOptional()
  branch?: string = 'main';

  @IsString()
  @IsOptional()
  githubToken?: string;

  @IsEnum(CloudTarget)
  @IsOptional()
  cloudTarget?: CloudTarget;

  @IsEnum(SourceType)
  @IsOptional()
  sourceType?: SourceType = SourceType.github;

  @IsString()
  @IsOptional()
  projectName?: string;
}

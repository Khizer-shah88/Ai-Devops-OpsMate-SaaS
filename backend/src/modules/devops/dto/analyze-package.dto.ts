import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CloudTarget, SourceType } from '@prisma/client';

export class AnalyzePackageDto {
  @IsString()
  packageJson: string;

  @IsString()
  @IsOptional()
  projectName?: string;

  @IsString()
  @IsOptional()
  repoUrl?: string;

  @IsEnum(SourceType)
  @IsOptional()
  sourceType?: SourceType = SourceType.packageJson;

  @IsEnum(CloudTarget)
  @IsOptional()
  cloudTarget?: CloudTarget;
}

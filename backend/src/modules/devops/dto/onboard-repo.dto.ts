import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { CloudTarget } from '@prisma/client';

export class OnboardRepoDto {
  @IsString()
  repoUrl: string;

  @IsString()
  @IsOptional()
  branch?: string = 'main';

  @IsString()
  @IsOptional()
  projectName?: string;

  @IsString()
  @IsOptional()
  githubToken?: string;

  @IsEnum(CloudTarget)
  @IsOptional()
  cloudTarget?: CloudTarget;

  @IsBoolean()
  @IsOptional()
  autoGenerateInfra?: boolean = true;
}

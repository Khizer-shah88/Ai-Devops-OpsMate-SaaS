import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CloudTarget } from '@prisma/client';

export class ImproveConfigDto {
  @IsString()
  projectVersionId: string;

  @IsString()
  filePath: string;

  @IsString()
  currentContent: string;

  @IsString()
  @IsOptional()
  userRequest?: string;

  @IsEnum(CloudTarget)
  @IsOptional()
  cloudTarget?: CloudTarget;
}

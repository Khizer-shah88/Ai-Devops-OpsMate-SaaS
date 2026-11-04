import { IsOptional, IsString } from 'class-validator';

export class ActionsDebugDto {
  @IsString()
  repoUrl!: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsString()
  @IsOptional()
  runId?: string;
}

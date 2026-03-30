import { IsOptional, IsString } from 'class-validator';

export class LogAnalyzerDto {
  @IsString()
  log: string;

  @IsString()
  @IsOptional()
  context?: string;
}

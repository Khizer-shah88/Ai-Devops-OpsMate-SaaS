import { IsString, IsOptional, IsIn } from 'class-validator';

export class CicdDto {
  @IsString()
  @IsOptional()
  projectDescription?: string;

  @IsString()
  @IsOptional()
  stackInfo?: string;

  @IsString()
  @IsOptional()
  cloudProvider?: string;

  @IsString()
  @IsOptional()
  mode?: string;

  @IsString()
  @IsOptional()
  existingConfig?: string;

  @IsString()
  @IsOptional()
  userRequest?: string;

  @IsString()
  @IsOptional()
  @IsIn(['generate', 'modify', 'validate', 'explain'])
  actionType?: string;
}

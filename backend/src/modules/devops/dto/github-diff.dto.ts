import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested, ArrayMinSize } from 'class-validator';

class DiffFileDto {
  @IsString()
  path!: string;

  @IsString()
  content!: string;
}

export class GithubDiffDto {
  @IsString()
  repoUrl!: string;

  @IsString()
  @IsOptional()
  branch?: string = 'main';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DiffFileDto)
  files!: DiffFileDto[];
}

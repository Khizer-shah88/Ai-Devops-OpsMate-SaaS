import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class ApplyFileDto {
  @IsString()
  path!: string;

  @IsString()
  content!: string;
}

export class ApplyPrDto {
  @IsString()
  repoUrl!: string;

  @IsString()
  @IsOptional()
  baseBranch?: string = 'main';

  @IsString()
  @IsOptional()
  @MaxLength(80)
  headBranch?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  body?: string;

  @IsString()
  @IsOptional()
  versionId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApplyFileDto)
  files!: ApplyFileDto[];
}

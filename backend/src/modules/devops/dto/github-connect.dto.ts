import { IsString, MinLength } from 'class-validator';

export class GithubConnectDto {
  @IsString()
  @MinLength(20)
  accessToken: string;
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DebugDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(60000)
	errorLog: string;
}

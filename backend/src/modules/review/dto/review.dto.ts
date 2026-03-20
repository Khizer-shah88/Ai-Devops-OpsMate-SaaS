import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReviewDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(30000)
	code: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	language: string;
}

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewDto } from './dto/review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class ReviewController {
	constructor(private readonly reviewService: ReviewService) {}

	@UseGuards(JwtAuthGuard)
	@Post('review-code')
	reviewCode(@CurrentUser() user: JwtUser, @Body() dto: ReviewDto) {
		return this.reviewService.runReview(user.sub, dto);
	}
}

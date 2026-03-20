import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
	constructor(
		private readonly aiService: AiService,
		private readonly prisma: PrismaService,
	) {}

	async runReview(userId: string, dto: ReviewDto) {
		const result = await this.aiService.reviewCode(dto.code, dto.language);

		await this.prisma.request.create({
			data: {
				userId,
				type: 'review',
				input: JSON.stringify(dto),
				output: JSON.stringify(result),
			},
		});

		return result;
	}
}

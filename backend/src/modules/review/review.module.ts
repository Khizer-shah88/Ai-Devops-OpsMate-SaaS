import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { AiModule } from '../ai/ai.module';

@Module({
	imports: [AiModule],
	controllers: [ReviewController],
	providers: [ReviewService],
})
export class ReviewModule {}

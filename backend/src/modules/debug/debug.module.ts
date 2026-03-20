import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';
import { AiModule } from '../ai/ai.module';

@Module({
	imports: [AiModule],
	controllers: [DebugController],
	providers: [DebugService],
})
export class DebugModule {}

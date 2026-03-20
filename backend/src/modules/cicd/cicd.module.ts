import { Module } from '@nestjs/common';
import { CicdController } from './cicd.controller';
import { CicdService } from './cicd.service';
import { AiModule } from '../ai/ai.module';

@Module({
	imports: [AiModule],
	controllers: [CicdController],
	providers: [CicdService],
})
export class CicdModule {}

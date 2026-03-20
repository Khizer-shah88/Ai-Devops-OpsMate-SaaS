import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DebugDto } from './dto/debug.dto';

@Injectable()
export class DebugService {
	constructor(
		private readonly aiService: AiService,
		private readonly prisma: PrismaService,
	) {}

	async runDebug(userId: string, dto: DebugDto) {
		const result = await this.aiService.debugError(dto.errorLog);

		await this.prisma.request.create({
			data: {
				userId,
				type: 'debug',
				input: JSON.stringify(dto),
				output: JSON.stringify(result),
			},
		});

		return result;
	}
}

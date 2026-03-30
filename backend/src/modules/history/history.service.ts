import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class HistoryService {
	constructor(private readonly prisma: PrismaService) {}

	async getHistory(userId: string) {
		const items = await this.prisma.request.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			take: 100,
		});

		return items.map((item) => ({
			...item,
			input: this.safeParse(item.input),
			output: this.safeParse(item.output),
		}));
	}

	async getUsageStats(userId: string) {
		const [totalRequests, reviewCount, debugCount, cicdCount] = await Promise.all([
			this.prisma.request.count({ where: { userId } }),
			this.prisma.request.count({ where: { userId, type: 'review' } }),
			this.prisma.request.count({ where: { userId, type: 'debug' } }),
			this.prisma.request.count({ where: { userId, type: 'cicd' } }),
		]);

		return {
			totalRequests,
			byType: {
				review: reviewCount,
				debug: debugCount,
				cicd: cicdCount,
			},
		};
	}

	async deleteHistoryItem(userId: string, requestId: string) {
		const deleted = await this.prisma.request.deleteMany({
			where: {
				id: requestId,
				userId,
			},
		});

		return {
			deleted: deleted.count > 0,
		};
	}

	async clearHistory(userId: string) {
		const deleted = await this.prisma.request.deleteMany({
			where: { userId },
		});

		return {
			deletedCount: deleted.count,
		};
	}

	private safeParse(input: string): unknown {
		try {
			return JSON.parse(input);
		} catch {
			return input;
		}
	}
}

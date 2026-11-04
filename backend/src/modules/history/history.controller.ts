import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class HistoryController {
	constructor(private readonly historyService: HistoryService) {}

	@UseGuards(JwtAuthGuard)
	@Get('history')
	getHistory(
		@CurrentUser() user: JwtUser,
		@Query('stats') stats?: string,
		@Query('limit') limit?: string,
	) {
		if (stats === 'true') {
			return this.historyService.getUsageStats(user.sub);
		}

		const parsedLimit = limit ? Number(limit) : undefined;
		return this.historyService.getHistory(user.sub, parsedLimit);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('history/:id')
	deleteHistoryItem(
		@CurrentUser() user: JwtUser,
		@Param('id') id: string,
	) {
		return this.historyService.deleteHistoryItem(user.sub, id);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('history')
	clearHistory(@CurrentUser() user: JwtUser) {
		return this.historyService.clearHistory(user.sub);
	}
}

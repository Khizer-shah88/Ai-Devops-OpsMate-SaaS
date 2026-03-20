import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
	) {
		if (stats === 'true') {
			return this.historyService.getUsageStats(user.sub);
		}

		return this.historyService.getHistory(user.sub);
	}
}

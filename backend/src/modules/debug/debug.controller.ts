import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DebugService } from './debug.service';
import { DebugDto } from './dto/debug.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class DebugController {
	constructor(private readonly debugService: DebugService) {}

	@UseGuards(JwtAuthGuard)
	@Post('debug-error')
	debugError(@CurrentUser() user: JwtUser, @Body() dto: DebugDto) {
		return this.debugService.runDebug(user.sub, dto);
	}
}

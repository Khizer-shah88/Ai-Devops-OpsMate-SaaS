import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CicdService } from './cicd.service';
import { CicdDto } from './dto/cicd.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type { CicdOutput } from '../ai/ai.service';

@Controller()
export class CicdController {
	constructor(private readonly cicdService: CicdService) {}

	@UseGuards(JwtAuthGuard)
	@Post('generate-cicd')
	generateCicd(
		@CurrentUser() user: JwtUser,
		@Body() dto: CicdDto,
	): Promise<CicdOutput> {
		return this.cicdService.generate(user.sub, dto);
	}
}

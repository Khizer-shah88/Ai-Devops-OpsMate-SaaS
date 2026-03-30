import { Body, Controller, Delete, Get, Param, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { DevopsService } from './devops.service';
import { AnalyzePackageDto } from './dto/analyze-package.dto';
import { GenerateInfraDto } from './dto/generate-infra.dto';
import { ImproveConfigDto } from './dto/improve-config.dto';
import { LogAnalyzerDto } from './dto/log-analyzer.dto';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';
import { GithubConnectDto } from './dto/github-connect.dto';
import { OnboardRepoDto } from './dto/onboard-repo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('devops')
@UseGuards(JwtAuthGuard)
export class DevopsController {
  constructor(private readonly devopsService: DevopsService) {}

  @Get('github/oauth/start')
  getGithubOauthUrl(@CurrentUser() user: JwtUser, @Query('redirectPath') redirectPath?: string) {
    return this.devopsService.getGithubOauthUrl(user.sub, redirectPath);
  }

  @Post('analyze-package')
  analyzePackage(@CurrentUser() user: JwtUser, @Body() dto: AnalyzePackageDto) {
    return this.devopsService.analyzePackage(user.sub, dto);
  }

  @Post('generate-infra')
  generateInfra(@CurrentUser() user: JwtUser, @Body() dto: GenerateInfraDto) {
    return this.devopsService.generateInfra(user.sub, dto);
  }

  @Post('analyze-repo')
  analyzeRepo(@CurrentUser() user: JwtUser, @Body() dto: AnalyzeRepoDto) {
    return this.devopsService.analyzeRepo(user.sub, dto);
  }

  @Post('readiness-scan')
  readinessScan(@CurrentUser() user: JwtUser, @Body() dto: AnalyzeRepoDto) {
    return this.devopsService.scanRepoReadiness(user.sub, dto);
  }

  @Post('onboard-repo')
  onboardRepo(@CurrentUser() user: JwtUser, @Body() dto: OnboardRepoDto) {
    return this.devopsService.onboardRepo(user.sub, dto);
  }

  @Post('github/connect')
  connectGithub(@CurrentUser() user: JwtUser, @Body() dto: GithubConnectDto) {
    return this.devopsService.connectGithub(user.sub, dto.accessToken);
  }

  @Delete('github/connect')
  disconnectGithub(@CurrentUser() user: JwtUser) {
    return this.devopsService.disconnectGithub(user.sub);
  }

  @Get('github/status')
  githubStatus(@CurrentUser() user: JwtUser) {
    return this.devopsService.getGithubStatus(user.sub);
  }

  @Get('github/repos')
  listGithubRepos(
    @CurrentUser() user: JwtUser,
    @Query('limit') limit?: string,
  ) {
    return this.devopsService.listGithubRepos(user.sub, Number(limit || 15));
  }

  @Post('improve-config')
  improveConfig(@CurrentUser() user: JwtUser, @Body() dto: ImproveConfigDto) {
    return this.devopsService.improveConfig(user.sub, dto);
  }

  @Post('log-analyzer')
  analyzeLog(@Body() dto: LogAnalyzerDto) {
    return this.devopsService.analyzeLog(dto);
  }

  @Get('projects')
  listProjects(@CurrentUser() user: JwtUser) {
    return this.devopsService.listProjects(user.sub);
  }

  @Get('generated/latest')
  latestGenerated(@CurrentUser() user: JwtUser) {
    return this.devopsService.getLatestGeneratedBundle(user.sub);
  }

  @Get('chat/:id')
  getChat(@Param('id') id: string) {
    return this.devopsService.getChat(id);
  }
}

@Controller('devops/github/oauth')
export class DevopsOauthController {
  constructor(private readonly devopsService: DevopsService) {}

  @Get('callback')
  @Redirect()
  async githubOauthCallback(@Query('code') code?: string, @Query('state') state?: string) {
    const result = await this.devopsService.handleGithubOauthCallback(code, state);
    return { url: result.redirectTo };
  }
}

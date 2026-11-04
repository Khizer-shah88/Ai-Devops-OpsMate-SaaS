import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DevopsService } from './devops.service';
import { DevopsController, DevopsOauthController } from './devops.controller';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { GithubOpsService } from './github-ops.service';
import { RepoMemoryService } from './repo-memory.service';

@Module({
  imports: [
    ConfigModule,
    AiModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret', { infer: true }),
        signOptions: { expiresIn: '10m' },
      }),
    }),
  ],
  controllers: [DevopsController, DevopsOauthController],
  providers: [DevopsService, GithubOpsService, RepoMemoryService],
  exports: [DevopsService, GithubOpsService, RepoMemoryService],
})
export class DevopsModule {}

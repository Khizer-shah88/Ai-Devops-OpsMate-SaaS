import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DevopsService } from './devops.service';
import { DevopsController, DevopsOauthController } from './devops.controller';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../../database/prisma/prisma.module';

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
  providers: [DevopsService],
  exports: [DevopsService],
})
export class DevopsModule {}

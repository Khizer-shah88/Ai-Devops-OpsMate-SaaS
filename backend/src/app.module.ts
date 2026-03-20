import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiModule } from './modules/ai/ai.module';
import { ReviewModule } from './modules/review/review.module';
import { DebugModule } from './modules/debug/debug.module';
import { CicdModule } from './modules/cicd/cicd.module';
import { HistoryModule } from './modules/history/history.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      load: [configuration],
      validationSchema,
    }),
    PrismaModule,
    AuthModule,
    AiModule,
    ReviewModule,
    DebugModule,
    CicdModule,
    HistoryModule,
  ],
})
export class AppModule {}

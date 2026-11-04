import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHello(): string {
    return 'DevMat AI API';
  }

  getHealth() {
    const apiKey = this.configService.get<string>('openAiApiKey')?.trim() ?? '';
    const model = this.configService.get<string>('openAiModel') ?? 'gpt-4.1-mini';
    const baseUrl = this.configService.get<string>('openAiBaseUrl')?.trim() || null;
    const aiConfigured = apiKey.length > 0;

    return {
      status: 'ok',
      service: 'devmat-backend',
      timestamp: new Date().toISOString(),
      ai: {
        configured: aiConfigured,
        provider: aiConfigured
          ? apiKey.startsWith('sk-or-v1-') || baseUrl?.includes('openrouter.ai')
            ? 'openrouter'
            : 'openai-compatible'
          : 'heuristic-fallback',
        model: aiConfigured ? model : null,
      },
    };
  }
}

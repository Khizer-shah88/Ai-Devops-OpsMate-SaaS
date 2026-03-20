import { Injectable } from '@nestjs/common';
import { AiService, CicdOutput } from '../ai/ai.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CicdDto } from './dto/cicd.dto';

@Injectable()
export class CicdService {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  async generate(userId: string, dto: CicdDto): Promise<CicdOutput> {
    const result = await this.aiService.generateCicd(dto);

    await this.prisma.request.create({
      data: {
        userId,
        type: 'cicd',
        input: JSON.stringify(dto),
        output: JSON.stringify(result),
      },
    });

    return result;
  }
}

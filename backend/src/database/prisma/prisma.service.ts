import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	private readonly pool: Pool;

	constructor(configService: ConfigService) {
		const connectionString = configService.getOrThrow<string>('databaseUrl', {
			infer: true,
		});

		const pool = new Pool({
			connectionString,
		});

		const adapter = new PrismaPg(pool);

		super({
			adapter,
			log: ['error', 'warn'],
		});

		this.pool = pool;
	}

	async onModuleInit(): Promise<void> {
		await this.$connect();
	}

	async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
		await this.pool.end();
	}
}

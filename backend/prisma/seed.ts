import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(resolve(__dirname, '../.env'));
  loadEnvFile(resolve(__dirname, '../../.env'));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed the database');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const email = 'demo@devmate.ai';
  const password = 'demo1234';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash },
    create: { email, password: passwordHash },
  });

  const existing = await prisma.request.count({ where: { userId: user.id } });
  if (existing === 0) {
    await prisma.request.createMany({
      data: [
        {
          userId: user.id,
          type: 'review',
          input: JSON.stringify({
            language: 'typescript',
            code: 'const password = "secret";\neval(userInput);\n',
          }),
          output: JSON.stringify({
            bugs: ['Hardcoded secret detected', 'Avoid eval(); it enables code injection.'],
            improvements: ['Prefer const/let and typed inputs'],
            optimizations: ['Add input validation at trust boundaries'],
          }),
        },
        {
          userId: user.id,
          type: 'debug',
          input: JSON.stringify({
            errorLog: 'Error: connect ECONNREFUSED 127.0.0.1:5432',
          }),
          output: JSON.stringify({
            explanation: 'The process tried to open a TCP connection and the target refused it.',
            rootCause: 'Upstream service unreachable on the configured host/port',
            fixSteps: ['Confirm Postgres is running', 'Verify DATABASE_URL host/port'],
          }),
        },
      ],
    });
  }

  console.log(`Seeded demo user ${email} / ${password}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});

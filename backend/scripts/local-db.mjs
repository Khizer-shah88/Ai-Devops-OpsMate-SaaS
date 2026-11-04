import EmbeddedPostgres from 'embedded-postgres';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseDir = resolve(__dirname, '../.local-pg');
const port = Number(process.env.LOCAL_PG_PORT || 5432);
const user = process.env.POSTGRES_USER || 'devmate';
const password = process.env.POSTGRES_PASSWORD || 'devmate_password';
const database = process.env.POSTGRES_DB || 'devmate_ai';

mkdirSync(databaseDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const shutdown = async () => {
  try {
    await pg.stop();
  } catch {
    // ignore
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  console.log(`[local-db] Starting embedded Postgres on port ${port}...`);
  try {
    await pg.initialise();
  } catch (error) {
    // Already initialized from a previous run.
    if (!String(error?.message || error).toLowerCase().includes('already')) {
      console.warn('[local-db] initialise warning:', error?.message || error);
    }
  }

  await pg.start();

  try {
    await pg.createDatabase(database);
    console.log(`[local-db] Created database ${database}`);
  } catch (error) {
    console.log(`[local-db] Database ${database} already exists (ok)`);
  }

  console.log(`[local-db] Ready → postgresql://${user}:***@localhost:${port}/${database}`);
  console.log('[local-db] Keep this process running while developing.');
}

main().catch((error) => {
  console.error('[local-db] Failed:', error);
  process.exit(1);
});

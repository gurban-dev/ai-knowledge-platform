// Apply committed migrations to the integration-test database.
//
// Prisma's datasource reads DATABASE_URL, so we resolve TEST_DATABASE_URL from
// the environment (or the repo-root .env) and run `prisma migrate deploy` with
// DATABASE_URL pointed at it. Kept dependency-free and cross-platform so it
// works on a fresh clone via `pnpm db:migrate:test`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(here, '../../../.env');

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  if (!existsSync(rootEnv)) return undefined;
  for (const raw of readFileSync(rootEnv, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() === key) {
      return line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

const testUrl = readEnvValue('TEST_DATABASE_URL');
if (!testUrl) {
  console.error(
    'TEST_DATABASE_URL is not set. Add it to your .env (see .env.example) before running integration migrations.',
  );
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl },
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);

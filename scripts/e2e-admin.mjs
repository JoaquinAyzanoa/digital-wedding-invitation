// Admin E2E against the LOCAL Supabase stack (npm run db:start first).
// Resets the local database to the seed, then runs playwright.admin.config.ts.
import { execSync, spawnSync } from 'node:child_process';

const run = (command) => execSync(command, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();

const status = JSON.parse(run('npx supabase status -o json'));
if (!status.API_URL?.includes('127.0.0.1') && !status.API_URL?.includes('localhost')) {
  console.error('Local Supabase is not running (npm run db:start).');
  process.exit(1);
}

console.log('Resetting the local database…');
run('npx supabase db reset');

const result = spawnSync(
  'npx',
  ['playwright', 'test', '-c', 'playwright.admin.config.ts', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      E2E_SUPABASE_URL: status.API_URL,
      E2E_SUPABASE_KEY: status.PUBLISHABLE_KEY,
      E2E_SUPABASE_SECRET: status.SECRET_KEY,
    },
  },
);
process.exit(result.status ?? 1);

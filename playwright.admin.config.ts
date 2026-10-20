import { defineConfig, devices } from '@playwright/test';

const PORT = 5177;

// Admin E2E against the local Supabase stack. Run with `npm run e2e:admin`, which resets
// the local database and passes the keys (they are local-only, never the real project).
export default defineConfig({
  testDir: 'e2e-admin',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // "Manage it from the phone": the whole admin suite runs at phone size.
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? '',
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_KEY ?? '',
      VITE_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});

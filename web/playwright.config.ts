import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(webDirectory, '..');
const apiDirectory = path.join(repositoryRoot, 'api-mock');
const pythonExecutable =
  process.env.SCHEMA_MATCHER_PYTHON ??
  path.join(
    apiDirectory,
    '.venv',
    process.platform === 'win32' ? 'Scripts' : 'bin',
    process.platform === 'win32' ? 'python.exe' : 'python',
  );
const apiPort = 18771;
const webPort = 15173;
const ownsDatabase = !process.env.SCHEMA_MATCHER_E2E_DB;
const databasePath =
  process.env.SCHEMA_MATCHER_E2E_DB ??
  path.join(tmpdir(), `schema-matcher-e2e-${randomUUID()}.sqlite3`);
process.env.SCHEMA_MATCHER_E2E_DB = databasePath;
process.env.SCHEMA_MATCHER_E2E_OWNS_DB = ownsDatabase ? '1' : '0';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `"${pythonExecutable}" -m uvicorn app.main:app --host 127.0.0.1 --port ${apiPort}`,
      cwd: apiDirectory,
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { SCHEMA_MATCHER_MOCK_DB: databasePath },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort} --strictPort`,
      cwd: webDirectory,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_TARGET: `http://127.0.0.1:${apiPort}` },
    },
  ],
  globalTeardown: './e2e/globalTeardown.ts',
});

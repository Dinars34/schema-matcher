import { existsSync, unlinkSync } from 'node:fs';

export default function globalTeardown() {
  if (process.env.SCHEMA_MATCHER_E2E_OWNS_DB !== '1') return;
  const databasePath = process.env.SCHEMA_MATCHER_E2E_DB;
  if (!databasePath) return;

  for (const suffix of ['', '-wal', '-shm']) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) unlinkSync(filePath);
  }
}

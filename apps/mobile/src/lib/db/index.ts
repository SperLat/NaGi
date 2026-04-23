import * as SQLite from 'expo-sqlite';
import { isMock } from '@/config/mode';
import {
  CREATE_ELDERS,
  CREATE_ORGANIZATION_MEMBERS,
  CREATE_OUTBOX,
  CREATE_ACTIVITY_LOG,
  CREATE_SYNC_META,
} from './schema';

// In mock mode, the in-memory shim handles data — no SQLite needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const localDb: SQLite.SQLiteDatabase = isMock
  ? (null as unknown as SQLite.SQLiteDatabase)
  : SQLite.openDatabaseSync('nagi.db');

export function initLocalDb(): void {
  if (isMock) return;
  localDb.execSync(CREATE_ELDERS);
  localDb.execSync(CREATE_ORGANIZATION_MEMBERS);
  localDb.execSync(CREATE_OUTBOX);
  localDb.execSync(CREATE_ACTIVITY_LOG);
  localDb.execSync(CREATE_SYNC_META);
}

// Call at app startup (from _layout.tsx).
if (!isMock) initLocalDb();

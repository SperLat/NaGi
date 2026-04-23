import { isMock } from '@/config/mode';
import { MockDb } from '@/lib/mock/db';
import { MOCK_SEED, MOCK_USER } from '@/lib/mock/fixtures';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '@/config/env';

// ── Mock client ──────────────────────────────────────────────────────────────

const mockDb = new MockDb();
mockDb.seed(MOCK_SEED);

const mockAuth = {
  getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
  signInWithPassword: async (_params: { email: string; password: string }) => ({
    data: { user: MOCK_USER, session: null },
    error: null,
  }),
  signOut: async () => ({ error: null }),
};

const mockClient = {
  auth: mockAuth,
  from: <T>(table: string) => mockDb.from<T>(table),
};

// ── Real client ───────────────────────────────────────────────────────────────
// Only constructed outside mock mode. supabase-js requires the URL polyfill
// (react-native-url-polyfill/auto) imported before this module — done in _layout.tsx.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _real = !isMock
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// `db` — narrow interface used by all feature API functions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: typeof mockClient = isMock ? mockClient : (_real as any);

// `supabase` — full supabase-js client for auth and complex operations.
// Null in mock mode; always check isMock before using.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = _real;

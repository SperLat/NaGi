import { isMock } from './mode';

// Each var must be read via a LITERAL property access on process.env.
// Metro's babel-preset-expo only substitutes EXPO_PUBLIC_* at build time
// when it sees the static identifier (e.g. process.env.EXPO_PUBLIC_X) —
// dynamic access like process.env[key] survives bundling and resolves
// against an empty object on web, throwing for every required var.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const require_ = (val: string | undefined, name: string): string => {
  if (!val && !isMock) {
    throw new Error(
      `Missing required env var: ${name}. Set EXPO_PUBLIC_MOCK_MODE=true to run without backend.`
    );
  }
  return val ?? '';
};

export const env = {
  supabaseUrl: require_(SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: require_(SUPABASE_ANON_KEY, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  mockMode: isMock,
} as const;

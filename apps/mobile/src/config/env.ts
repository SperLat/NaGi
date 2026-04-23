import { isMock } from './mode';

const get = (key: string): string => {
  const val = process.env[key];
  if (!val && !isMock) {
    throw new Error(
      `Missing required env var: ${key}. Set EXPO_PUBLIC_MOCK_MODE=true to run without backend.`
    );
  }
  return val ?? '';
};

export const env = {
  supabaseUrl: get('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: get('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  mockMode: isMock,
} as const;

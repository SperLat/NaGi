import { supabase } from '@/lib/supabase';
import { detectIntent } from '@/lib/mock/ai-stubs';
import { env } from '@/config/env';
import { isMock } from '@/config/mode';

export type ClassifyIntent =
  | 'call_family'
  | 'get_help'
  | 'my_day'
  | 'one_task'
  | 'emergency'
  | 'unknown';

export async function classifyMessage(
  elderId: string,
  message: string,
): Promise<{ intent: ClassifyIntent; confidence: number }> {
  if (isMock) {
    return { intent: detectIntent(message) as ClassifyIntent, confidence: 0.9 };
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return { intent: 'unknown', confidence: 0 };

  const res = await fetch(`${env.supabaseUrl}/functions/v1/ai-classify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ elder_id: elderId, message }),
  }).catch(() => null);

  if (!res?.ok) return { intent: 'unknown', confidence: 0 };

  const data = (await res.json().catch(() => null)) as {
    intent?: ClassifyIntent;
    confidence?: number;
  } | null;

  return {
    intent: data?.intent ?? 'unknown',
    confidence: data?.confidence ?? 0,
  };
}

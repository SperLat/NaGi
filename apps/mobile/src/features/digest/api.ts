import { supabase } from '@/lib/supabase';
import { env } from '@/config/env';
import { isMock } from '@/config/mode';
import { getElder } from '@/features/elders';

/**
 * Stats the digest function returns alongside the markdown.
 *
 * The narrative weaves these in — the UI uses them only as a footer
 * bar so the caregiver can see the raw counts at a glance. Keeps us
 * honest if the model paraphrases imprecisely.
 */
export interface DigestStats {
  questions_asked: number;
  errors: number;
  offline_unavailable: number;
  help_requests_total: number;
  help_requests_acknowledged: number;
  help_requests_pending: number;
  pill_taken: number;
  pill_skipped: number;
  pill_pending: number;
}

export interface DigestResult {
  digest_markdown: string;
  period_start: string;
  period_end: string;
  stats: DigestStats;
}

const EMPTY_STATS: DigestStats = {
  questions_asked: 0,
  errors: 0,
  offline_unavailable: 0,
  help_requests_total: 0,
  help_requests_acknowledged: 0,
  help_requests_pending: 0,
  pill_taken: 0,
  pill_skipped: 0,
  pill_pending: 0,
};

/**
 * Generate a 7-day narrative digest for an elder.
 *
 * Stateless v1: no caching, no persistence — every call is a fresh
 * Claude generation. That's fine because the button is intentional;
 * caregivers click it when they want a fresh view, not on every load.
 *
 * In mock mode we return a canned demo digest so the dashboard is
 * still meaningful when running without Supabase.
 */
export async function generateDigest(elderId: string): Promise<DigestResult> {
  if (isMock) {
    // Look up the actual elder name so the mock digest doesn't hallucinate
    // characters ("Margarita", "Carlos", "Sofia") that don't exist in the
    // current org. Fall back to a neutral phrase if lookup fails — better
    // than fictional names that mislead caregivers running mock.
    const { data: e } = await getElder(elderId);
    const firstName = e?.display_name?.split(' ')[0] ?? 'your loved one';
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
    return {
      digest_markdown: `## This week with ${firstName}\n\nA quiet, steady week. ${firstName} asked Nagi a handful of questions and used the device without trouble.\n\nNothing concerning to flag. If you have a moment this weekend, a check-in call might be a nice one — small, no agenda.`,
      period_start: weekAgo.toISOString(),
      period_end: now.toISOString(),
      stats: { ...EMPTY_STATS, questions_asked: 12, help_requests_total: 1, help_requests_acknowledged: 1 },
    };
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch(`${env.supabaseUrl}/functions/v1/generate-digest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ elder_id: elderId }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`generate-digest ${res.status}: ${err}`);
  }

  return (await res.json()) as DigestResult;
}

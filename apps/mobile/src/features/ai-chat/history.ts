// Load recent conversation history from local SQLite activity_log.
// Each ai_turn row stores { message, response } in its payload — we reconstruct
// the ChatMessage[] array that the edge function expects without any new tables.

import { isMock } from '@/config/mode';
import { localDb } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from './types';

// How many back-and-forth turns to load (= N * 2 messages sent to Claude).
// 10 turns covers ~5 minutes of conversation without wasting tokens.
const HISTORY_TURNS = 10;

interface AiTurnPayload {
  message: string;
  response: string;
}

/**
 * Returns the last HISTORY_TURNS conversation turns for an elder,
 * in chronological order, ready to pass as the `messages` array
 * to the ai-chat edge function.
 *
 * Returns [] in mock mode or if the elder has no history yet.
 */
export function loadChatHistory(elderId: string): ChatMessage[] {
  if (isMock) return [];
  try {
    const rows = localDb.getAllSync<{ payload: string }>(
      `SELECT payload
         FROM activity_log
        WHERE elder_id = ? AND kind = 'ai_turn'
        ORDER BY client_ts DESC
        LIMIT ?`,
      [elderId, HISTORY_TURNS],
    );

    // getAllSync returns DESC order — reverse to restore chronological order
    return rows.reverse().flatMap(row => {
      const { message, response } = JSON.parse(row.payload) as AiTurnPayload;
      return [
        { role: 'user'      as const, content: message  },
        { role: 'assistant' as const, content: response },
      ];
    });
  } catch {
    // SQLite unavailable or payload malformed — start fresh rather than crash
    return [];
  }
}

/**
 * One reconstructed elder ↔ Nagi exchange, for the intermediary transcript.
 *
 * Each row in `activity_log` with `kind='ai_turn'` carries one full turn
 * in its payload, so a "turn" here = one user bubble + one assistant bubble
 * + the timestamp the elder sent the message. We expose them as a
 * structured object so the UI doesn't have to know the storage shape.
 */
export interface ConversationTurn {
  id: string;
  client_ts: string;
  user_message: string;
  assistant_message: string;
}

export interface ListConversationTurnsOptions {
  /** Page size — defaults to 50. */
  limit?: number;
  /** Cursor: only return turns strictly older than this ISO timestamp. */
  beforeTs?: string;
  /** Lower bound: only return turns at-or-after this ISO timestamp. */
  sinceTs?: string;
}

/**
 * Server-side conversation pull for the intermediary transcript view.
 *
 * The intermediary is typically on a different device than the elder, so
 * localDb doesn't have these rows — RLS lets organization members read
 * the elder's activity_log, which is the right authorization shape here.
 *
 * Pagination is keyset (cursor on `client_ts`) rather than offset, so
 * "load more" stays correct even as new turns arrive at the head.
 */
export async function listConversationTurns(
  elderId: string,
  options: ListConversationTurnsOptions = {},
): Promise<ConversationTurn[]> {
  if (isMock) return [];

  const limit = options.limit ?? 50;
  // deno-lint-ignore-next-line — supabase client is typed `any` to dodge mock QueryBuilder limits
  let query = supabase
    .from('activity_log')
    .select('id, client_ts, payload')
    .eq('elder_id', elderId)
    .eq('kind', 'ai_turn')
    .order('client_ts', { ascending: false })
    .limit(limit);

  if (options.beforeTs) query = query.lt('client_ts', options.beforeTs);
  if (options.sinceTs) query = query.gte('client_ts', options.sinceTs);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<{ id: string; client_ts: string; payload: unknown }>)
    .map(row => {
      const raw =
        typeof row.payload === 'string'
          ? (JSON.parse(row.payload) as Partial<AiTurnPayload>)
          : (row.payload as Partial<AiTurnPayload> | null);
      return {
        id: row.id,
        client_ts: row.client_ts,
        user_message: (raw?.message ?? '').trim(),
        assistant_message: (raw?.response ?? '').trim(),
      };
    })
    // Drop rows where both halves are empty — keeps the UI from rendering
    // ghost bubbles for malformed legacy data.
    .filter(t => t.user_message || t.assistant_message);
}

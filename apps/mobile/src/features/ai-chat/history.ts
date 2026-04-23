// Load recent conversation history from local SQLite activity_log.
// Each ai_turn row stores { message, response } in its payload — we reconstruct
// the ChatMessage[] array that the edge function expects without any new tables.

import { isMock } from '@/config/mode';
import { localDb } from '@/lib/db';
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

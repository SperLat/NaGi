import { supabase } from '@/lib/supabase';
import { getMockAiResponse } from '@/lib/mock/ai-stubs';
import { logActivity } from '@/features/activity-log';
import { env } from '@/config/env';
import { isMock } from '@/config/mode';
import type { ChatMessage } from './types';

/**
 * Trigger phrases the elder can say to mark a single turn as private.
 * Detected case-insensitively as a substring of the user's message.
 *
 * Brand voice: short, plain, what a real person would actually say.
 * NOT a slash command; just words. Adding a phrase is a one-line
 * change and ships a real boundary across all three languages.
 */
const PRIVATE_TRIGGERS: Record<string, string[]> = {
  es: [
    'esto es privado',
    'esto queda entre nosotros',
    'no le digas a',
    'no lo compartas',
    'es un secreto',
  ],
  pt: [
    'isto é privado',
    'isso é privado',
    'isso fica entre nós',
    'não conte a',
    'é um segredo',
  ],
  en: [
    'this is private',
    'between us',
    "don't tell",
    'do not tell',
    'keep this secret',
    'just between you and me',
  ],
};

function detectPrivateTrigger(message: string, lang: string): boolean {
  const phrases = PRIVATE_TRIGGERS[lang] ?? PRIVATE_TRIGGERS.en;
  const lower = message.toLowerCase();
  return phrases.some(p => lower.includes(p));
}

/**
 * Sentinel the model is instructed to append at the very end of its
 * response when the conversation drifts into a profile-listed private
 * topic. Mobile strips this from the saved transcript and sets
 * is_private = true on the resulting activity_log row.
 *
 * Kept literal-strange-enough that the model will reliably terminate it
 * on its own — no other prompt in Nagi has reason to produce this token
 * verbatim. The user will see this flash for a moment at the end of the
 * model's response on the screen; brand voice explicitly prefers honest
 * surfacing of the boundary over invisible magic.
 */
const PRIVATE_MARKER = '[private]';

/** Returns the text minus the trailing marker, plus whether it was present. */
function stripPrivateMarker(text: string): { text: string; markerPresent: boolean } {
  const trimmed = text.trimEnd();
  if (trimmed.endsWith(PRIVATE_MARKER)) {
    return {
      text: trimmed.slice(0, -PRIVATE_MARKER.length).trimEnd(),
      markerPresent: true,
    };
  }
  return { text, markerPresent: false };
}

export async function sendChatMessage(
  elderId: string,
  organizationId: string,
  messages: ChatMessage[],
  lang: string,
  onChunk: (text: string) => void,
): Promise<void> {
  if (isMock) {
    const lastMsg = messages.at(-1)?.content ?? '';
    const response = getMockAiResponse(lastMsg, lang as 'es' | 'pt' | 'en');
    // Simulate token-by-token streaming
    for (const char of response) {
      onChunk(char);
      await new Promise(r => setTimeout(r, 18));
    }
    const triggered = detectPrivateTrigger(lastMsg, lang);
    await logActivity(
      elderId,
      organizationId,
      'ai_turn',
      { message: lastMsg, response, model: 'mock' },
      { isPrivate: triggered },
    );
    return;
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch(`${env.supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ elder_id: elderId, messages }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`ai-chat ${res.status}: ${err}`);
  }

  // Parse SSE stream — 30s timeout guards against hung edge function
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';
  let done = false;

  const timeout = setTimeout(() => {
    reader.cancel().catch(() => {});
  }, 30_000);

  while (!done) {
    const chunk = await reader.read().catch(() => ({ done: true as const, value: undefined }));
    done = chunk.done;
    const value = chunk.value;
    if (done || !value) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') { done = true; break; }
      try {
        const parsed = JSON.parse(data) as { type: string; text?: string; error?: string };
        if (parsed.type === 'text' && parsed.text) {
          onChunk(parsed.text);
          fullResponse += parsed.text;
        }
        if (parsed.type === 'error') throw new Error(parsed.error ?? 'AI error');
      } catch (e) {
        // Only re-throw intentional server errors, not JSON parse glitches
        if (e instanceof Error && !e.message.includes('JSON')) throw e;
      }
    }
  }

  clearTimeout(timeout);
  const lastMsg = messages.at(-1)?.content ?? '';

  // Privacy flag: either the elder explicitly triggered it via a phrase
  // ("this is private"), or the model marked the turn private at its
  // tail because the conversation drifted into a topic on their profile
  // private-topics list.
  const triggered = detectPrivateTrigger(lastMsg, lang);
  const stripped = stripPrivateMarker(fullResponse);
  const isPrivate = triggered || stripped.markerPresent;

  await logActivity(
    elderId,
    organizationId,
    'ai_turn',
    {
      message: lastMsg,
      response: stripped.text,
      // MODELS — change here when Anthropic releases a new version
      model: 'claude-opus-4-7',
    },
    { isPrivate },
  );
}

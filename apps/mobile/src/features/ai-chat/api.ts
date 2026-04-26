import { supabase } from '@/lib/supabase';
import { getMockAiResponse } from '@/lib/mock/ai-stubs';
import { logActivity } from '@/features/activity-log';
import { recordNagiMoment } from '@/features/moments';
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

interface MomentPayload {
  body: string;
  kind: string | null;
  is_private: boolean;
}

/**
 * Sentinel block: [moment]{...json...}[/moment] anywhere in the
 * response (typically at the end). Mirrors the privacy pattern.
 *
 * Returns the response stripped of the block (so the elder doesn't
 * see the JSON) plus the parsed moment, when present.
 */
function stripMomentMarker(text: string): { text: string; moment: MomentPayload | null } {
  const match = text.match(/\[moment\]([\s\S]*?)\[\/moment\]/i);
  if (!match) return { text, moment: null };
  const cleaned = (text.slice(0, match.index) + text.slice(match.index! + match[0].length)).trimEnd();
  try {
    const parsed = JSON.parse(match[1].trim()) as Partial<MomentPayload>;
    if (typeof parsed.body !== 'string' || !parsed.body.trim()) {
      return { text: cleaned, moment: null };
    }
    return {
      text: cleaned,
      moment: {
        body: parsed.body.trim(),
        kind: typeof parsed.kind === 'string' ? parsed.kind.trim() || null : null,
        is_private: parsed.is_private === true,
      },
    };
  } catch {
    // Malformed JSON — drop the block silently rather than confuse the elder.
    return { text: cleaned, moment: null };
  }
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

  // Resolve a fresh access token. Supabase auto-refreshes in the
  // background, but on long-idle sessions (chat tab left open between
  // turns, app backgrounded on mobile) the token in memory can be the
  // expired one — the next request comes back 401. We try once with
  // whatever's cached, and if the server rejects with 401 we force
  // `refreshSession()` and retry. Anything other than 401 throws as
  // before so the offline fallback fires.
  const callOnce = async (token: string): Promise<Response> =>
    fetch(`${env.supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ elder_id: elderId, messages }),
    });

  let session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('Not authenticated');

  let res = await callOnce(session.access_token);

  if (res.status === 401) {
    // Force-refresh and retry exactly once. If refresh itself fails,
    // surface the original 401 so the caller's offline-fallback fires
    // rather than a confusing refresh error.
    const refresh = await supabase.auth.refreshSession().catch(() => null);
    const fresh = refresh?.data?.session;
    if (fresh?.access_token) {
      session = fresh;
      res = await callOnce(fresh.access_token);
    }
  }

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

  // Streaming-aware moment-marker filter. We hold back chunks that are
  // (or could become) part of a `[moment]...[/moment]` block so the
  // elder never sees the JSON flash on screen and the TTS engine never
  // reads it aloud. Stripping post-stream is still done by stripMomentMarker
  // so the API contract (logActivity / recordNagiMoment) is unaffected.
  const MOMENT_OPEN = '[moment]';
  const MOMENT_CLOSE = '[/moment]';
  let emittedCursor = 0;
  let inMoment = false;

  const flushSafely = () => {
    // Iteratively process the buffer: emit safe text, transit in/out of
    // moment mode when full open/close markers appear, withhold partial
    // prefix at the tail.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (inMoment) {
        const closeIdx = fullResponse.indexOf(MOMENT_CLOSE, emittedCursor);
        if (closeIdx === -1) {
          // Closer not yet here. Advance cursor to the end, but hold
          // back any partial-prefix of `[/moment]` at the tail — without
          // this, a closer split across SSE chunks (`[/mo` then `ment]`)
          // would be lost and the filter would stay stuck in inMoment.
          let safeEnd = fullResponse.length;
          for (let k = MOMENT_CLOSE.length - 1; k >= 1; k--) {
            if (fullResponse.endsWith(MOMENT_CLOSE.slice(0, k), safeEnd)) {
              safeEnd -= k;
              break;
            }
          }
          emittedCursor = safeEnd;
          return;
        }
        emittedCursor = closeIdx + MOMENT_CLOSE.length;
        inMoment = false;
        continue;
      }
      const openIdx = fullResponse.indexOf(MOMENT_OPEN, emittedCursor);
      if (openIdx === -1) {
        // No opener seen. Emit up to safe end (exclude any partial-prefix
        // of `[moment]` that might be the start of a real opener).
        let safeEnd = fullResponse.length;
        for (let k = MOMENT_OPEN.length - 1; k >= 1; k--) {
          if (fullResponse.endsWith(MOMENT_OPEN.slice(0, k), safeEnd)) {
            safeEnd -= k;
            break;
          }
        }
        if (safeEnd > emittedCursor) {
          onChunk(fullResponse.slice(emittedCursor, safeEnd));
          emittedCursor = safeEnd;
        }
        return;
      }
      // Opener present at openIdx. Emit text before it, enter moment mode.
      if (openIdx > emittedCursor) {
        onChunk(fullResponse.slice(emittedCursor, openIdx));
      }
      emittedCursor = openIdx;
      inMoment = true;
    }
  };

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
          fullResponse += parsed.text;
          flushSafely();
        }
        if (parsed.type === 'error') throw new Error(parsed.error ?? 'AI error');
      } catch (e) {
        // Only re-throw intentional server errors, not JSON parse glitches
        if (e instanceof Error && !e.message.includes('JSON')) throw e;
      }
    }
  }
  // Final flush — emit any held-back partial prefix that turned out NOT
  // to be a moment marker (stream ended before completion).
  if (!inMoment && emittedCursor < fullResponse.length) {
    onChunk(fullResponse.slice(emittedCursor));
    emittedCursor = fullResponse.length;
  }

  clearTimeout(timeout);
  const lastMsg = messages.at(-1)?.content ?? '';

  // Privacy flag: either the elder explicitly triggered it via a phrase
  // ("this is private"), or the model marked the turn private at its
  // tail because the conversation drifted into a topic on their profile
  // private-topics list.
  const triggered = detectPrivateTrigger(lastMsg, lang);

  // Strip moment first (anywhere in text), then privacy (trailing).
  const momentResult = stripMomentMarker(fullResponse);
  const stripped = stripPrivateMarker(momentResult.text);
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

  if (momentResult.moment) {
    // Best-effort: failures don't block the chat. If the elder's turn
    // was marked private overall, force the moment private too — the
    // model may have set is_private=false but the privacy boundary
    // applies to the entire turn.
    void recordNagiMoment(elderId, momentResult.moment.body, {
      kind: momentResult.moment.kind,
      isPrivate: momentResult.moment.is_private || isPrivate,
    });
  }
}

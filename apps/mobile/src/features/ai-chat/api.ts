import { supabase } from '@/lib/supabase';
import { getMockAiResponse } from '@/lib/mock/ai-stubs';
import { logActivity } from '@/features/activity-log';
import { env } from '@/config/env';
import { isMock } from '@/config/mode';
import type { ChatMessage } from './types';

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
    await logActivity(elderId, organizationId, 'ai_turn', {
      message: lastMsg,
      response,
      model: 'mock',
    });
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
  await logActivity(elderId, organizationId, 'ai_turn', {
    message: lastMsg,
    response: fullResponse,
    // MODELS — change here when Anthropic releases a new version
    model: 'claude-sonnet-4-6',
  });
}

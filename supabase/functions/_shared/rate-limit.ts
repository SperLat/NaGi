// In-memory rate limiter (resets on cold start).
// For production, replace with Upstash Redis.

interface Window {
  count: number;
  windowStart: number;
}

const counters = new Map<string, Window>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = counters.get(userId);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    counters.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_PER_WINDOW) return false;

  entry.count += 1;
  return true;
}

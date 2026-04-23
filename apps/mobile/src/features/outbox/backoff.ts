/**
 * Retry backoff schedule (milliseconds).
 * Attempts: 0→1=2s, 1→2=8s, 2→3=32s, 3→4=2m, 4+=5m
 * After 10 attempts the op is left in the queue with last_error set.
 */
export const MAX_ATTEMPTS = 10;

const SCHEDULE_MS = [
  2_000,      // attempt 0 → 1
  8_000,      // attempt 1 → 2
  32_000,     // attempt 2 → 3
  120_000,    // attempt 3 → 4  (2 min)
  300_000,    // attempt 4 → 5  (5 min)
  300_000,    // attempt 5 → 6
  300_000,    // attempt 6 → 7
  300_000,    // attempt 7 → 8
  300_000,    // attempt 8 → 9
  300_000,    // attempt 9 → 10
];

/**
 * Returns the minimum milliseconds that must have passed since last_error
 * before the op is eligible to retry. Index is the current `attempts` count.
 */
export function backoffMs(attempts: number): number {
  return SCHEDULE_MS[Math.min(attempts, SCHEDULE_MS.length - 1)];
}

/**
 * Auto-drain: polls for connectivity every 30s while queue is non-empty,
 * then triggers drainNow().
 *
 * @react-native-community/netinfo is NOT installed in this project, so we
 * use a lightweight polling approach: HEAD request to Google's no-content
 * endpoint (https://www.google.com/generate_204) with a 5s timeout.
 * This is a standard connectivity probe URL — returns 204 when online.
 */
import { AppState, AppStateStatus } from 'react-native';
import { drainNow } from './drain';
import { readQueue } from './storage';

const PROBE_URL = 'https://www.google.com/generate_204';
const PROBE_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 30_000;

async function isOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(PROBE_URL, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return res.status === 204 || res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function maybeDerain(): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const online = await isOnline();
  if (online) {
    await drainNow();
  }
}

/**
 * Call once from the app root (e.g. `app/_layout.tsx`) after the session is
 * ready. Returns a stop function to clean up on unmount.
 *
 * Also drains on app foreground transitions so an elder who goes offline and
 * then reconnects gets their queued ops sent immediately.
 */
export function startAutoDrain(): () => void {
  // Drain on app foreground.
  const onAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      maybeDerain().catch(() => {});
    }
  };
  const subscription = AppState.addEventListener('change', onAppStateChange);

  // Kick off an immediate drain attempt.
  maybeDerain().catch(() => {});

  // Poll every 30s while app is running.
  const intervalId = setInterval(() => {
    maybeDerain().catch(() => {});
  }, POLL_INTERVAL_MS);

  return () => {
    subscription.remove();
    clearInterval(intervalId);
  };
}

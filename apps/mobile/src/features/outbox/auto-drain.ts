/**
 * Auto-drain: polls for connectivity every 30s while queue is non-empty,
 * then triggers drainNow().
 *
 * @react-native-community/netinfo is NOT installed in this project, so we
 * use a lightweight polling approach: HEAD request to Google's no-content
 * endpoint (https://www.google.com/generate_204) with a 5s timeout.
 * This is a standard connectivity probe URL — returns 204 when online.
 */
import { AppState, AppStateStatus, Platform } from 'react-native';
import { drainNow } from './drain';
import { readQueue } from './storage';

const PROBE_URL = 'https://www.google.com/generate_204';
const PROBE_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 30_000;

async function isOnline(): Promise<boolean> {
  // Web: navigator.onLine is reliable and reflects DevTools offline toggle.
  // The Google probe is blocked by CORS from non-google origins, so it
  // would always report "offline" and the outbox would never drain.
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' && navigator.onLine !== false;
  }

  // Native: navigator.onLine reports only connection state (not reachability),
  // so use a real HTTP probe. generate_204 returns a 204 with no body when
  // reachable — the standard Android/Chromium connectivity check.
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

async function maybeDrain(): Promise<void> {
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
      maybeDrain().catch(() => {});
    }
  };
  const subscription = AppState.addEventListener('change', onAppStateChange);

  // Kick off an immediate drain attempt.
  maybeDrain().catch(() => {});

  // Poll every 30s while app is running.
  const intervalId = setInterval(() => {
    maybeDrain().catch(() => {});
  }, POLL_INTERVAL_MS);

  return () => {
    subscription.remove();
    clearInterval(intervalId);
  };
}

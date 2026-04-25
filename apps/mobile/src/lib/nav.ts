/**
 * Safe-back navigation helper.
 *
 * `router.back()` is a no-op when there's nothing on the navigation stack —
 * this happens on web hard-reload of a deep URL, after a router.replace(),
 * or when the user pasted a link directly. Without a fallback the back
 * button silently does nothing, which is one of the worst UX failures
 * (user thinks the app is broken, not that there's no history).
 *
 * Usage:
 *   <Pressable onPress={() => safeBack('/(intermediary)/')} />
 *
 * The fallback is the route to land on when the stack is empty. Pick the
 * conceptual parent of the current screen.
 */
import { router, type Href } from 'expo-router';

export function safeBack(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}

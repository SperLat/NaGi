import 'react-native-url-polyfill/auto';
import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getActiveOrg } from '@/features/auth';
import { useSession } from '@/state';
import { startSyncManager } from '@/lib/sync';
import { startAutoDrain } from '@/features/outbox';
import { isMock } from '@/config/mode';
import { PrivacyNotice } from '@/features/privacy';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { setSession, clearSession, setHydrated } = useSession();

  // Start the AsyncStorage outbox drain loop once on mount (real mode only).
  useEffect(() => {
    if (isMock) return;
    return startAutoDrain();
  }, []);

  // Start sync when org session is active.
  const { activeOrgId } = useSession();
  useEffect(() => {
    if (!activeOrgId) return;
    return startSyncManager(activeOrgId);
  }, [activeOrgId]);

  useEffect(() => {
    // Mock mode: session is pre-populated in the store at creation time.
    if (isMock) return;

    let cancelled = false;

    // Hard fallback — never leave the user staring at a blank-white
    // spinner. Only fires if `getSession` itself hangs (genuine
    // network-dead case). 8s = past any reasonable mobile cold-start;
    // shorter would race against `getSession` on slow networks and
    // flicker the user to sign-in just because the request was slow,
    // not because they're logged out.
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) setHydrated();
    }, 8000);

    const applySession = (session: { user?: { id: string } } | null) => {
      if (cancelled) return;
      if (session?.user) {
        // Set the session immediately with no org so the router can
        // route based on auth state alone. Org resolution (which can
        // be slow on cold cache or hang on RLS misfires) happens in
        // the background — the home screen tolerates an empty orgId
        // for a beat, then re-renders when the org effect populates.
        setSession(session.user.id, '');
        getActiveOrg(session.user.id)
          .then(orgId => {
            if (cancelled) return;
            if (orgId) setSession(session.user!.id, orgId);
          })
          .catch(() => { /* leave orgId empty — sign-in screens handle this */ });
      } else {
        clearSession();
      }
      // Hydration completes the moment we know the auth state,
      // independent of whether org resolution has finished.
      setHydrated();
    };

    // Primary path: read the persisted session directly. This is the
    // reliable way to rehydrate on web hard-reload, where the first
    // onAuthStateChange can race with storage restore or silently not fire.
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: { user?: { id: string } } | null } }) => applySession(data.session))
      .catch(() => {
        if (!cancelled) {
          clearSession();
          setHydrated();
        }
      });

    // Secondary path: react to subsequent auth changes (sign-in, sign-out,
    // token refresh). Idempotent with the primary path because setSession /
    // clearSession / setHydrated are all safe to call repeatedly.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: { id: string } } | null) => applySession(session),
    );

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [setSession, clearSession, setHydrated]);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(intermediary)" />
        <Stack.Screen name="(elder)" />
        <Stack.Screen name="locked" />
        <Stack.Screen name="privacy" />
      </Stack>
      {/* Essential-cookies transparency notice. Mounts globally so it
          shows once across any first-visit route, then never again. */}
      <PrivacyNotice />
    </QueryClientProvider>
  );
}

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

    const applySession = async (session: { user?: { id: string } } | null) => {
      if (cancelled) return;
      if (session?.user) {
        const orgId = await getActiveOrg(session.user.id);
        if (cancelled) return;
        setSession(session.user.id, orgId ?? '');
      } else {
        clearSession();
      }
      setHydrated();
    };

    // Primary path: read the persisted session directly. This is the
    // reliable way to rehydrate on web hard-reload, where the first
    // onAuthStateChange can race with storage restore or silently not fire.
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: { user?: { id: string } } | null } }) => applySession(data.session))
      .catch(() => {
        // Never leave the UI hanging on the hydration gate. If we can't
        // read the session, treat it as "no session" and let the router
        // send us to sign-in.
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
      subscription.unsubscribe();
    };
  }, [setSession, clearSession, setHydrated]);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(intermediary)" />
        <Stack.Screen name="(elder)" />
      </Stack>
    </QueryClientProvider>
  );
}

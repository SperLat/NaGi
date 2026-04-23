import 'react-native-url-polyfill/auto';
import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getActiveOrg } from '@/features/auth';
import { useSession } from '@/state';
import { startSyncManager } from '@/lib/sync';
import { isMock } from '@/config/mode';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { setSession, clearSession, setHydrated } = useSession();

  // Start sync when org session is active.
  const { activeOrgId } = useSession();
  useEffect(() => {
    if (!activeOrgId) return;
    return startSyncManager(activeOrgId);
  }, [activeOrgId]);

  useEffect(() => {
    // Mock mode: session is pre-populated in the store at creation time.
    if (isMock) return;

    // Real mode: subscribe to Supabase auth state changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: string, session: { user?: { id: string } } | null) => {
      if (session?.user) {
        const orgId = await getActiveOrg(session.user.id);
        setSession(session.user.id, orgId ?? '');
      } else {
        clearSession();
      }
      // Mark the store as hydrated after the first auth state is known.
      setHydrated();
    });

    return () => subscription.unsubscribe();
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

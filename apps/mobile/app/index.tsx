import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useSession } from '@/state';

export default function Index() {
  const { hydrated, userId, deviceMode } = useSession();

  // Wait for Supabase to fire the first onAuthStateChange before routing.
  // In mock mode hydrated is true immediately (pre-populated at store creation).
  if (!hydrated) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#B8552B" size="large" />
      </SafeAreaView>
    );
  }

  // Not signed in → auth flow.
  if (!userId) return <Redirect href="/(auth)/sign-in" />;

  // Signed in. Device-level mode determines which surface the user lands on.
  // The whole point of the two-PIN lock: an authenticated session does NOT
  // automatically grant access to the intermediary surface — the device must
  // also be unlocked into intermediary mode.
  if (deviceMode?.kind === 'elder') {
    return <Redirect href="/(elder)/" />;
  }
  if (deviceMode?.kind === 'locked') {
    return <Redirect href="/locked" />;
  }
  // No device PIN configured yet → today's behavior (intermediary access).
  // First-run intermediaries see the dashboard normally; setting a device PIN
  // is opt-in from account settings. Once set, future cold-launches gate.
  return <Redirect href="/(intermediary)/" />;
}

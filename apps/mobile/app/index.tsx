import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useSession } from '@/state';

export default function Index() {
  const { hydrated, userId } = useSession();

  // Wait for Supabase to fire the first onAuthStateChange before routing.
  // In mock mode hydrated is true immediately (pre-populated at store creation).
  if (!hydrated) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#B8552B" size="large" />
      </SafeAreaView>
    );
  }

  if (userId) {
    return <Redirect href="/(intermediary)/" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}

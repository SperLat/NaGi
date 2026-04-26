import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PinEntry } from '@/components/PinEntry';
import { verifyDevicePin } from '@/lib/kiosk';
import { useSession } from '@/state';

/**
 * Transition screen between elder mode and intermediary mode.
 *
 * The screen deliberately gives away nothing: kanji wordmark, a PIN
 * field, and silence on wrong attempts. No "this is the intermediary
 * unlock," no "incorrect PIN," no list of which user is signed in. An
 * elder who reaches this screen sees a calm, anonymous lock — there's
 * nothing here that lets them browse, learn, or guess.
 */
export default function LockedScreen() {
  const { setDeviceMode } = useSession();

  const handleSuccess = async () => {
    await setDeviceMode({ kind: 'intermediary' });
    router.replace('/(intermediary)/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          gap: 48,
        }}
      >
        <Text style={{ fontSize: 96, color: '#1E1E1E', includeFontPadding: false }}>
          凪
        </Text>
        <PinEntry
          prompt="Enter PIN to unlock"
          onVerify={verifyDevicePin}
          onSuccess={handleSuccess}
        />
      </View>
    </SafeAreaView>
  );
}

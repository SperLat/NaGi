import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PinEntry } from '@/components/PinEntry';
import { verifyDevicePin, clearDevicePin } from '@/lib/kiosk';
import { useSession } from '@/state';

/**
 * Transition screen between elder mode and intermediary mode.
 *
 * The screen deliberately gives away nothing in the keypad area:
 * kanji wordmark, a PIN field, and silence on wrong attempts. No
 * "this is the intermediary unlock," no "incorrect PIN," no list of
 * which user is signed in. An elder who reaches this screen sees a
 * calm, anonymous lock.
 *
 * The discreet "Forgot PIN" link below is for caregivers who set a
 * PIN they no longer remember (or a localStorage cache that survived
 * a DB clear, etc.). Tapping it surfaces a confirm prompt and resets
 * the PIN for the signed-in account — the threat model already trusts
 * a valid session JWT (the device PIN is only an incidental-navigation
 * deterrent on top), so resetting via the active session is fine.
 */
export default function LockedScreen() {
  const { setDeviceMode } = useSession();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSuccess = async () => {
    await setDeviceMode({ kind: 'intermediary' });
    router.replace('/(intermediary)/');
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    await clearDevicePin();
    await setDeviceMode({ kind: 'intermediary' });
    setResetting(false);
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

        {!resetOpen ? (
          <Pressable
            onPress={() => setResetOpen(true)}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: '#9A9A95', fontSize: 13 }}>Forgot PIN</Text>
          </Pressable>
        ) : (
          <View style={{ alignItems: 'center', gap: 12, maxWidth: 320 }}>
            <Text style={{ color: '#545454', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
              Reset the device PIN for your account? You'll be able to set a new
              one from Settings.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setResetOpen(false)}
                disabled={resetting}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}
              >
                <Text style={{ color: '#9A9A95', fontSize: 13 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmReset}
                disabled={resetting}
                style={({ pressed }) => ({
                  backgroundColor: '#34503E',
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Text style={{ color: '#FAF5EC', fontSize: 13, fontWeight: '600' }}>
                  {resetting ? 'Resetting…' : 'Reset PIN'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

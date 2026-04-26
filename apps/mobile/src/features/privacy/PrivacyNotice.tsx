import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTICE_SEEN_KEY = '@nagi/privacy_notice_seen_v1';

/**
 * First-visit transparency notice. Cedar uses essential cookies only
 * (auth session, kiosk PIN cache, walkthrough flag) — no advertising,
 * no analytics. Under GDPR + ePrivacy that's transparency-required,
 * not consent-required. So this is a small honest notice with one
 * dismiss button, NOT a coercive "Accept all cookies" overlay.
 *
 * Mounted at the root layout. Hides itself once dismissed; the flag
 * lives in AsyncStorage so a hard refresh doesn't show it twice.
 */
export function PrivacyNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(NOTICE_SEEN_KEY).then(seen => {
      if (seen !== 'true') setVisible(true);
    });
  }, []);

  const dismiss = async () => {
    await AsyncStorage.setItem(NOTICE_SEEN_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 560,
        alignSelf: 'center',
        backgroundColor: '#FAF5EC',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#E0DFDC',
        zIndex: 1000,
      }}
    >
      <Text style={{ fontSize: 14, color: '#1A2E25', fontWeight: '600', marginBottom: 6 }}>
        A note on what's stored on your device
      </Text>
      <Text style={{ fontSize: 13, color: '#545454', lineHeight: 19, marginBottom: 12 }}>
        Nagi stores your auth session, your device PIN, and a few small
        flags locally so you stay signed in and the kiosk lock works.
        No advertising trackers, no social pixels.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Pressable
          onPress={() => { void dismiss(); router.push('/privacy'); }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8, paddingHorizontal: 12 })}
        >
          <Text style={{ color: '#727270', fontSize: 13 }}>Privacy details</Text>
        </Pressable>
        <Pressable
          onPress={dismiss}
          style={({ pressed }) => ({
            backgroundColor: '#34503E',
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 10,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: '#FAF5EC', fontWeight: '600', fontSize: 13 }}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

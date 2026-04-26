import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { getElder, verifyElderKioskPin, type Elder } from '@/features/elders';
import { useSession } from '@/state';
import { PinEntry } from '@/components/PinEntry';

interface ElderCtx {
  elder: Elder | null;
  textSize: 'lg' | 'xl' | '2xl';
  highContrast: boolean;
  orgId: string;
}

const Ctx = createContext<ElderCtx>({
  elder: null,
  textSize: 'xl',
  highContrast: false,
  orgId: '',
});

export function useElderCtx() {
  return useContext(Ctx);
}

const TAP_WINDOW_MS = 3000;
const TAPS_TO_OPEN = 5;

export default function ElderLayout() {
  const { activeElderId, activeOrgId, deviceMode, setDeviceMode } = useSession();
  const [elder, setElder] = useState<Elder | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const tapTimes = useRef<number[]>([]);

  // Whether the layout is operating in true kiosk mode. The (elder) routes
  // can also be navigated by an intermediary previewing what the elder will
  // see — in that case we DON'T install the back-handler / gesture traps.
  const inKiosk = deviceMode?.kind === 'elder';

  // Resolve the active elder for the layout context. In kiosk mode the
  // elder is whoever the device was handed to; otherwise it's whatever
  // the intermediary set last (legacy preview path).
  const elderId =
    deviceMode?.kind === 'elder' ? deviceMode.elderId : (activeElderId ?? null);

  useEffect(() => {
    if (!elderId) return;
    void getElder(elderId).then(({ data }) => setElder(data));
  }, [elderId]);

  // ── Lock-down primitives — only when actually in kiosk mode ─────────

  // Android hardware Back: eat every press.
  useEffect(() => {
    if (!inKiosk || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [inKiosk]);

  // Web: prevent browser back, URL-bar typing, and tab close from
  // escaping kiosk mode. We can't truly disable URL typing, but we
  // re-pin the elder route on every popstate, and root-layout routing
  // re-pins on cold-loads via deviceMode.
  useEffect(() => {
    if (!inKiosk || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPopState = () => {
      // Whatever they navigated to, snap back to elder home.
      window.history.pushState(null, '', '/');
      router.replace('/(elder)/');
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Spec: setting returnValue triggers the prompt in legacy browsers.
      e.returnValue = '';
    };
    // Seed a history entry so the first back press has something to pop.
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [inKiosk]);

  // ── Kanji-5×-tap exit gesture ───────────────────────────────────────

  const handleKanjiTap = useCallback(() => {
    const now = Date.now();
    tapTimes.current = [
      ...tapTimes.current.filter(t => now - t < TAP_WINDOW_MS),
      now,
    ];
    if (tapTimes.current.length >= TAPS_TO_OPEN) {
      tapTimes.current = [];
      setPinOpen(true);
    }
  }, []);

  const handlePinSuccess = async () => {
    setPinOpen(false);
    await setDeviceMode({ kind: 'locked' });
    router.replace('/locked');
  };

  const verifyForLayout = useCallback(
    async (pin: string) => {
      if (!elderId) return false;
      return verifyElderKioskPin(elderId, pin);
    },
    [elderId],
  );

  const ctx: ElderCtx = {
    elder,
    textSize: (elder?.ui_config.text_size ?? 'xl') as 'lg' | 'xl' | '2xl',
    highContrast: elder?.ui_config.high_contrast ?? false,
    orgId: activeOrgId ?? '',
  };

  return (
    <Ctx.Provider value={ctx}>
      {/* gestureEnabled:false disables iOS edge-swipe back when in kiosk. */}
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: !inKiosk,
        }}
      />

      {/* Discreet exit affordance — top-right kanji, hidden in plain sight.
          Always present in elder mode. Tapping doesn't navigate; five taps
          within three seconds opens the PIN pad. The intermediary can
          teach this gesture in 10 seconds. */}
      {inKiosk ? (
        <Pressable
          onPress={handleKanjiTap}
          accessibilityLabel=""
          accessible={false}
          style={{
            position: 'absolute',
            top: Platform.select({ ios: 56, android: 24, default: 16 }),
            right: 16,
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={8}
        >
          <Text style={{ fontSize: 22, color: '#9A9A95', includeFontPadding: false }}>
            凪
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={pinOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPinOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(26, 23, 20, 0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: '#F7F5F2',
              borderRadius: 24,
              padding: 28,
              maxWidth: 360,
              width: '100%',
              gap: 20,
            }}
          >
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 40, color: '#1E1E1E', includeFontPadding: false }}>
                凪
              </Text>
              {/* No "exit" or "intermediary" wording — calm and ambiguous. */}
              <Text style={{ color: '#727270', fontSize: 14 }}>Enter PIN</Text>
            </View>
            <PinEntry onVerify={verifyForLayout} onSuccess={handlePinSuccess}
              onFailure={() => setPinOpen(false)} />
            <Pressable onPress={() => setPinOpen(false)} hitSlop={8}>
              <Text style={{ color: '#9A9A95', fontSize: 13, textAlign: 'center' }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

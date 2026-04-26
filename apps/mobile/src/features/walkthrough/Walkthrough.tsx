import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { PinEntry } from '@/components/PinEntry';
import { setDevicePin, setDeviceMode } from '@/lib/kiosk';
import { useSession } from '@/state';
import { markWalkthroughSeen } from '.';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Elder ids passed in from the dashboard so the "Hand to Eleanor"
   *  step has a real id to flip device_mode to. Order matters —
   *  Eleanor is at index 0 (first elder by display_name in the
   *  Pemberton seed). */
  elderIds: { eleanor?: string };
}

type Slide =
  | 'welcome'
  | 'family'
  | 'recall'
  | 'privacy'
  | 'friends'
  | 'device-pin'
  | 'elder-pin'
  | 'handoff'
  | 'complete';

const ORDER: Slide[] = [
  'welcome',
  'family',
  'recall',
  'privacy',
  'friends',
  'device-pin',
  'elder-pin',
  'handoff',
  'complete',
];

/**
 * Multi-step modal that walks a first-time judge through the Pemberton
 * demo. Slides explain the product, set up a device PIN, confirm the
 * pre-set elder PIN, and end with a one-click "Hand to Eleanor" button
 * that drops them into kiosk mode.
 *
 * Slide PIN entry uses the same PinEntry component as the locked
 * screen — judges learn the keypad shape here, then recognize it when
 * they later see it on the locked screen on exit.
 */
export function Walkthrough({ visible, onClose, elderIds }: Props) {
  const [slide, setSlide] = useState<Slide>('welcome');
  const [busy, setBusy] = useState(false);
  const { setDeviceMode: setSessionDeviceMode } = useSession();

  const idx = ORDER.indexOf(slide);
  const next = useCallback(() => {
    const nextIdx = Math.min(idx + 1, ORDER.length - 1);
    setSlide(ORDER[nextIdx]);
  }, [idx]);
  const prev = useCallback(() => {
    const prevIdx = Math.max(idx - 1, 0);
    setSlide(ORDER[prevIdx]);
  }, [idx]);

  const dismiss = useCallback(async () => {
    await markWalkthroughSeen();
    setSlide('welcome');
    onClose();
  }, [onClose]);

  // Slide 5 — set device PIN.
  // Calls kiosk.ts setDevicePin (which hashes + persists locally), then
  // advances. PinEntry's onVerify is mis-named for this case: we don't
  // verify, we *set* — so we accept any 4-digit input and return true.
  const handleDevicePinEntry = useCallback(
    async (pin: string) => {
      setBusy(true);
      try {
        await setDevicePin(pin);
        next();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [next],
  );

  // Slide 7 — hand off to Eleanor. Flips device_mode to elder kiosk
  // and routes to the elder home. Walkthrough auto-closes (it's no
  // longer reachable from the locked-down elder shell anyway).
  const handHandoff = useCallback(async () => {
    if (!elderIds.eleanor) return;
    setBusy(true);
    try {
      await setSessionDeviceMode({ kind: 'elder', elderId: elderIds.eleanor });
      await markWalkthroughSeen();
      setBusy(false);
      onClose();
      router.replace('/(elder)/');
    } catch {
      setBusy(false);
    }
  }, [elderIds.eleanor, onClose, setSessionDeviceMode]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(26, 23, 20, 0.6)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <View
          style={{
            backgroundColor: '#FAF5EC',
            borderRadius: 24,
            paddingTop: 28,
            paddingBottom: 16,
            paddingHorizontal: 24,
            maxWidth: 480,
            width: '100%',
            maxHeight: '92%',
          }}
        >
          {/* Progress dots */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 20,
            }}
          >
            {ORDER.slice(0, -1).map((s, i) => (
              <View
                key={s}
                style={{
                  width: i === idx ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i <= idx ? '#34503E' : '#DDE5DF',
                }}
              />
            ))}
          </View>

          <ScrollView
            style={{ maxHeight: 460 }}
            contentContainerStyle={{ gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {slide === 'welcome' && <SlideWelcome />}
            {slide === 'family' && <SlideFamily />}
            {slide === 'recall' && <SlideRecall />}
            {slide === 'privacy' && <SlidePrivacy />}
            {slide === 'friends' && <SlideFriends />}
            {slide === 'device-pin' && (
              <SlideDevicePin onEntered={handleDevicePinEntry} busy={busy} />
            )}
            {slide === 'elder-pin' && <SlideElderPin />}
            {slide === 'handoff' && (
              <SlideHandoff onHandoff={handHandoff} busy={busy} hasEleanor={!!elderIds.eleanor} />
            )}
            {slide === 'complete' && <SlideComplete />}
          </ScrollView>

          {/* Footer nav */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: '#F0F0EE',
            }}
          >
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}
            >
              <Text style={{ color: '#9A9A95', fontSize: 13 }}>Skip tour</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {idx > 0 && slide !== 'device-pin' && (
                <Pressable
                  onPress={prev}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}
                >
                  <Text style={{ color: '#727270', fontSize: 14, fontWeight: '500' }}>← Back</Text>
                </Pressable>
              )}
              {/* device-pin advances on PIN entry, handoff has its own CTA, complete dismisses */}
              {slide !== 'device-pin' && slide !== 'handoff' && slide !== 'complete' && (
                <Pressable
                  onPress={next}
                  style={({ pressed }) => ({
                    backgroundColor: '#34503E',
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    borderRadius: 12,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: '#FAF5EC', fontWeight: '600', fontSize: 15 }}>
                    Next →
                  </Text>
                </Pressable>
              )}
              {slide === 'complete' && (
                <Pressable
                  onPress={dismiss}
                  style={({ pressed }) => ({
                    backgroundColor: '#34503E',
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    borderRadius: 12,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: '#FAF5EC', fontWeight: '600', fontSize: 15 }}>
                    Start exploring
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Slide content ────────────────────────────────────────────────────

function SlideWelcome() {
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 64, color: '#34503E' }}>凪</Text>
      <Text style={{ fontSize: 26, fontWeight: '700', color: '#1E1E1E', textAlign: 'center' }}>
        Welcome to Nagi
      </Text>
      <Text style={{ fontSize: 15, color: '#545454', textAlign: 'center', lineHeight: 22 }}>
        This is the family member's dashboard — where the elders in your care,
        their conversations, and the rhythms of their week live. Throughout
        this tour we'll use The Pemberton Family — three example elders — to
        show what Nagi can do.
      </Text>
    </View>
  );
}

function SlideFamily() {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
        An example family
      </Text>
      <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
        Each elder in your care has their own profile, conversation history,
        and care preferences. To illustrate, meet the Pembertons — they're the
        example we'll use throughout this tour:
      </Text>

      <ElderRow
        name="Eleanor 'Nell' Pemberton"
        age={74}
        detail="Recently widowed, gardener, jazz devotee. Sharp — treat her as the equal she is."
      />
      <ElderRow
        name="Frances 'Fran' Pemberton"
        age={78}
        detail="Mild dementia, retired schoolteacher, loves her cat Pearl and the cardinals at her window."
      />
      <ElderRow
        name="William 'Bill' Pemberton"
        age={82}
        detail="Ex-Army Korea, builds model planes, walks daily despite mild COPD. Veteran sensibility — direct talk only."
      />
    </View>
  );
}

function ElderRow({ name, age, detail }: { name: string; age: number; detail: string }) {
  return (
    <View
      style={{
        backgroundColor: '#F0F0EE',
        borderRadius: 14,
        padding: 14,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E1E1E' }}>
        {name} <Text style={{ color: '#727270', fontWeight: '400' }}>· {age}</Text>
      </Text>
      <Text style={{ fontSize: 13, color: '#545454', lineHeight: 18 }}>{detail}</Text>
    </View>
  );
}

function SlideRecall() {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
        Nagi remembers
      </Text>
      <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
        Each elder has 45 days of conversation history. With Claude Opus 4.7's
        1M-context window, Nagi can recall specifics from weeks ago without
        any vector search or RAG infrastructure — just the raw history loaded
        into a single turn.
      </Text>
      <View
        style={{
          backgroundColor: '#DDE5DF',
          borderRadius: 14,
          padding: 14,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 12, color: '#1A2E25', fontWeight: '600', letterSpacing: 0.5 }}>
          TRY THIS AFTER THE TOUR
        </Text>
        <Text style={{ fontSize: 14, color: '#1A2E25', lineHeight: 20 }}>
          Click <Text style={{ fontWeight: '600' }}>Eleanor</Text> on the sidebar →{' '}
          <Text style={{ fontWeight: '600' }}>"Open elder interface"</Text> → ask{' '}
          <Text style={{ fontStyle: 'italic' }}>"How's the garden?"</Text>
        </Text>
        <Text style={{ fontSize: 13, color: '#1A2E25', lineHeight: 18 }}>
          Nagi will recall her Brandywine tomatoes, the climbing roses her late husband
          Charles planted, and the Coltrane records she found in his den last month.
        </Text>
      </View>
    </View>
  );
}

function SlidePrivacy() {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
        Each elder draws their own line
      </Text>
      <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
        Nagi honors what the elder asks to keep private. There are three ways
        privacy gets set:
      </Text>
      <PrivacyBullet
        title="A phrase mid-conversation"
        body='"This stays between us" or "esto es privado" → that one turn is hidden from the family transcript.'
      />
      <PrivacyBullet
        title="A topic on the elder profile"
        body='Topics_to_keep_private — Nagi auto-detects when the conversation drifts there and hides it.'
      />
      <PrivacyBullet
        title="A daily share toggle on their home screen"
        body="The elder can hide today's full chat with one tap if they want a quiet day."
      />
      <Text style={{ fontSize: 13, color: '#727270', fontStyle: 'italic', lineHeight: 18 }}>
        On the conversation transcript view you'll see "A private moment" with a
        timestamp where private turns happened — honest about the boundary,
        opaque about the substance.
      </Text>
    </View>
  );
}

function PrivacyBullet({ title, body }: { title: string; body: string }) {
  return (
    <View
      style={{
        backgroundColor: '#F0F0EE',
        borderRadius: 12,
        padding: 12,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E1E1E' }}>{title}</Text>
      <Text style={{ fontSize: 13, color: '#545454', lineHeight: 18 }}>{body}</Text>
    </View>
  );
}

function SlideDevicePin({
  onEntered,
  busy,
}: {
  onEntered: (pin: string) => Promise<boolean>;
  busy: boolean;
}) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
        Set your device PIN
      </Text>
      <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
        Pick a 4-digit PIN you'll remember. When you "hand the device" to an
        elder, this PIN is what brings you back to the dashboard.
      </Text>
      {busy ? (
        <View style={{ alignItems: 'center', padding: 24 }}>
          <ActivityIndicator color="#34503E" />
        </View>
      ) : (
        <PinEntry onVerify={onEntered} onSuccess={() => {}} respectCooldown={false} />
      )}
    </View>
  );
}

function SlideElderPin() {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
        Their exit PIN
      </Text>
      <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
        Each elder also has a PIN for stepping out of their kiosk view. In the
        Pemberton example, all three share the same exit PIN so judges only
        memorize one number — in production each family sets their own per
        elder:
      </Text>
      <View
        style={{
          backgroundColor: '#DDE5DF',
          borderRadius: 16,
          padding: 22,
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: '#1A2E25', letterSpacing: 0.5 }}>
          ELDER EXIT PIN
        </Text>
        <Text style={{ fontSize: 36, fontWeight: '700', color: '#34503E', letterSpacing: 4 }}>
          5 6 7 8
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: '#727270', lineHeight: 18 }}>
        In production, the family member sets this when they hand the device
        to the elder. The elder uses it to step out of kiosk mode if they
        want to.
      </Text>
    </View>
  );
}

function SlideHandoff({
  onHandoff,
  busy,
  hasEleanor,
}: {
  onHandoff: () => void;
  busy: boolean;
  hasEleanor: boolean;
}) {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
        Try the handoff
      </Text>
      <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
        Click below to hand the tablet to Eleanor. The dashboard locks down —
        she'll see her own home screen, no path back to your data.
      </Text>
      <View
        style={{
          backgroundColor: '#F0E8D8',
          borderRadius: 14,
          padding: 14,
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E1E1E' }}>
          To return to this dashboard:
        </Text>
        <Text style={{ fontSize: 13, color: '#545454', lineHeight: 18 }}>
          1. Tap the kanji <Text style={{ fontWeight: '600' }}>凪</Text> in the top-right corner
          five times rapidly.{'\n'}
          2. Enter the elder exit PIN: <Text style={{ fontWeight: '600' }}>5678</Text>{'\n'}
          3. Enter the device PIN you just set.
        </Text>
      </View>
      {hasEleanor ? (
        <Pressable
          onPress={onHandoff}
          disabled={busy}
          style={({ pressed }) => ({
            backgroundColor: '#34503E',
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
            opacity: pressed || busy ? 0.85 : 1,
            marginTop: 4,
          })}
        >
          {busy ? (
            <ActivityIndicator color="#FAF5EC" />
          ) : (
            <Text style={{ color: '#FAF5EC', fontWeight: '600', fontSize: 16 }}>
              Hand to Eleanor →
            </Text>
          )}
        </Pressable>
      ) : (
        <Text style={{ fontSize: 13, color: '#C8874A', fontStyle: 'italic' }}>
          Eleanor isn't in this organization — try this from a Pemberton-seeded account.
        </Text>
      )}
    </View>
  );
}

function SlideFriends() {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
        Friends across families
      </Text>
      <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
        With both families' consent, Nagi connects elders across organizations so
        they can send each other voice or text messages — translated automatically
        between Spanish and English, played aloud in the recipient's preferred language.
      </Text>
      <View
        style={{
          backgroundColor: '#DDE5DF',
          borderRadius: 14,
          padding: 14,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 12, color: '#1A2E25', fontWeight: '600', letterSpacing: 0.5 }}>
          PRE-WIRED FOR THIS DEMO
        </Text>
        <Text style={{ fontSize: 14, color: '#1A2E25', lineHeight: 20 }}>
          Eleanor (Pemberton, Spanish) and Maggie (Whitmore, English) are already
          connected. Eleanor's home shows a card "📬 Mensaje de Maggie" when
          Maggie sends something — and vice versa. Each elder hears the message
          in their own language; the other elder never has to think about translation.
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: '#727270', lineHeight: 18 }}>
        From any elder profile in your dashboard, the "Friends across families"
        section lets you propose new connections by elder name. The other family
        accepts on their dashboard. Either side can pause the connection at any time —
        the elder owns the relationship, the family owns the boundary.
      </Text>
    </View>
  );
}

function SlideComplete() {
  return (
    <View style={{ gap: 14, paddingVertical: 8 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
        Ready to explore
      </Text>
      <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
        That's the loop. From here, click any elder on the sidebar to dive
        in. Each profile has:
      </Text>
      <View style={{ gap: 6, paddingLeft: 8 }}>
        {[
          'Configure interface — language, text size, what topics to keep private',
          'Activity log — what they did, where they got stuck',
          'Conversations — the full transcript, with private moments shown as placeholders',
          'Notes — shared journal between caregivers',
          'Team chat — for multiple family members coordinating',
          'Generate weekly digest — Claude-written summary, forwardable to siblings',
        ].map((s, i) => (
          <Text key={i} style={{ fontSize: 13, color: '#545454', lineHeight: 20 }}>
            • {s}
          </Text>
        ))}
      </View>
      <Text style={{ fontSize: 13, color: '#727270', fontStyle: 'italic', marginTop: 8 }}>
        You can replay this tour anytime from the sidebar.
      </Text>
    </View>
  );
}

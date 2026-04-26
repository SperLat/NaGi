import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { isDayShared, setDayPrivacy } from '@/features/activity-log';
import { useStrings } from '@/lib/i18n';

interface Props {
  elderId: string;
  /** Lang code from the elder profile — drives all visible copy. */
  lang: string;
  /** Render hint: pass true on a dark/high-contrast background. */
  highContrast?: boolean;
}

/**
 * Pill the elder taps on their home screen to toggle whether today's
 * chat with Nagi is visible to family on the dashboard.
 *
 * Defaults to "shared" — the family-trust default mode of the product.
 * The elder can mute the day's substance with two taps (pill, then
 * confirmation), and unmute it just as easily. The pill is permanent,
 * not a once-a-day prompt: privacy is a setting the elder controls,
 * not a question Nagi keeps re-asking.
 */
export function DailyShareToggle({ elderId, lang, highContrast }: Props) {
  const s = useStrings(lang);
  const [shared, setShared] = useState<boolean | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-poll on mount and on any change to elderId.
  const refresh = useCallback(async () => {
    const v = await isDayShared(elderId, new Date());
    setShared(v);
  }, [elderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onConfirm = useCallback(async () => {
    if (shared === null) return;
    setBusy(true);
    const next = !shared;
    const { ok } = await setDayPrivacy(elderId, new Date(), /* isPrivate */ !next);
    if (ok) setShared(next);
    setBusy(false);
    setConfirmOpen(false);
  }, [elderId, shared]);

  if (shared === null) return null;

  // Calm visual: rounded pill, neutral when shared (the default), warm
  // accent when private (the elder is actively holding a boundary).
  const bg = shared
    ? highContrast ? '#2A2A2A' : '#F0F0EE'
    : highContrast ? '#1A2E25' : '#DDE5DF';
  const fg = shared
    ? highContrast ? '#9A9A95' : '#727270'
    : highContrast ? '#F7F5F2' : '#1A2E25';
  const dotColor = shared ? '#7A8C4F' : '#34503E';

  return (
    <>
      <Pressable
        onPress={() => setConfirmOpen(true)}
        style={({ pressed }) => ({
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: bg,
          opacity: pressed ? 0.7 : 1,
          gap: 8,
        })}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dotColor,
          }}
        />
        <Text style={{ color: fg, fontSize: 13, fontWeight: '500' }}>
          {shared ? s.privacyShared : s.privacyHidden}
        </Text>
      </Pressable>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
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
              padding: 24,
              maxWidth: 380,
              width: '100%',
              gap: 12,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: '#1E1E1E',
              }}
            >
              {shared ? s.privacyHideTitle : s.privacyShareMessage}
            </Text>
            {shared ? (
              <Text style={{ fontSize: 15, color: '#545454', lineHeight: 22 }}>
                {s.privacyHideMessage}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Pressable
                disabled={busy}
                onPress={() => setConfirmOpen(false)}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#727270', fontSize: 16 }}>{s.privacyCancel}</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={onConfirm}
                style={({ pressed }) => ({
                  flex: 1.4,
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: '#34503E',
                  alignItems: 'center',
                  opacity: pressed || busy ? 0.7 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FAF5EC', fontSize: 16, fontWeight: '600' }}>
                    {shared ? s.privacyConfirmHide : s.privacyConfirmShare}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

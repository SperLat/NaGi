import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, TextInput, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { safeBack } from '@/lib/nav';
import {
  getElder,
  listIntermediaries,
  inviteIntermediary,
  type Elder,
  type ElderIntermediary,
} from '@/features/elders';
import { generateDigest, type DigestResult } from '@/features/digest';
import { TeamChatPanel } from '@/features/team-chat';
import { FriendsSection } from '@/features/connections/FriendsSection';
import { useSession } from '@/state';

export default function ElderOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [elder, setElder] = useState<Elder | null>(null);
  const [people, setPeople] = useState<ElderIntermediary[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRelation, setInviteRelation] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteNote, setInviteNote] = useState<
    { kind: 'info' | 'success'; text: string } | null
  >(null);
  const { setActiveElder, setDeviceMode, activeOrgId, userId } = useSession();

  // Weekly digest — stateless, regenerated each click. Lives in a modal
  // because it's a heavy block of text and the rest of the screen still
  // needs to be reachable underneath.
  const [digest, setDigest] = useState<DigestResult | null>(null);
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestBusy, setDigestBusy] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  const handleGenerateDigest = useCallback(async () => {
    setDigestOpen(true);
    setDigestBusy(true);
    setDigestError(null);
    try {
      const result = await generateDigest(id);
      setDigest(result);
    } catch (e) {
      setDigestError(String(e));
    } finally {
      setDigestBusy(false);
    }
  }, [id]);

  const refreshPeople = useCallback(async () => {
    const { data } = await listIntermediaries(id);
    setPeople(data);
  }, [id]);

  useEffect(() => {
    getElder(id).then(({ data }) => setElder(data));
    refreshPeople();
  }, [id, refreshPeople]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      setInviteNote({ kind: 'info', text: 'Enter their email to continue.' });
      return;
    }
    setInviteBusy(true);
    setInviteNote(null);
    const result = await inviteIntermediary(id, email, inviteRelation);
    setInviteBusy(false);

    if (result.status === 'added') {
      setInviteEmail('');
      setInviteRelation('');
      setShowInvite(false);
      setInviteNote({ kind: 'success', text: 'Added to this circle.' });
      await refreshPeople();
      return;
    }
    if (result.status === 'not_joined') {
      setInviteNote({
        kind: 'info',
        text: "That person hasn't joined Nagi yet. Ask them to sign up, then add them here.",
      });
      return;
    }
    // result.status === 'error' — show the RPC message in dev so silent
    // failures (missing migration, RLS deny, etc.) stop looking like
    // generic "try again" noise. In production fall back to the friendlier
    // copy since raw pg errors aren't useful to an intermediary.
    const devMessage = __DEV__ && result.status === 'error' ? result.message : null;
    setInviteNote({
      kind: 'info',
      text: devMessage
        ? `Could not add them: ${devMessage}`
        : 'Could not add them just now. Try again in a moment.',
    });
  };

  if (!elder) {
    return (
      <SafeAreaView className="flex-1 bg-surface-intermediary-raised items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 24 }}>
      <View className="flex-1">
        <Pressable className="mb-6" onPress={() => safeBack('/(intermediary)/')}>
          <Text className="text-accent-600 font-medium">← Back</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 mb-0.5">{elder.display_name}</Text>
        <View className="flex-row gap-2 mb-8">
          <View className="bg-accent-100 rounded-full px-2.5 py-0.5">
            <Text className="text-accent-700 text-xs font-medium">{elder.preferred_lang.toUpperCase()}</Text>
          </View>
          <View className="bg-green-100 rounded-full px-2.5 py-0.5">
            <Text className="text-green-700 text-xs font-medium">{elder.status}</Text>
          </View>
        </View>

        {/* Two ways into the elder shell:
              "Open elder interface" — preview mode, no kiosk lockdown,
                back navigation works. For the intermediary configuring.
              "Hand to <elder>" — kiosk mode, locks the device down.
                The elder owns the screen until they enter their exit PIN. */}
        <Pressable
          className="bg-accent-500 rounded-2xl py-4 items-center mb-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          onPress={async () => {
            // Clear any cached device-mode FIRST. If a prior Hand-the-
            // device routed deviceMode to {kind:'elder', elderId:<other>},
            // the (elder) layout would still resolve elderId from
            // deviceMode.elderId — shadowing the activeElderId we're
            // about to set. Setting intermediary explicitly ensures the
            // layout falls through to activeElderId for the preview.
            await setDeviceMode({ kind: 'intermediary' });
            setActiveElder(id);
            router.push('/(elder)/');
          }}
        >
          <Text className="text-paper font-semibold text-base">🧓 Preview elder interface</Text>
        </Pressable>

        {elder?.kiosk_pin_hash ? (
          <Pressable
            className="bg-accent-600 rounded-2xl py-4 items-center mb-6"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            onPress={async () => {
              await setDeviceMode({ kind: 'elder', elderId: id });
              router.replace('/(elder)/');
            }}
          >
            <Text className="text-paper font-semibold text-base">
              ✋ Hand the device to {(elder.profile as Record<string, string>)?.preferred_name ?? elder.display_name}
            </Text>
          </Pressable>
        ) : (
          <View className="bg-surface-intermediary-sunken rounded-2xl py-3 px-4 mb-6">
            <Text className="text-neutral-500 text-xs text-center">
              Set an exit PIN in <Text className="font-semibold">Configure interface</Text> to enable kiosk hand-off.
            </Text>
          </View>
        )}

        <View className="gap-3 mb-8">
          <Pressable
            className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 flex-row items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={() => router.push(`/(intermediary)/elders/${id}/configure`)}
          >
            <Text className="text-2xl mr-3">⚙️</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">Configure interface</Text>
              <Text className="text-gray-500 text-sm">Language, text size, cards</Text>
            </View>
            <Text className="text-gray-300 text-xl">›</Text>
          </Pressable>

          <Pressable
            className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 flex-row items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={() => router.push(`/(intermediary)/elders/${id}/activity`)}
          >
            <Text className="text-2xl mr-3">📊</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">Activity log</Text>
              <Text className="text-gray-500 text-sm">Where they succeed and get stuck</Text>
            </View>
            <Text className="text-gray-300 text-xl">›</Text>
          </Pressable>

          <Pressable
            className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 flex-row items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={() => router.push(`/(intermediary)/elders/${id}/conversations`)}
          >
            <Text className="text-2xl mr-3">💬</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">Conversations</Text>
              <Text className="text-gray-500 text-sm">What they actually said to Nagi</Text>
            </View>
            <Text className="text-gray-300 text-xl">›</Text>
          </Pressable>

          <Pressable
            className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 flex-row items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={() => router.push(`/(intermediary)/elders/${id}/notes`)}
          >
            <Text className="text-2xl mr-3">📓</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">Notes</Text>
              <Text className="text-gray-500 text-sm">Shared journal for the care team</Text>
            </View>
            <Text className="text-gray-300 text-xl">›</Text>
          </Pressable>

          <Pressable
            className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 flex-row items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={() => router.push(`/(intermediary)/elders/${id}/reminders`)}
          >
            <Text className="text-2xl mr-3">💊</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">Pill reminders</Text>
              <Text className="text-gray-500 text-sm">Gentle nudges at the times you set</Text>
            </View>
            <Text className="text-gray-300 text-xl">›</Text>
          </Pressable>

          <Pressable
            className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 flex-row items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={() => router.push(`/(intermediary)/elders/${id}/moments`)}
          >
            <Text className="text-2xl mr-3">✨</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">Proud moments</Text>
              <Text className="text-gray-500 text-sm">What they did, noticed, shared</Text>
            </View>
            <Text className="text-gray-300 text-xl">›</Text>
          </Pressable>

          <Pressable
            className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 flex-row items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            onPress={handleGenerateDigest}
          >
            <Text className="text-2xl mr-3">📰</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">Generate this week's summary</Text>
              <Text className="text-gray-500 text-sm">A note you can forward to family</Text>
            </View>
            <Text className="text-gray-300 text-xl">›</Text>
          </Pressable>
        </View>

        <Text className="text-xs font-medium text-gray-500 mb-2 ml-1 uppercase tracking-wide">
          Care team
        </Text>
        <View className="mb-4">
          <FriendsSection elderId={id} elderDisplayName={elder?.display_name ?? ''} />
        </View>

        <View className="mb-6">
          <TeamChatPanel elderId={id} organizationId={activeOrgId} userId={userId} />
        </View>

        <Text className="text-xs font-medium text-gray-500 mb-2 ml-1 uppercase tracking-wide">
          Their circle
        </Text>

        <View className="gap-2 mb-3">
          {people.length === 0 ? (
            <View className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100">
              <Text className="text-gray-500 text-sm">No one else yet.</Text>
            </View>
          ) : (
            people.map(p => (
              <View
                key={p.user_id}
                className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="font-semibold text-gray-900 flex-shrink">
                    {p.email}
                  </Text>
                  {p.accepted_at === null ? (
                    <View className="bg-gray-100 rounded-full px-2.5 py-0.5">
                      <Text className="text-gray-600 text-xs font-medium">Pending</Text>
                    </View>
                  ) : null}
                </View>
                {p.relation ? (
                  <Text className="text-gray-500 text-sm mt-0.5">{p.relation}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {showInvite ? (
          <View className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 gap-3">
            <View>
              <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
                Their email
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
                placeholder="name@example.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="email-address"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                editable={!inviteBusy}
              />
            </View>
            <View>
              <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
                Relation
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
                placeholder="e.g. son, nurse, neighbor"
                placeholderTextColor="#9ca3af"
                value={inviteRelation}
                onChangeText={setInviteRelation}
                editable={!inviteBusy}
              />
            </View>

            {inviteNote ? (
              <Text className="text-gray-600 text-sm">{inviteNote.text}</Text>
            ) : null}

            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                onPress={() => {
                  setShowInvite(false);
                  setInviteNote(null);
                }}
                disabled={inviteBusy}
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-accent-600 rounded-xl py-3 items-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                onPress={handleInvite}
                disabled={inviteBusy}
              >
                {inviteBusy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-paper font-semibold">Send invite</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {inviteNote ? (
              <Text className="text-gray-600 text-sm mb-2 ml-1">{inviteNote.text}</Text>
            ) : null}
            <Pressable
              className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 flex-row items-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              onPress={() => {
                setInviteNote(null);
                setShowInvite(true);
              }}
            >
              <Text className="text-2xl mr-3">➕</Text>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">Invite intermediary</Text>
                <Text className="text-gray-500 text-sm">Share the care with someone else</Text>
              </View>
            </Pressable>
          </>
        )}
      </View>
      </ScrollView>

      <DigestModal
        visible={digestOpen}
        busy={digestBusy}
        digest={digest}
        error={digestError}
        elderName={elder.display_name}
        onClose={() => setDigestOpen(false)}
        onRegenerate={handleGenerateDigest}
      />
    </SafeAreaView>
  );
}

// ── Digest modal ─────────────────────────────────────────────────────────
// Kept in this file because it's only used here and pulling apart the
// state would just push prop-drilling through nothing.

interface DigestModalProps {
  visible: boolean;
  busy: boolean;
  digest: DigestResult | null;
  error: string | null;
  elderName: string;
  onClose: () => void;
  onRegenerate: () => void;
}

function DigestModal({ visible, busy, digest, error, elderName, onClose, onRegenerate }: DigestModalProps) {
  const handleCopy = async () => {
    if (!digest?.digest_markdown) return;
    // Web (where the intermediary lives) supports navigator.clipboard
    // directly. For a tiny one-call dependency we just feature-detect
    // rather than pulling in expo-clipboard.
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(digest.digest_markdown);
      } catch {
        // swallow — copy is a nice-to-have, not a contract
      }
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-charcoal/40 items-center justify-center p-4">
        <View className="bg-surface-intermediary-raised rounded-2xl w-full max-w-2xl max-h-[85%] flex flex-col">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <Text className="text-lg font-bold text-gray-900">This week with {elderName}</Text>
            <Pressable onPress={onClose} className="px-2">
              <Text className="text-gray-400 text-xl">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
            {busy ? (
              <View className="items-center py-12">
                <ActivityIndicator color="#34503E" />
                <Text className="text-gray-500 text-sm mt-3">Reading the past 7 days…</Text>
              </View>
            ) : error ? (
              <View className="py-6">
                <Text className="text-red-700 text-sm">Could not generate a summary right now.</Text>
                {__DEV__ ? <Text className="text-gray-400 text-xs mt-2">{error}</Text> : null}
              </View>
            ) : digest ? (
              <>
                <Text className="text-gray-800 leading-relaxed" selectable>
                  {digest.digest_markdown}
                </Text>
                <View className="mt-6 pt-4 border-t border-gray-100 flex-row flex-wrap gap-x-4 gap-y-1">
                  <Text className="text-xs text-gray-400">
                    {digest.stats.questions_asked} questions
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {digest.stats.help_requests_total} help requests
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {digest.stats.errors + digest.stats.offline_unavailable} stuck moments
                  </Text>
                </View>
              </>
            ) : null}
          </ScrollView>

          <View className="flex-row gap-2 px-5 py-4 border-t border-gray-100">
            <Pressable
              className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
              onPress={onRegenerate}
              disabled={busy}
            >
              <Text className="text-gray-700 font-medium">Regenerate</Text>
            </Pressable>
            <Pressable
              className="flex-1 bg-accent-600 rounded-xl py-3 items-center"
              onPress={handleCopy}
              disabled={busy || !digest}
            >
              <Text className="text-paper font-medium">Copy to clipboard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

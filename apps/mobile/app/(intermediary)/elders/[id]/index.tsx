import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, TextInput } from 'react-native';
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
  const { setActiveElder } = useSession();

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
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#B8552B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 px-6 pt-6">
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

        <Pressable
          className="bg-accent-600 rounded-2xl py-4 items-center mb-6"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          onPress={() => {
            setActiveElder(id);
            router.push('/(elder)/');
          }}
        >
          <Text className="text-white font-semibold text-base">🧓 Open elder interface</Text>
        </Pressable>

        <View className="gap-3 mb-8">
          <Pressable
            className="bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center"
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
            className="bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center"
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
        </View>

        <Text className="text-xs font-medium text-gray-500 mb-2 ml-1 uppercase tracking-wide">
          Their circle
        </Text>

        <View className="gap-2 mb-3">
          {people.length === 0 ? (
            <View className="bg-white rounded-2xl p-4 border border-gray-100">
              <Text className="text-gray-500 text-sm">No one else yet.</Text>
            </View>
          ) : (
            people.map(p => (
              <View
                key={p.user_id}
                className="bg-white rounded-2xl p-4 border border-gray-100"
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
          <View className="bg-white rounded-2xl p-4 border border-gray-100 gap-3">
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
                  <Text className="text-white font-semibold">Send invite</Text>
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
              className="bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center"
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
    </SafeAreaView>
  );
}

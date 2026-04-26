import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import {
  createCaregiverMoment,
  deleteMoment,
  listMoments,
  setMomentPrivate,
  type ElderMoment,
} from '@/features/moments';
import { getElder, type Elder } from '@/features/elders';

const SOURCE_LABEL: Record<ElderMoment['source'], string> = {
  elder: '🧓 from elder',
  caregiver: '🤍 you logged this',
  nagi: '🌿 Nagi noticed',
};

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function ElderMomentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [elder, setElder] = useState<Elder | null>(null);
  const [moments, setMoments] = useState<ElderMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: elderData }, list] = await Promise.all([
      getElder(id),
      listMoments(id),
    ]);
    setElder(elderData);
    setMoments(list);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (!elder || loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  const firstName = elder.display_name.split(' ')[0];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Pressable className="mb-6" onPress={() => safeBack(`/(intermediary)/elders/${id}`)}>
          <Text className="text-accent-600 font-medium">← Back</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Proud moments</Text>
        <Text className="text-gray-500 text-sm mb-4">
          Small things {firstName} did, noticed, or shared. Nagi adds these from chat;
          you can add them too. Nothing here is a measurement — only the texture of the days.
        </Text>

        <Pressable
          className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100 mb-4 flex-row items-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          onPress={() => router.push(`/(intermediary)/elders/${id}/monthly-summary`)}
        >
          <Text className="text-2xl mr-3">📰</Text>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900">This month's summary</Text>
            <Text className="text-gray-500 text-sm">Save or print to share with family</Text>
          </View>
          <Text className="text-gray-300 text-xl">›</Text>
        </Pressable>

        {moments.length === 0 ? (
          <View className="bg-surface-intermediary-raised rounded-2xl p-5 border border-gray-100 mb-4">
            <Text className="text-gray-500 text-sm">
              No moments yet. They'll appear here as Nagi notices them, or as you add them.
            </Text>
          </View>
        ) : (
          <View className="gap-3 mb-4">
            {moments.map(m => (
              <MomentCard
                key={m.id}
                moment={m}
                onTogglePrivate={async () => {
                  await setMomentPrivate(m.id, !m.is_private);
                  await load();
                }}
                onDelete={
                  m.source === 'caregiver'
                    ? async () => {
                        await deleteMoment(m.id);
                        await load();
                      }
                    : undefined
                }
              />
            ))}
          </View>
        )}

        {showForm ? (
          <MomentForm
            elderId={id}
            organizationId={elder.organization_id}
            onCancel={() => setShowForm(false)}
            onCreated={async () => {
              setShowForm(false);
              await load();
            }}
          />
        ) : (
          <Pressable
            className="bg-accent-600 rounded-2xl py-4 items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            onPress={() => setShowForm(true)}
          >
            <Text className="text-paper font-semibold">+ Log a moment</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MomentCard({
  moment,
  onTogglePrivate,
  onDelete,
}: {
  moment: ElderMoment;
  onTogglePrivate: () => void;
  onDelete?: () => void;
}) {
  return (
    <View className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-500 text-xs">
          {formatDate(moment.occurred_on)} · {SOURCE_LABEL[moment.source]}
          {moment.kind ? ` · ${moment.kind}` : ''}
        </Text>
        {moment.is_private ? (
          <View className="bg-amber-100 rounded-full px-2 py-0.5">
            <Text className="text-amber-700 text-xs font-medium">Private</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-gray-900 leading-snug">{moment.body}</Text>
      <View className="flex-row gap-2 mt-3">
        <Pressable className="flex-1 bg-gray-100 rounded-xl py-2 items-center" onPress={onTogglePrivate}>
          <Text className="text-gray-700 text-sm font-medium">
            {moment.is_private ? 'Make visible to family' : 'Mark private'}
          </Text>
        </Pressable>
        {onDelete ? (
          <Pressable className="flex-1 rounded-xl py-2 items-center border border-red-200" onPress={onDelete}>
            <Text className="text-red-600 text-sm font-medium">Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MomentForm({
  elderId,
  organizationId,
  onCancel,
  onCreated,
}: {
  elderId: string;
  organizationId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!body.trim()) {
      setError('Write a sentence about what happened.');
      return;
    }
    setBusy(true);
    const result = await createCaregiverMoment({
      organization_id: organizationId,
      elder_id: elderId,
      body: body.trim(),
      kind: kind.trim() || null,
      is_private: isPrivate,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not save just now.');
      return;
    }
    onCreated();
  };

  return (
    <View className="bg-surface-intermediary-raised rounded-2xl p-5 border border-gray-100 gap-4">
      <View>
        <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">What happened?</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 min-h-24"
          placeholder="Took a walk with Frances on Tuesday — sun was out, met the neighbor's dog."
          placeholderTextColor="#9ca3af"
          value={body}
          onChangeText={setBody}
          editable={!busy}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View>
        <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Kind (optional)</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
          placeholder="walk · meal · visit · reading · hobby"
          placeholderTextColor="#9ca3af"
          value={kind}
          onChangeText={setKind}
          editable={!busy}
        />
      </View>

      <Pressable
        className="flex-row items-center"
        onPress={() => setIsPrivate(p => !p)}
      >
        <View
          className={`w-5 h-5 rounded mr-2 border ${
            isPrivate ? 'bg-amber-500 border-amber-500' : 'bg-white border-gray-300'
          }`}
        >
          {isPrivate ? (
            <Text className="text-paper text-xs text-center leading-5">✓</Text>
          ) : null}
        </View>
        <Text className="text-gray-700 text-sm">
          Keep this between us — don't include in the family digest
        </Text>
      </Pressable>

      {error ? <Text className="text-red-700 text-sm">{error}</Text> : null}

      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
          onPress={onCancel}
          disabled={busy}
        >
          <Text className="text-gray-700 font-medium">Cancel</Text>
        </Pressable>
        <Pressable
          className="flex-1 bg-accent-600 rounded-xl py-3 items-center"
          onPress={handleSave}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="white" /> : (
            <Text className="text-paper font-semibold">Save moment</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  findElderByName,
  listConnectionsForElder,
  proposeElderConnection,
  type ElderConnection,
} from '.';
import { supabase } from '@/lib/supabase';

interface Props {
  elderId: string;
  /** Display name for messaging-empty state copy. */
  elderDisplayName: string;
}

/**
 * "Friends" section on the elder profile screen — lets the caregiver
 * see this elder's existing connections (active, pending, etc.) and
 * propose a new one by searching for another elder by name.
 *
 * The proposal flow is intentionally minimal: type a name, pick from
 * the dropdown, propose. The recipient's intermediary sees a pending
 * invite on THEIR dashboard and accepts/declines from there.
 */
export function FriendsSection({ elderId, elderDisplayName }: Props) {
  const [connections, setConnections] = useState<ElderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [otherNameById, setOtherNameById] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await listConnectionsForElder(elderId);
    setConnections(rows);

    // Resolve "the other elder" name for each connection — we don't
    // store names on connections, just ids. Batch fetch via the
    // elders table; RLS may hide cross-tenant rows so we'll show
    // "(elder in another family)" as a fallback for missing rows.
    const otherIds = rows.map(c =>
      c.elder_a_id === elderId ? c.elder_b_id : c.elder_a_id,
    );
    if (otherIds.length > 0) {
      const { data } = await supabase
        .from('elders')
        .select('id, display_name')
        .in('id', otherIds);
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as Array<{ id: string; display_name: string }>) {
        map[row.id] = row.display_name;
      }
      setOtherNameById(map);
    }
    setLoading(false);
  }, [elderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View className="bg-surface-intermediary-raised rounded-2xl border border-gray-100 overflow-hidden">
      <View className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Text className="text-2xl mr-2">🤝</Text>
          <View>
            <Text className="font-semibold text-gray-900">Friends across families</Text>
            <Text className="text-gray-500 text-xs">
              Other elders {elderDisplayName.split(' ')[0]} can message
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => setProposeOpen(true)}
          style={({ pressed }) => ({
            backgroundColor: '#34503E',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text className="text-paper text-xs font-semibold">+ Connect</Text>
        </Pressable>
      </View>

      <View className="p-3">
        {loading ? (
          <View className="items-center py-4">
            <ActivityIndicator color="#34503E" />
          </View>
        ) : connections.length === 0 ? (
          <Text className="text-gray-400 text-sm text-center py-4">
            No connections yet. Tap "+ Connect" to propose one.
          </Text>
        ) : (
          connections.map(c => {
            const otherId = c.elder_a_id === elderId ? c.elder_b_id : c.elder_a_id;
            const otherName = otherNameById[otherId] ?? '(elder in another family)';
            const statusBadge = STATUS_PILLS[c.status];
            return (
              <View
                key={c.id}
                className="flex-row items-center justify-between rounded-xl bg-surface-intermediary-sunken px-3 py-2 mb-1.5"
              >
                <Text className="text-gray-900 text-sm flex-1" numberOfLines={1}>
                  {otherName}
                </Text>
                <View
                  className="rounded-full px-2 py-0.5 ml-2"
                  style={{ backgroundColor: statusBadge.bg }}
                >
                  <Text className="text-[10px] font-semibold" style={{ color: statusBadge.fg }}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <ProposeModal
        visible={proposeOpen}
        elderId={elderId}
        onClose={() => setProposeOpen(false)}
        onProposed={() => {
          setProposeOpen(false);
          void refresh();
        }}
      />
    </View>
  );
}

const STATUS_PILLS: Record<ElderConnection['status'], { label: string; bg: string; fg: string }> = {
  pending:  { label: 'PENDING',  bg: '#F2DDC4', fg: '#8B5C24' },
  active:   { label: 'ACTIVE',   bg: '#DDE5DF', fg: '#1A2E25' },
  paused:   { label: 'PAUSED',   bg: '#F0F0EE', fg: '#727270' },
  declined: { label: 'DECLINED', bg: '#F0F0EE', fg: '#727270' },
};

function ProposeModal({
  visible,
  elderId,
  onClose,
  onProposed,
}: {
  visible: boolean;
  elderId: string;
  onClose: () => void;
  onProposed: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; display_name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError(null);
      return;
    }
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    void findElderByName(query).then(r => {
      if (!cancelled) setResults(r.filter(e => e.id !== elderId));
    });
    return () => { cancelled = true; };
  }, [query, elderId, visible]);

  const propose = async (otherId: string) => {
    setBusy(true);
    setError(null);
    const result = await proposeElderConnection(elderId, otherId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onProposed();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
            padding: 24,
            maxWidth: 480,
            width: '100%',
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1E1E' }}>
            Propose a connection
          </Text>
          <Text style={{ fontSize: 14, color: '#545454', lineHeight: 20 }}>
            Search for the other elder by name. Their family member will see a
            pending invite on their dashboard and decide whether to accept.
          </Text>

          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-surface-intermediary-raised"
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. Maggie Whitmore"
            placeholderTextColor="#9ca3af"
            autoFocus
          />

          {error ? <Text style={{ color: '#C8392E', fontSize: 13 }}>{error}</Text> : null}

          <View style={{ gap: 6, maxHeight: 240 }}>
            {results.length === 0 && query.trim().length >= 2 && !busy ? (
              <Text style={{ color: '#9A9A95', fontSize: 13, fontStyle: 'italic' }}>
                No elder by that name visible to you. (You can only propose to elders whose families have signed up.)
              </Text>
            ) : null}
            {results.map(r => (
              <Pressable
                key={r.id}
                onPress={() => propose(r.id)}
                disabled={busy}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#DDE5DF' : '#FFFFFF',
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: '#E0DFDC',
                })}
              >
                <Text style={{ color: '#1E1E1E', fontSize: 14, flex: 1 }} numberOfLines={1}>
                  {r.display_name}
                </Text>
                <Text style={{ color: '#34503E', fontSize: 12, fontWeight: '600' }}>
                  Propose →
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            disabled={busy}
            style={({ pressed }) => ({
              alignSelf: 'flex-end',
              padding: 10,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: '#727270', fontSize: 14 }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

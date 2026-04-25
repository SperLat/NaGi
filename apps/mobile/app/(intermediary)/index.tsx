import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  listElders,
  listMyPendingInvitations,
  acceptInvitation,
  declineInvitation,
  type Elder,
  type PendingInvitation,
} from '@/features/elders';
import { getActiveOrg } from '@/features/auth';
import {
  listPendingRequests,
  acknowledgeHelpRequest,
  type HelpRequest,
} from '@/features/help-request';
import { signOut } from '@/features/auth';
import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import { useSession } from '@/state';

export default function IntermediaryDashboard() {
  const { activeOrgId, userId, clearSession, setSession } = useSession();
  const [elders, setElders]         = useState<Elder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [alerts, setAlerts]         = useState<HelpRequest[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const shakeAnim                   = useRef(new Animated.Value(0)).current;

  const refreshInvitations = async () => {
    const { data, error } = await listMyPendingInvitations();
    setInvitations(data);
    if (error) setInvitationError(error);
  };

  // ── Pending invitations ──────────────────────────────────────────────────
  useEffect(() => {
    refreshInvitations();
  }, [userId]);

  const handleAccept = async (inv: PendingInvitation) => {
    if (!userId) return;
    setBusyInvitationId(inv.elder_id);
    setInvitationError(null);
    const { ok, error } = await acceptInvitation(inv.elder_id);
    setBusyInvitationId(null);

    if (!ok) {
      // Same dev-mode error surfacing as the invite flow in
      // (intermediary)/elders/[id]/index.tsx — raw RPC errors in dev,
      // friendly fallback in production.
      setInvitationError(
        __DEV__ && error
          ? `Could not accept: ${error}`
          : 'Could not accept just now. Try again in a moment.',
      );
      return;
    }

    // Accepted elder may belong to a different org than activeOrgId. We
    // refetch the user's "active" org via getActiveOrg and switch them via
    // setSession. This is the cleanest path for the hackathon — useSession
    // exposes setSession (userId, orgId) and there is no dedicated
    // setActiveOrg setter. If the elder's org becomes the new active org,
    // the elder list effect re-runs automatically (activeOrgId is in its
    // deps array) and the elder appears.
    await refreshInvitations();
    if (userId) {
      const newOrgId = await getActiveOrg(userId);
      if (newOrgId && newOrgId !== activeOrgId) {
        setSession(userId, newOrgId);
      } else if (activeOrgId) {
        // Same org — just refetch the list.
        listElders(activeOrgId).then(({ data }) => {
          if (data) setElders(data);
        });
      }
    }
    // Take the user to the elder they just accepted — otherwise nothing
    // visibly happens beyond the card disappearing, which feels broken.
    router.push(`/(intermediary)/elders/${inv.elder_id}`);
  };

  const handleDecline = async (inv: PendingInvitation) => {
    setBusyInvitationId(inv.elder_id);
    setInvitationError(null);
    const { ok, error } = await declineInvitation(inv.elder_id);
    setBusyInvitationId(null);
    if (!ok) {
      setInvitationError(
        __DEV__ && error
          ? `Could not decline: ${error}`
          : 'Could not decline just now. Try again in a moment.',
      );
      return;
    }
    await refreshInvitations();
  };

  // ── Elder list ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeOrgId) { setLoading(false); return; }
    listElders(activeOrgId).then(({ data }) => {
      if (data) setElders(data);
      setLoading(false);
    });
  }, [activeOrgId]);

  // ── Help-request Realtime subscription ───────────────────────────────────
  useEffect(() => {
    if (!activeOrgId) return;

    // Load any pending requests that arrived before we subscribed
    listPendingRequests(activeOrgId).then(setAlerts);

    if (isMock) return; // Realtime unavailable in mock mode

    const channel = supabase
      .channel(`help-requests-${activeOrgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_requests',
          filter: `organization_id=eq.${activeOrgId}` },
        () => {
          // Payload does not carry elder_name — refetch the full pending list instead
          listPendingRequests(activeOrgId).then(setAlerts);
          // Shake the banner to grab attention
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
          ]).start();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeOrgId]);

  const handleAcknowledge = async (req: HelpRequest) => {
    if (!userId) return;
    await acknowledgeHelpRequest(req.id, userId);
    setAlerts(prev => prev.filter(a => a.id !== req.id));
  };

  const handleSignOut = async () => {
    await signOut();
    clearSession();
    router.replace('/(auth)/sign-in');
  };

  // IDs of elders with pending alerts (for red dot on list)
  const alertedElderIds = new Set(alerts.map(a => a.elder_id));

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-gray-900">My Elders</Text>
          <Text className="text-gray-500 text-sm mt-0.5">People you support</Text>
        </View>
        <Pressable
          className="w-10 h-10 bg-white rounded-full border border-gray-200 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          onPress={() => router.push('/(intermediary)/elders/new')}
        >
          <Text className="text-gray-600 text-lg">+</Text>
        </Pressable>
      </View>

      {/* ── Help-request alert banner ─────────────────────────────────── */}
      {alerts.length > 0 && (
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }} className="mx-6 mb-3">
          <View className="bg-safety-critical rounded-2xl px-5 py-4">
            <Text className="text-white font-bold text-base mb-1">
              Urgent help request
            </Text>
            {alerts.map(req => (
              <View key={req.id} className="flex-row items-center justify-between mt-2">
                <View>
                  <Text className="text-white font-semibold">{req.elder_name}</Text>
                  <Text className="text-safety-critical-soft text-xs">
                    {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleAcknowledge(req)}
                  className="bg-white rounded-xl px-4 py-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Text className="text-safety-critical font-semibold text-sm">Handled</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* ── Pending invitations ─────────────────────────────────────────── */}
      {invitations.length > 0 && (
        <View className="mx-6 mb-3 gap-2">
          <Text className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wide">
            Invitations
          </Text>
          {invitations.map(inv => {
            const busy = busyInvitationId === inv.elder_id;
            return (
              <View
                key={inv.elder_id}
                className="bg-white rounded-2xl p-4 border border-gray-100"
              >
                <Text className="text-gray-900 leading-snug">
                  <Text className="font-semibold">{inv.inviter_email}</Text>
                  {' invited you to help care for '}
                  <Text className="font-semibold">{inv.elder_name}</Text>
                  {inv.org_name ? (
                    <Text className="text-gray-500">{` (${inv.org_name})`}</Text>
                  ) : null}
                </Text>
                {inv.relation ? (
                  <Text className="text-gray-500 text-sm mt-1">as {inv.relation}</Text>
                ) : null}
                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 items-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    onPress={() => handleDecline(inv)}
                    disabled={busy}
                  >
                    <Text className="text-gray-700 font-medium">Decline</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-accent-600 rounded-xl py-2.5 items-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                    onPress={() => handleAccept(inv)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-semibold">Accept</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
          {invitationError ? (
            <Text className="text-gray-600 text-sm ml-1">{invitationError}</Text>
          ) : null}
        </View>
      )}

      <ScrollView className="flex-1 px-6">
        {loading ? (
          <View className="items-center pt-12">
            <ActivityIndicator color="#B8552B" />
          </View>
        ) : elders.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center">
            <Text className="text-4xl mb-3">👴</Text>
            <Text className="text-gray-500 text-sm text-center leading-relaxed">
              No elders added yet.{'\n'}Tap + to add someone you support.
            </Text>
          </View>
        ) : (
          elders.map(elder => (
            <Pressable
              key={elder.id}
              onPress={() => router.push(`/(intermediary)/elders/${elder.id}`)}
              className="bg-white rounded-2xl p-5 border border-gray-100 mb-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-lg font-semibold text-gray-900">{elder.display_name}</Text>
                    {/* Red dot if this elder has a pending alert */}
                    {alertedElderIds.has(elder.id) && (
                      <View className="w-2.5 h-2.5 rounded-full bg-safety-critical" />
                    )}
                  </View>
                  <View className="flex-row items-center mt-1.5 gap-2">
                    <View className="bg-accent-100 rounded-full px-2.5 py-0.5">
                      <Text className="text-accent-700 text-xs font-medium">
                        {elder.preferred_lang.toUpperCase()}
                      </Text>
                    </View>
                    <View
                      className={`rounded-full px-2.5 py-0.5 ${
                        elder.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          elder.status === 'active' ? 'text-green-700' : 'text-gray-500'
                        }`}
                      >
                        {elder.status}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text className="text-gray-300 text-2xl">›</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <View className="px-6 pb-6 pt-3">
        <Pressable
          className="bg-accent-600 rounded-2xl py-4 items-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          onPress={() => router.push('/(intermediary)/elders/new')}
        >
          <Text className="text-white font-semibold text-lg">Add Elder</Text>
        </Pressable>
        <Pressable
          className="items-center pt-4 pb-1"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          onPress={handleSignOut}
        >
          <Text className="text-neutral-400 text-sm">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

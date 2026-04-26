import { useCallback, useEffect, useRef, useState } from 'react';
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
  listRecentRequests,
  acknowledgeHelpRequest,
  type HelpRequest,
} from '@/features/help-request';
import { summarizeRecentActivity, type ActivitySummary } from '@/features/activity-log';
import { signOut } from '@/features/auth';
import { supabase } from '@/lib/supabase';
import { relativeTime } from '@/lib/time';
import { isMock } from '@/config/mode';
import { useSession } from '@/state';
import { Walkthrough, isWalkthroughSeen } from '@/features/walkthrough';
import {
  listMyPendingElderConnections,
  respondToElderConnection,
  type PendingElderConnection,
} from '@/features/connections';

export default function IntermediaryDashboard() {
  const { activeOrgId, userId, clearSession, setSession } = useSession();
  const [elders, setElders]         = useState<Elder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [alerts, setAlerts]         = useState<HelpRequest[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [pendingConnections, setPendingConnections] = useState<PendingElderConnection[]>([]);
  const [respondingConn, setRespondingConn] = useState<string | null>(null);
  const shakeAnim                   = useRef(new Animated.Value(0)).current;

  const refreshPendingConnections = useCallback(async () => {
    const rows = await listMyPendingElderConnections();
    setPendingConnections(rows);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void refreshPendingConnections();
  }, [userId, refreshPendingConnections]);

  const handleConnectionResponse = useCallback(
    async (connectionId: string, accept: boolean) => {
      setRespondingConn(connectionId);
      const result = await respondToElderConnection(connectionId, accept);
      setRespondingConn(null);
      if (result.ok) {
        void refreshPendingConnections();
      }
    },
    [refreshPendingConnections],
  );

  // The walkthrough is a scripted Pemberton-family demo tour, not a
  // generic onboarding — its copy names Eleanor/Frances/William and the
  // handoff step routes to Eleanor. Gate firing on actually having a
  // Pemberton seed in this org. Non-Pemberton orgs (Whitmore, García,
  // real customers) skip it. Replayable from the sidebar; skipped in
  // mock mode.
  const eleanorId = elders.find(e => e.display_name === 'Eleanor Pemberton')?.id;
  const isPembertonOrg = !!eleanorId;

  useEffect(() => {
    if (isMock) return;
    if (!isPembertonOrg) return;
    void isWalkthroughSeen().then(seen => {
      if (!seen) setWalkthroughOpen(true);
    });
  }, [isPembertonOrg]);

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

  // ── Elder list + per-elder activity summaries ────────────────────────────
  const [summaries, setSummaries] = useState<Record<string, ActivitySummary>>({});

  // Fetch per-elder summaries whenever the elder set changes. Parallel fan-out;
  // each call hits the activity_log table once with a 24h window. Cheap on the
  // hackathon scale (a handful of elders per org). Re-runs on alert refresh
  // too, so the dashboard updates when an elder uses Nagi while the caregiver
  // is watching.
  const refreshSummaries = useCallback(async (forElders: Elder[]) => {
    if (forElders.length === 0) {
      setSummaries({});
      return;
    }
    const entries = await Promise.all(
      forElders.map(async (e) => [e.id, await summarizeRecentActivity(e.id, 24)] as const),
    );
    setSummaries(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    if (!activeOrgId) { setLoading(false); return; }
    listElders(activeOrgId).then(({ data }) => {
      if (data) {
        setElders(data);
        refreshSummaries(data);
      }
      setLoading(false);
    });
  }, [activeOrgId, refreshSummaries]);

  // ── Recent (handled + pending) help-request history ──────────────────────
  // The realtime subscription below already keeps `alerts` (pending only)
  // fresh. `recent` carries the same window but includes acknowledged ones,
  // so the "Handled today" section persists after the badge clears.
  const [recent, setRecent] = useState<HelpRequest[]>([]);

  const refreshRecent = useCallback(() => {
    if (!activeOrgId) return;
    listRecentRequests(activeOrgId, 24).then(setRecent);
  }, [activeOrgId]);

  useEffect(() => { refreshRecent(); }, [refreshRecent]);

  // ── Help-request Realtime subscription ───────────────────────────────────
  useEffect(() => {
    if (!activeOrgId) return;

    // Load any pending requests that arrived before we subscribed
    listPendingRequests(activeOrgId).then(setAlerts);

    if (isMock) return; // Realtime unavailable in mock mode

    // supabase-js caches channels by name. In React 19 strict mode (or any
    // remount) the same channel object can be returned to a second mount
    // before the first mount's removeChannel() round-trip completes —
    // calling .on() on a channel that already saw .subscribe() throws
    // "cannot add postgres_changes callbacks ... after subscribe()". The
    // suffix makes each mount a brand-new channel instance and sidesteps
    // the cache entirely.
    const channelName = `help-requests-${activeOrgId}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_requests',
          filter: `organization_id=eq.${activeOrgId}` },
        () => {
          // Payload does not carry elder_name — refetch the full pending list instead
          listPendingRequests(activeOrgId).then(setAlerts);
          // Also refresh the recent history + per-elder summaries so the new
          // event surfaces in both the "Handled today" section and the elder
          // card's question count without a manual reload.
          refreshRecent();
          refreshSummaries(elders);
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
    // Move the request to the "Handled today" section. Optimistic local
    // patch first so the UI doesn't flicker, then refetch to pick up the
    // server-stamped acknowledged_at.
    setRecent(prev =>
      prev.map(r =>
        r.id === req.id
          ? { ...r, status: 'acknowledged', acknowledged_by: userId, acknowledged_at: new Date().toISOString() }
          : r,
      ),
    );
    refreshRecent();
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
          className="w-10 h-10 bg-surface-intermediary-raised rounded-full border border-gray-200 items-center justify-center"
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
            <Text className="text-paper font-bold text-base mb-1">
              Urgent help request
            </Text>
            {alerts.map(req => (
              <View key={req.id} className="flex-row items-center justify-between mt-2">
                <View>
                  <Text className="text-paper font-semibold">{req.elder_name}</Text>
                  <Text className="text-safety-critical-soft text-xs">
                    {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleAcknowledge(req)}
                  className="bg-surface-intermediary-raised rounded-xl px-4 py-2"
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
                className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100"
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
                      <Text className="text-paper font-semibold">Accept</Text>
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

      {/* ── Pending elder-to-elder connection invites ────────────────── */}
      {pendingConnections.length > 0 && (
        <View className="mx-6 mb-3 gap-2">
          <Text className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wide">
            Friend requests across families
          </Text>
          {pendingConnections.map(p => {
            const busy = respondingConn === p.connection_id;
            return (
              <View
                key={p.connection_id}
                className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100"
              >
                <Text className="text-gray-900 leading-snug">
                  <Text className="font-semibold">{p.proposer_email}</Text>
                  {' would like '}
                  <Text className="font-semibold">{p.other_elder_name}</Text>
                  {' to be friends with '}
                  <Text className="font-semibold">{p.my_elder_name}</Text>
                  {'.'}
                </Text>
                <Text className="text-gray-500 text-xs mt-1">
                  Once accepted, the two elders can send each other voice or text messages through Nagi. You can pause the connection any time.
                </Text>
                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 items-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    onPress={() => handleConnectionResponse(p.connection_id, false)}
                    disabled={busy}
                  >
                    <Text className="text-gray-700 font-medium">Decline</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-accent-600 rounded-xl py-2.5 items-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                    onPress={() => handleConnectionResponse(p.connection_id, true)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FAF5EC" />
                    ) : (
                      <Text className="text-paper font-semibold">Accept</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <ScrollView className="flex-1 px-6">
        {loading ? (
          <View className="items-center pt-12">
            <ActivityIndicator color="#34503E" />
          </View>
        ) : elders.length === 0 ? (
          <View className="bg-surface-intermediary-raised rounded-2xl p-6 border border-gray-100 items-center">
            <Text className="text-4xl mb-3">👴</Text>
            <Text className="text-gray-500 text-sm text-center leading-relaxed">
              No elders added yet.{'\n'}Tap + to add someone you support.
            </Text>
          </View>
        ) : (
          elders.map(elder => {
            const summary = summaries[elder.id];
            const aiCount = summary?.counts.ai_turn ?? 0;
            const stuckCount = (summary?.counts.error ?? 0) + (summary?.counts.offline_ai_unavailable ?? 0);
            const helpCount = recent.filter(r => r.elder_id === elder.id).length;
            return (
              <Pressable
                key={elder.id}
                onPress={() => router.push(`/(intermediary)/elders/${elder.id}`)}
                className="bg-surface-intermediary-raised rounded-2xl p-5 border border-gray-100 mb-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
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
                      {summary?.lastActiveAt ? (
                        <Text className="text-gray-400 text-xs">
                          active {relativeTime(summary.lastActiveAt)}
                        </Text>
                      ) : (
                        <Text className="text-gray-400 text-xs">no activity yet</Text>
                      )}
                    </View>
                  </View>
                  <Text className="text-gray-300 text-2xl">›</Text>
                </View>

                {/* Today's stats */}
                {summary && (aiCount > 0 || stuckCount > 0 || helpCount > 0) ? (
                  <View className="flex-row gap-4 mt-3 pt-3 border-t border-gray-100">
                    <View>
                      <Text className="text-xs text-gray-400">Questions</Text>
                      <Text className="text-base font-semibold text-gray-800">{aiCount}</Text>
                    </View>
                    {stuckCount > 0 ? (
                      <View>
                        <Text className="text-xs text-gray-400">Got stuck</Text>
                        <Text className="text-base font-semibold text-amber-600">{stuckCount}</Text>
                      </View>
                    ) : null}
                    {helpCount > 0 ? (
                      <View>
                        <Text className="text-xs text-gray-400">Help asks</Text>
                        <Text className="text-base font-semibold text-safety-critical">{helpCount}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Last few snippets — what's on her mind today */}
                {summary && summary.lastSnippets.length > 0 ? (
                  <View className="mt-3 gap-1">
                    {summary.lastSnippets.map((snip, i) => (
                      <Text key={i} className="text-gray-600 text-sm" numberOfLines={1}>
                        <Text className="text-gray-400">Asked: </Text>
                        “{snip}”
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}

        {/* ── Handled today ────────────────────────────────────────────── */}
        {recent.filter(r => r.status === 'acknowledged').length > 0 ? (
          <View className="mt-2 mb-4">
            <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 ml-1">
              Handled today
            </Text>
            <View className="bg-surface-intermediary-raised rounded-2xl border border-gray-100 overflow-hidden">
              {recent
                .filter(r => r.status === 'acknowledged')
                .slice(0, 5)
                .map((req, i, arr) => {
                  const handler = req.acknowledged_by === userId ? 'you' : 'another caregiver';
                  const when = req.acknowledged_at ? relativeTime(req.acknowledged_at) : '';
                  return (
                    <View
                      key={req.id}
                      className={`px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <Text className="text-sm text-gray-800">
                        <Text className="font-semibold">{req.elder_name}</Text>
                        <Text className="text-gray-500">{` — handled by ${handler}`}</Text>
                      </Text>
                      <Text className="text-gray-400 text-xs mt-0.5">{when}</Text>
                    </View>
                  );
                })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="px-6 pb-6 pt-3">
        <Pressable
          className="bg-accent-600 rounded-2xl py-4 items-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          onPress={() => router.push('/(intermediary)/elders/new')}
        >
          <Text className="text-paper font-semibold text-lg">Add Elder</Text>
        </Pressable>
        <View className="flex-row items-center justify-center gap-4 pt-4 pb-1">
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => router.push('/(intermediary)/settings')}
          >
            <Text className="text-neutral-400 text-sm">Settings</Text>
          </Pressable>
          <Text className="text-neutral-300">·</Text>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={handleSignOut}
          >
            <Text className="text-neutral-400 text-sm">Sign out</Text>
          </Pressable>
        </View>
      </View>
      <Walkthrough
        visible={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        elderIds={{ eleanor: eleanorId }}
      />
    </SafeAreaView>
  );
}

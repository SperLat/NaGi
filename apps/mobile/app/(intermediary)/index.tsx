import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { listElders, type Elder } from '@/features/elders';
import {
  listPendingRequests,
  acknowledgeHelpRequest,
  type HelpRequest,
} from '@/features/help-request';
import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import { useSession } from '@/state';

export default function IntermediaryDashboard() {
  const { activeOrgId, userId } = useSession();
  const [elders, setElders]         = useState<Elder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [alerts, setAlerts]         = useState<HelpRequest[]>([]);
  const shakeAnim                   = useRef(new Animated.Value(0)).current;

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
      </View>
    </SafeAreaView>
  );
}

import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import {
  listElders,
  listElderStatuses,
  listMyPendingInvitations,
  type Elder,
  type ElderStatus,
  type PendingInvitation,
} from '@/features/elders';
import { signOut } from '@/features/auth';
import { useSession } from '@/state';
import { relativeTime } from '@/lib/time';

/** "active" if the elder used the app in the last hour. Beyond that, hide. */
const ACTIVE_WINDOW_MS = 60 * 60_000;

const WIDE_BREAKPOINT = 1024;

export default function IntermediaryLayout() {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="organization" />
      <Stack.Screen name="elders/[id]/index" />
      <Stack.Screen name="elders/[id]/configure" />
      <Stack.Screen name="elders/[id]/activity" />
      <Stack.Screen name="elders/[id]/conversations" />
    </Stack>
  );

  if (!isWide) return stack;

  // Explicit `height: '100vh'` (not min-height) is needed on web because
  // react-native-screens renders the active screen with position:absolute
  // filling its parent — that requires the parent to have a real, computed
  // height. NativeWind's `min-h-screen` was unreliable here: the outer flex
  // row collapsed to 0 and the sidebar disappeared.
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        height: '100vh' as unknown as number,
      }}
    >
      <Sidebar />
      <View
        style={{ flex: 1, position: 'relative', height: '100%' as unknown as number }}
        className="bg-gray-50"
      >
        {stack}
      </View>
    </View>
  );
}

function Sidebar() {
  const { activeOrgId, userId, clearSession } = useSession();
  const pathname = usePathname();
  const [elders, setElders] = useState<Elder[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ElderStatus>>({});
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);

  // Refetch elders whenever the active org changes OR the route changes.
  // Cheap on a hackathon scale and keeps the sidebar in sync after the user
  // accepts an invitation on the dashboard (which switches activeOrgId and/or
  // changes the URL). Statuses come along on the same trigger so badges
  // stay roughly fresh as the user navigates.
  useEffect(() => {
    if (!activeOrgId) {
      setElders([]);
      setStatuses({});
      return;
    }
    listElders(activeOrgId).then(({ data }) => {
      if (data) setElders(data);
    });
    listElderStatuses(activeOrgId).then(setStatuses);
  }, [activeOrgId, pathname]);

  useEffect(() => {
    listMyPendingInvitations().then(({ data }) => setInvitations(data));
  }, [userId, pathname]);

  const handleSignOut = async () => {
    await signOut();
    clearSession();
    router.replace('/(auth)/sign-in');
  };

  const isActive = (target: string) => pathname === target || pathname.startsWith(target + '/');

  return (
    <View
      style={{ width: 280 }}
      className="bg-white border-r border-gray-200 px-4 py-6"
    >
      <Pressable onPress={() => router.push('/(intermediary)/')}>
        <Text className="text-xl font-bold text-accent-700 mb-6 px-2">Nagi</Text>
      </Pressable>

      <ScrollView className="flex-1" contentContainerStyle={{ gap: 4 }}>
        <Text className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-1">
          Elders
        </Text>
        {elders.length === 0 ? (
          <Text className="text-gray-400 text-sm px-2 py-2">No elders yet</Text>
        ) : (
          elders.map(elder => {
            const target = `/(intermediary)/elders/${elder.id}`;
            const active = isActive(`/elders/${elder.id}`);
            const status = statuses[elder.id];
            const pendingCount = status?.pending_requests_count ?? 0;
            const lastActive = status?.last_active_at;
            const isRecentlyActive =
              lastActive !== null &&
              lastActive !== undefined &&
              Date.now() - new Date(lastActive).getTime() < ACTIVE_WINDOW_MS;
            return (
              <Pressable
                key={elder.id}
                onPress={() => router.push(target)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className={`rounded-xl px-3 py-2 ${active ? 'bg-accent-100' : ''}`}
              >
                <View className="flex-row items-center">
                  <Text
                    className={`text-sm font-medium flex-1 ${
                      active ? 'text-accent-700' : 'text-gray-700'
                    }`}
                    numberOfLines={1}
                  >
                    {elder.display_name}
                  </Text>
                  {pendingCount > 0 ? (
                    <View className="ml-2 bg-red-500 rounded-full min-w-[20px] h-5 px-1.5 items-center justify-center">
                      <Text className="text-white text-[10px] font-bold">{pendingCount}</Text>
                    </View>
                  ) : null}
                </View>
                {isRecentlyActive && lastActive ? (
                  <Text className="text-[11px] text-gray-400 mt-0.5">
                    active {relativeTime(lastActive)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}

        {invitations.length > 0 && (
          <View className="mt-5">
            <Text className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-1">
              Invitations
            </Text>
            {invitations.map(inv => (
              <Pressable
                key={inv.elder_id}
                onPress={() => router.push('/(intermediary)/')}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className="rounded-xl px-3 py-2.5 flex-row items-center justify-between"
              >
                <Text className="text-sm text-gray-700 flex-1" numberOfLines={1}>
                  {inv.elder_name}
                </Text>
                <View className="bg-accent-100 rounded-full px-2 py-0.5 ml-2">
                  <Text className="text-accent-700 text-[10px] font-semibold">NEW</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="gap-1 pt-4 border-t border-gray-100">
        <Pressable
          onPress={() => router.push('/(intermediary)/elders/new')}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          className="rounded-xl px-3 py-2.5"
        >
          <Text className="text-sm font-medium text-accent-700">+ Add elder</Text>
        </Pressable>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          className="rounded-xl px-3 py-2"
        >
          <Text className="text-sm text-gray-400">Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

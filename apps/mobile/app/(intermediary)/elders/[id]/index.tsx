import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { getElder, type Elder } from '@/features/elders';
import { useSession } from '@/state';

export default function ElderOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [elder, setElder] = useState<Elder | null>(null);
  const { setActiveElder } = useSession();

  useEffect(() => {
    getElder(id).then(({ data }) => setElder(data));
  }, [id]);

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
        <Pressable className="mb-6" onPress={() => router.back()}>
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

        <View className="gap-3">
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
      </View>
    </SafeAreaView>
  );
}

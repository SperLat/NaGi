import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStrings } from '@/lib/i18n';
import { useElderCtx } from './_layout';

export const WELCOME_SEEN_KEY = 'welcome_seen';

export default function ElderWelcome() {
  const { elder } = useElderCtx();
  const s = useStrings(elder?.preferred_lang);

  // TODO: source intermediaryName from session/membership when intermediary identity
  // is wired into the elder context. For now we fall back to a generic phrasing
  // rather than invent a placeholder name.
  const firstName = elder?.display_name.split(' ')[0];
  const intermediaryName: string | undefined = undefined;

  const greeting = firstName
    ? `${s.greeting(firstName)}. ${s.welcomePrepared(intermediaryName)}`
    : s.welcomePrepared(intermediaryName);

  const handleStart = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
    } catch {
      // Persistence failure is non-fatal — they'll see welcome once more.
    }
    router.replace('/(elder)/');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-elder" style={{ backgroundColor: '#FBF7F0' }}>
      <View className="flex-1 items-center justify-center px-8">
        {/* Single decorative kanji per BRAND_MANUAL §1.2 */}
        <Text style={{ fontSize: 64 }} className="text-accent-600 mb-6">
          凪
        </Text>

        <Text
          style={{ fontSize: 28, lineHeight: 40 }}
          className="text-neutral-800 text-center font-semibold mb-12"
        >
          {greeting}
        </Text>

        <Pressable
          onPress={handleStart}
          className="bg-accent-600 rounded-2xl px-10 items-center justify-center w-full"
          style={({ pressed }) => ({
            minHeight: 56,
            paddingVertical: 16,
            opacity: pressed ? 0.82 : 1,
          })}
        >
          <Text
            style={{ fontSize: 22 }}
            className="text-white font-semibold"
          >
            {s.start}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

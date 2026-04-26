import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeBack } from '@/lib/nav';
import { logActivity } from '@/features/activity-log';
import { DailyShareToggle } from '@/features/privacy/DailyShareToggle';
import { useStrings } from '@/lib/i18n';
import { useElderCtx } from './_layout';
import { WELCOME_SEEN_KEY } from './welcome';

const CARD_EMOJIS = {
  call_family: '📞',
  get_help:    '🙋',
  my_day:      '☀️',
  one_task:    '✅',
} as const;

type CardKey = keyof typeof CARD_EMOJIS;

const TEXT_CLASS = {
  lg:  { heading: 'text-3xl', card: 'text-lg',  btn: 'text-xl' },
  xl:  { heading: 'text-4xl', card: 'text-xl',  btn: 'text-2xl' },
  '2xl': { heading: 'text-5xl', card: 'text-2xl', btn: 'text-3xl' },
};

export default function ElderHome() {
  const { elder, textSize, highContrast, orgId } = useElderCtx();
  const s = useStrings(elder?.preferred_lang);
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();

  // First-open gate: redirect to welcome if not yet seen on this device.
  // Single AsyncStorage key, no schema change. See app/(elder)/welcome.tsx.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then(value => {
        if (cancelled) return;
        if (value !== 'true') router.replace('/(elder)/welcome');
      })
      .catch(() => {}); // Storage failure: stay on home, welcome will show next launch.
    return () => { cancelled = true; };
  }, []);

  if (!elder) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  const tc = TEXT_CLASS[textSize];
  const cardKeys = (elder.ui_config.home_cards ?? Object.keys(CARD_EMOJIS)) as CardKey[];
  const bg = highContrast ? 'bg-black' : 'bg-white';
  const textColor = highContrast ? 'text-white' : 'text-gray-900';
  const cardBg = highContrast ? 'bg-gray-900 border-gray-600' : 'bg-accent-50 border-accent-100';

  // TODO: source intermediaryName from session/membership when intermediary identity
  // is wired into the elder context (see DESIGN_APP §3.4).
  const intermediaryName: string | undefined = undefined;

  const handleCard = async (key: CardKey) => {
    const cardStr = s.cards[key] ?? s.cards.get_help;
    await logActivity(elder.id, orgId, 'ui_action', { action: key, screen: 'home' });
    router.push({ pathname: '/(elder)/chat', params: { prime: cardStr.prime } });
  };

  const handleHelp = async () => {
    await logActivity(elder.id, orgId, 'ui_action', { action: 'emergency_help', screen: 'home' });
    router.push({ pathname: '/(elder)/chat', params: { prime: s.urgentHelpPrime } });
  };

  return (
    <SafeAreaView
      className={`flex-1 ${bg}`}
      style={{ backgroundColor: highContrast ? '#000000' : '#FFFFFF' }}
    >
      <View className="flex-1 px-6 pt-8 pb-4">
        {/* Exit to intermediary dashboard — only visible when pushed from that flow */}
        {canGoBack && (
          <Pressable
            onPress={() => safeBack('/(intermediary)/')}
            className="self-start mb-4 px-2 py-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="text-accent-600 text-sm font-medium">← Exit</Text>
          </Pressable>
        )}
        <Text className={`${tc.heading} font-bold ${textColor} text-center mb-2`}>
          {s.greeting(elder.display_name.split(' ')[0])}
        </Text>
        <Text className="text-accent-500 text-center mb-8 text-base">{s.subtitle}</Text>

        <View className="flex-row flex-wrap gap-4 mb-auto">
          {cardKeys.map(key => {
            const cardStr = s.cards[key];
            if (!cardStr) return null;
            return (
              <Pressable
                key={key}
                onPress={() => handleCard(key)}
                className={`rounded-3xl border items-center justify-center ${cardBg}`}
                style={({ pressed }) => [{ width: '47%', aspectRatio: 1 }, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-5xl mb-2">{CARD_EMOJIS[key]}</Text>
                <Text className={`${tc.card} font-semibold ${textColor} text-center px-2`}>
                  {cardStr.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleHelp}
          className="mt-6 bg-safety-critical-soft rounded-2xl py-5 items-center border-2 border-safety-critical-border"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Text className={`text-safety-critical font-bold ${tc.btn}`}>{s.needHelp}</Text>
        </Pressable>

        <View style={{ marginTop: 24, marginBottom: 8 }}>
          <DailyShareToggle
            elderId={elder.id}
            lang={elder.preferred_lang}
            highContrast={highContrast}
          />
        </View>

        <Text className="text-base text-neutral-500 text-center mb-2 mt-4">
          {s.preparedBy(intermediaryName ?? s.companion)}
        </Text>
      </View>
    </SafeAreaView>
  );
}

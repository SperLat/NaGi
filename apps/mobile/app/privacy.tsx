import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBack } from '@/lib/nav';
import { PRIVACY_POLICY_TEXT } from '@/features/privacy';

/**
 * In-app privacy view. Renders the constant text from
 * features/privacy/policy-text.ts with light section styling so it's
 * legible without a markdown parser dependency. Reachable from the
 * sidebar footer, the Settings screen, and the first-visit
 * transparency notice.
 */
export default function PrivacyScreen() {
  // Split into sections on '\n# '. The first section's heading is the
  // page title; subsequent sections render with a small heading.
  const blocks = PRIVACY_POLICY_TEXT.split(/\n# /).map((b, i) => (i === 0 ? b.replace(/^# /, '') : b));

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Pressable className="mb-6" onPress={() => safeBack('/')}>
          <Text className="text-accent-600 font-medium">← Back</Text>
        </Pressable>

        {blocks.map((block, i) => {
          const [heading, ...rest] = block.split('\n');
          const body = rest.join('\n').trim();
          const isTitle = i === 0;
          return (
            <View key={i} className={isTitle ? 'mb-6' : 'mb-5'}>
              <Text
                className={
                  isTitle
                    ? 'text-2xl font-bold text-gray-900 mb-2'
                    : 'text-base font-semibold text-gray-900 mb-1.5'
                }
              >
                {heading}
              </Text>
              {body ? (
                <Text className="text-sm text-gray-700 leading-relaxed" selectable>
                  {body}
                </Text>
              ) : null}
            </View>
          );
        })}

        <View className="mt-6 pt-6 border-t border-gray-200">
          <Text className="text-xs text-gray-400">
            For the full legal text including lawful-basis details and
            sub-processor agreements, see docs/PRIVACY_POLICY.md in the
            project repository.
          </Text>
          <Text className="text-xs text-gray-400 mt-2">
            Running your own copy of Nagi? See
            docs/SELF_HOST_COMPLIANCE.md for the deployment compliance
            kit and customize this page via
            apps/mobile/src/features/privacy/policy-text.ts.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

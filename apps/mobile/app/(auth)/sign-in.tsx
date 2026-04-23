import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { signIn } from '@/features/auth';
import { useSession } from '@/state';
import { isMock } from '@/config/mode';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setSession } = useSession();

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);

    if (!isMock) {
      const result = await signIn(email, password);
      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }
      if (result.userId && result.orgId) {
        setSession(result.userId, result.orgId);
      }
    }

    router.replace('/(intermediary)/');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          <View className="items-center mb-12">
            <Text className="text-6xl mb-2">凪</Text>
            <Text className="text-3xl font-bold text-gray-900">Nagi</Text>
            <Text className="text-gray-500 text-sm mt-1 text-center">
              Calm confidence with technology
            </Text>
          </View>

          {isMock && (
            <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
              <Text className="text-amber-800 text-xs font-medium text-center">
                Demo mode — tap Sign in to explore
              </Text>
            </View>
          )}

          <View className="gap-3 mb-2">
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50"
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50"
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {error && (
            <Text className="text-red-500 text-sm mb-3">{error}</Text>
          )}

          <Pressable
            className="bg-accent-600 rounded-2xl py-4 items-center mt-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">Sign in</Text>
            )}
          </Pressable>

          <Pressable className="mt-5 items-center" onPress={() => router.push('/(auth)/sign-up')}>
            <Text className="text-gray-500 text-sm">
              New here?{' '}
              <Text className="text-accent-600 font-medium">Create account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { signUp } from '@/features/auth';
import { useSession } from '@/state';
import { isMock } from '@/config/mode';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setSession } = useSession();

  const handleSignUp = async () => {
    if (!isMock && !familyName.trim()) {
      setError('Enter a name for your family group');
      return;
    }

    setLoading(true);
    setError(null);

    if (!isMock) {
      const result = await signUp(email, password, familyName.trim());
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
    <SafeAreaView className="flex-1 bg-surface-intermediary-raised">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center px-8 py-12">
            <Pressable className="mb-8" onPress={() => safeBack('/(auth)/sign-in')}>
              <Text className="text-accent-600 font-medium">← Back</Text>
            </Pressable>

            <Text className="text-2xl font-bold text-gray-900 mb-1">Create account</Text>
            <Text className="text-gray-500 text-sm mb-8">
              You'll set up elders after signing in.
            </Text>

            <View className="gap-3 mb-2">
              <View>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
                  Family group name
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50"
                  placeholder="e.g. Familia García"
                  placeholderTextColor="#9ca3af"
                  value={familyName}
                  onChangeText={setFamilyName}
                  editable={!loading}
                />
              </View>
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
                placeholder="Password (8+ characters)"
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
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">Create account</Text>
              )}
            </Pressable>

            <Pressable className="mt-5 items-center" onPress={() => safeBack('/(auth)/sign-in')}>
              <Text className="text-gray-500 text-sm">
                Already have an account?{' '}
                <Text className="text-accent-600 font-medium">Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBack } from '@/lib/nav';
import { createElder } from '@/features/elders';
import { useSession } from '@/state';

const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];

export default function NewElder() {
  const { activeOrgId } = useSession();
  const [name, setName] = useState('');
  const [lang, setLang] = useState('es');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Enter a name for the person you support');
      return;
    }
    if (!activeOrgId) return;

    setLoading(true);
    setError(null);

    await createElder({
      organization_id: activeOrgId,
      display_name: name.trim(),
      preferred_lang: lang,
    });

    safeBack('/(intermediary)/');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-intermediary-raised">
      <View className="flex-1 px-6 pt-6">
        <Pressable className="mb-6" onPress={() => safeBack('/(intermediary)/')}>
          <Text className="text-accent-600 font-medium">← Back</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Add someone you support</Text>
        <Text className="text-gray-500 text-sm mb-8">
          You can adjust their experience at any time.
        </Text>

        <View className="gap-5">
          <View>
            <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Their name</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50"
              placeholder="e.g. Abuela Rosa"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
          </View>

          <View>
            <Text className="text-xs font-medium text-gray-500 mb-2 ml-1">Preferred language</Text>
            <View className="flex-row gap-2">
              {LANGUAGES.map(l => (
                <Pressable
                  key={l.code}
                  onPress={() => setLang(l.code)}
                  className={`flex-1 py-3 rounded-xl items-center border ${
                    lang === l.code
                      ? 'bg-accent-600 border-accent-600'
                      : 'bg-surface-intermediary-raised border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      lang === l.code ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {error && <Text className="text-red-500 text-sm mt-4">{error}</Text>}

        <View className="mt-auto pb-4">
          <Pressable
            className="bg-accent-600 rounded-2xl py-4 items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">Add {name || 'them'}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

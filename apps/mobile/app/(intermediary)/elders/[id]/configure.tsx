import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { getElder, updateElder, type Elder } from '@/features/elders';

const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];

const TEXT_SIZES = [
  { value: 'lg', label: 'Normal' },
  { value: 'xl', label: 'Large' },
  { value: '2xl', label: 'X-Large' },
] as const;

export default function ElderConfigure() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [elder, setElder] = useState<Elder | null>(null);
  const [name, setName] = useState('');
  const [lang, setLang] = useState('es');
  const [textSize, setTextSize] = useState<'lg' | 'xl' | '2xl'>('xl');
  const [highContrast, setHighContrast] = useState(false);
  const [voiceInput, setVoiceInput] = useState(true);
  const [offlineMsg, setOfflineMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getElder(id).then(({ data }) => {
      if (!data) return;
      setElder(data);
      setName(data.display_name);
      setLang(data.preferred_lang);
      setTextSize((data.ui_config.text_size as 'lg' | 'xl' | '2xl') ?? 'xl');
      setHighContrast(data.ui_config.high_contrast ?? false);
      setVoiceInput(data.ui_config.voice_input ?? true);
      setOfflineMsg(data.ui_config.offline_message ?? '');
    });
  }, [id]);

  const handleSave = async () => {
    if (!elder) return;
    setSaving(true);
    await updateElder(id, {
      display_name: name.trim() || elder.display_name,
      preferred_lang: lang,
      ui_config: {
        ...elder.ui_config,
        text_size: textSize,
        high_contrast: highContrast,
        voice_input: voiceInput,
        offline_message: offlineMsg,
      },
    });
    setSaving(false);
    safeBack(`/(intermediary)/elders/${id}`);
  };

  if (!elder) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#B8552B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Pressable className="mb-6" onPress={() => safeBack(`/(intermediary)/elders/${id}`)}>
          <Text className="text-accent-600 font-medium">← Back</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Configure interface</Text>
        <Text className="text-gray-500 text-sm mb-8">{elder.display_name}</Text>

        <View className="gap-6">
          {/* Name */}
          <View>
            <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Display name</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-white"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Language */}
          <View>
            <Text className="text-xs font-medium text-gray-500 mb-2 ml-1">Language</Text>
            <View className="flex-row gap-2">
              {LANGUAGES.map(l => (
                <Pressable
                  key={l.code}
                  onPress={() => setLang(l.code)}
                  className={`flex-1 py-3 rounded-xl items-center border ${
                    lang === l.code ? 'bg-accent-600 border-accent-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-sm font-medium ${lang === l.code ? 'text-white' : 'text-gray-700'}`}>
                    {l.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Text size */}
          <View>
            <Text className="text-xs font-medium text-gray-500 mb-2 ml-1">Text size</Text>
            <View className="flex-row gap-2">
              {TEXT_SIZES.map(s => (
                <Pressable
                  key={s.value}
                  onPress={() => setTextSize(s.value)}
                  className={`flex-1 py-3 rounded-xl items-center border ${
                    textSize === s.value ? 'bg-accent-600 border-accent-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-sm font-medium ${textSize === s.value ? 'text-white' : 'text-gray-700'}`}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Toggles */}
          <View className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-1 mr-4">
                <Text className="text-gray-900 font-medium">High contrast</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Stronger borders and text</Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{ true: '#B8552B' }}
              />
            </View>
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-1 mr-4">
                <Text className="text-gray-900 font-medium">Voice input</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Microphone as primary input</Text>
              </View>
              <Switch
                value={voiceInput}
                onValueChange={setVoiceInput}
                trackColor={{ true: '#B8552B' }}
              />
            </View>
          </View>

          {/* Offline message */}
          <View>
            <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Offline fallback message</Text>
            <Text className="text-gray-400 text-xs mb-2 ml-1">
              Shown when the AI is unavailable
            </Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-white"
              multiline
              numberOfLines={3}
              value={offlineMsg}
              onChangeText={setOfflineMsg}
              placeholder="e.g. Estoy aquí contigo. Llama a tu hija si necesitas ayuda."
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-6 pt-3 bg-gray-50">
        <Pressable
          className="bg-accent-600 rounded-2xl py-4 items-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-lg">Save changes</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

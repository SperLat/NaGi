import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { getElder, updateElder, type Elder, type ElderProfile } from '@/features/elders';

/**
 * Comma → array, trimming and dropping empties.
 *
 * Caregivers type "gardening, telenovelas, her grandkids" — we don't want
 * a chips picker for v1 because that's friction without payoff. The AI
 * just needs the list; commas are the universal "or" people already use.
 */
function csvToArray(s: string): string[] {
  return s
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

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

  // About-this-person fields. Stored in elders.profile (jsonb); typed via ElderProfile.
  const [preferredName, setPreferredName] = useState('');
  const [spokenLanguages, setSpokenLanguages] = useState('');
  const [topicsEnjoy, setTopicsEnjoy] = useState('');
  const [topicsAvoid, setTopicsAvoid] = useState('');
  const [topicsKeepPrivate, setTopicsKeepPrivate] = useState('');
  const [communicationNotes, setCommunicationNotes] = useState('');
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');

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

      const p = (data.profile ?? {}) as ElderProfile;
      setPreferredName(p.preferred_name ?? '');
      setSpokenLanguages((p.spoken_languages ?? []).join(', '));
      setTopicsEnjoy((p.topics_they_enjoy ?? []).join(', '));
      setTopicsAvoid((p.topics_to_avoid ?? []).join(', '));
      setTopicsKeepPrivate((p.topics_to_keep_private ?? []).join(', '));
      setCommunicationNotes(p.communication_notes ?? '');
      setAccessibilityNotes(p.accessibility_notes ?? '');
      setEmergencyName(p.emergency_contact?.name ?? '');
      setEmergencyPhone(p.emergency_contact?.phone ?? '');
      setEmergencyRelation(p.emergency_contact?.relation ?? '');
    });
  }, [id]);

  const handleSave = async () => {
    if (!elder) return;
    setSaving(true);

    // Merge new structured fields over the existing profile so we keep any
    // legacy keys (bio/interests/common_tasks) the prompt builder still
    // reads. Only include emergency_contact when at least a name exists.
    const nextProfile: Record<string, unknown> = {
      ...(elder.profile ?? {}),
      preferred_name: preferredName.trim() || undefined,
      spoken_languages: csvToArray(spokenLanguages),
      topics_they_enjoy: csvToArray(topicsEnjoy),
      topics_to_avoid: csvToArray(topicsAvoid),
      topics_to_keep_private: csvToArray(topicsKeepPrivate),
      communication_notes: communicationNotes.trim() || undefined,
      accessibility_notes: accessibilityNotes.trim() || undefined,
      emergency_contact: emergencyName.trim()
        ? {
            name: emergencyName.trim(),
            phone: emergencyPhone.trim(),
            relation: emergencyRelation.trim(),
          }
        : undefined,
    };
    // Strip undefined so jsonb stays clean.
    for (const k of Object.keys(nextProfile)) {
      if (nextProfile[k] === undefined) delete nextProfile[k];
    }

    await updateElder(id, {
      display_name: name.trim() || elder.display_name,
      preferred_lang: lang,
      profile: nextProfile,
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
      <SafeAreaView className="flex-1 bg-surface-intermediary-raised items-center justify-center">
        <ActivityIndicator color="#34503E" />
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
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
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
                    lang === l.code ? 'bg-accent-600 border-accent-600' : 'bg-surface-intermediary-raised border-gray-200'
                  }`}
                >
                  <Text className={`text-sm font-medium ${lang === l.code ? 'text-paper' : 'text-gray-700'}`}>
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
                    textSize === s.value ? 'bg-accent-600 border-accent-600' : 'bg-surface-intermediary-raised border-gray-200'
                  }`}
                >
                  <Text className={`text-sm font-medium ${textSize === s.value ? 'text-paper' : 'text-gray-700'}`}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Toggles */}
          <View className="bg-surface-intermediary-raised rounded-2xl border border-gray-100 divide-y divide-gray-100">
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-1 mr-4">
                <Text className="text-gray-900 font-medium">High contrast</Text>
                <Text className="text-gray-500 text-xs mt-0.5">Stronger borders and text</Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{ true: '#34503E' }}
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
                trackColor={{ true: '#34503E' }}
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
              className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
              multiline
              numberOfLines={3}
              value={offlineMsg}
              onChangeText={setOfflineMsg}
              placeholder="e.g. Estoy aquí contigo. Llama a tu hija si necesitas ayuda."
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* ── About this person ──────────────────────────────────── */}
          <View className="mt-2 pt-6 border-t border-gray-200">
            <Text className="text-xl font-bold text-gray-900 mb-1">About {elder.display_name}</Text>
            <Text className="text-gray-500 text-sm mb-5">
              Helps Nagi talk to them as a real person. All optional.
            </Text>

            <View className="gap-5">
              <View>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">What they like to be called</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
                  value={preferredName}
                  onChangeText={setPreferredName}
                  placeholder={`e.g. Mami, Doña ${elder.display_name.split(' ')[0]}`}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Languages they speak</Text>
                <Text className="text-gray-400 text-xs mb-2 ml-1">Comma-separated. The first one is preferred.</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
                  value={spokenLanguages}
                  onChangeText={setSpokenLanguages}
                  placeholder="e.g. Spanish, some English"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Topics they enjoy</Text>
                <Text className="text-gray-400 text-xs mb-2 ml-1">Things to bring up when conversation lulls.</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
                  multiline
                  numberOfLines={2}
                  value={topicsEnjoy}
                  onChangeText={setTopicsEnjoy}
                  placeholder="e.g. her grandkids Leo and Sofia, gardening, telenovelas"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Topics to handle gently</Text>
                <Text className="text-gray-400 text-xs mb-2 ml-1">Don't raise these first.</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
                  multiline
                  numberOfLines={2}
                  value={topicsAvoid}
                  onChangeText={setTopicsAvoid}
                  placeholder="e.g. her late husband, her recent diagnosis"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
                  Topics to keep private from family
                </Text>
                <Text className="text-gray-400 text-xs mb-2 ml-1">
                  When the conversation drifts here, Nagi handles the moment
                  with them but the substance won't appear on this dashboard.
                  You'll see "a private moment" with a timestamp.
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
                  multiline
                  numberOfLines={2}
                  value={topicsKeepPrivate}
                  onChangeText={setTopicsKeepPrivate}
                  placeholder="e.g. money worries, an old friend she misses, anything she asks to keep secret"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Communication notes</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
                  multiline
                  numberOfLines={3}
                  value={communicationNotes}
                  onChangeText={setCommunicationNotes}
                  placeholder="e.g. Speak slowly. Repeat important answers in different words. Some memory issues — don't quiz."
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Accessibility notes</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
                  multiline
                  numberOfLines={3}
                  value={accessibilityNotes}
                  onChangeText={setAccessibilityNotes}
                  placeholder="e.g. Glaucoma — describe images verbally. Hard of hearing on left side."
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View className="bg-surface-intermediary-raised rounded-2xl border border-gray-100 p-4">
                <Text className="text-gray-900 font-medium mb-1">Trusted person</Text>
                <Text className="text-gray-500 text-xs mb-3">Who Nagi suggests calling for things outside its scope.</Text>
                <View className="gap-2">
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-surface-intermediary-raised"
                    value={emergencyName}
                    onChangeText={setEmergencyName}
                    placeholder="Name (e.g. Carlos)"
                    placeholderTextColor="#9ca3af"
                  />
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-surface-intermediary-raised"
                    value={emergencyPhone}
                    onChangeText={setEmergencyPhone}
                    placeholder="Phone"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-surface-intermediary-raised"
                    value={emergencyRelation}
                    onChangeText={setEmergencyRelation}
                    placeholder="Relation (e.g. son, daughter)"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
            </View>
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
            <Text className="text-paper font-semibold text-lg">Save changes</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBack } from '@/lib/nav';
import { getMyProfile, setMyDisplayName } from '@/features/user-profile';
import { setDevicePin, isDevicePinSet, clearDevicePin } from '@/lib/kiosk';
import { supabase } from '@/lib/supabase';

/**
 * Caregiver-side account settings. v1 surfaces just one field — the
 * display name — because it's the load-bearing one for brand voice
 * (care-circle attribution, digest narrative, kiosk preparedBy). More
 * settings (notifications, default language, etc.) accrete here later.
 */
export default function CaregiverSettings() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Device PIN management — separate state so it can save independently
  // of the display-name. The PIN itself is never displayed (only hash
  // round-trips); we just show whether one is set.
  const [pinSet, setPinSet] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinSavedAt, setPinSavedAt] = useState<number | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (cancelled) return;
      setEmail(userRes?.user?.email ?? '');
      const profile = await getMyProfile();
      if (cancelled) return;
      setName(profile?.display_name ?? '');
      const has = await isDevicePinSet();
      if (cancelled) return;
      setPinSet(has);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await setMyDisplayName(name);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not save.');
      return;
    }
    setSavedAt(Date.now());
  };

  const handleSavePin = async () => {
    setPinError(null);
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('PIN must be 4 digits.');
      return;
    }
    setPinSaving(true);
    try {
      await setDevicePin(newPin);
      setPinSet(true);
      setNewPin('');
      setPinSavedAt(Date.now());
    } catch (err) {
      setPinError(String((err as Error).message ?? err));
    } finally {
      setPinSaving(false);
    }
  };

  const handleClearPin = async () => {
    setPinError(null);
    setPinSaving(true);
    try {
      await clearDevicePin();
      setPinSet(false);
      setPinSavedAt(Date.now());
    } catch (err) {
      setPinError(String((err as Error).message ?? err));
    } finally {
      setPinSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 }}>
        <Pressable className="mb-6" onPress={() => safeBack('/(intermediary)/')}>
          <Text className="text-accent-600 font-medium">← Back</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Settings</Text>
        <Text className="text-gray-500 text-sm mb-8">{email}</Text>

        <View>
          <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
            How others see you
          </Text>
          <Text className="text-gray-400 text-xs mb-2 ml-1">
            Shown in the care circle, the weekly digest, and on the elder's
            kiosk. Leave blank to fall back to your email handle.
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised"
            value={name}
            onChangeText={setName}
            placeholder={`e.g. Emma, Don Carlos, Mom`}
            placeholderTextColor="#9ca3af"
            maxLength={80}
          />
          {error ? (
            <Text className="text-red-600 text-xs mt-2 ml-1">{error}</Text>
          ) : savedAt ? (
            <Text className="text-accent-700 text-xs mt-2 ml-1">Saved.</Text>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="bg-accent-600 rounded-2xl py-3.5 items-center mt-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-paper font-semibold">Save</Text>
            )}
          </Pressable>
        </View>

        {/* ── Device PIN ──────────────────────────────────────────── */}
        <View className="mt-10 pt-6 border-t border-gray-200">
          <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
            Device PIN
          </Text>
          <Text className="text-gray-400 text-xs mb-2 ml-1">
            4 digits. {pinSet
              ? 'A PIN is set. Enter a new one to replace it, or remove it below.'
              : 'No PIN yet. Optional — sets the unlock code that returns to your dashboard after handing the device to an elder.'}
          </Text>
          <View className="flex-row gap-2 items-center">
            <TextInput
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 bg-surface-intermediary-raised tracking-widest"
              value={newPin}
              onChangeText={t => setNewPin(t.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              placeholderTextColor="#cbd5e1"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />
            <Pressable
              onPress={handleSavePin}
              disabled={pinSaving || newPin.length !== 4}
              className={`rounded-xl px-4 py-3.5 ${newPin.length === 4 ? 'bg-accent-600' : 'bg-gray-200'}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            >
              {pinSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className={`font-semibold text-sm ${newPin.length === 4 ? 'text-paper' : 'text-gray-400'}`}>
                  {pinSet ? 'Replace' : 'Set PIN'}
                </Text>
              )}
            </Pressable>
          </View>
          {pinError ? (
            <Text className="text-red-600 text-xs mt-2 ml-1">{pinError}</Text>
          ) : pinSavedAt ? (
            <Text className="text-accent-700 text-xs mt-2 ml-1">Saved.</Text>
          ) : null}

          {pinSet ? (
            <Pressable
              onPress={handleClearPin}
              disabled={pinSaving}
              className="mt-3 ml-1"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="text-red-600 text-xs">Remove device PIN</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

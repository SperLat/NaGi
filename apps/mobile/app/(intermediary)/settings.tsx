import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { getMyProfile, setMyDisplayName } from '@/features/user-profile';
import { setDevicePin, isDevicePinSet, clearDevicePin } from '@/lib/kiosk';
import { deleteMyAccount, exportMyData } from '@/features/account';
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

  // GDPR controls — Art. 17 erasure, Art. 20 portability.
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    const result = await exportMyData();
    setExporting(false);
    if (!result.ok) setExportError(result.error ?? 'Could not export.');
  };

  const handleDelete = async () => {
    setDeleteError(null);
    if (deleteConfirmText.toLowerCase().trim() !== 'delete my account') {
      setDeleteError('Type "delete my account" exactly to confirm.');
      return;
    }
    setDeleting(true);
    const result = await deleteMyAccount();
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error ?? 'Could not delete just now.');
      return;
    }
    // Account is gone + we're signed out. Route to auth.
    router.replace('/(auth)/sign-in');
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

        {/* ── Privacy controls (GDPR Art. 17 / Art. 20) ──────────── */}
        <View className="mt-10 pt-6 border-t border-gray-200">
          <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
            Your data
          </Text>
          <Text className="text-gray-400 text-xs mb-4 ml-1">
            Export everything Nagi has about you, or delete your account.
          </Text>

          <Pressable
            onPress={handleExport}
            disabled={exporting}
            className="bg-surface-intermediary-raised border border-gray-200 rounded-2xl py-3.5 items-center mb-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {exporting ? (
              <ActivityIndicator color="#34503E" />
            ) : (
              <Text className="text-gray-800 font-semibold">Download my data</Text>
            )}
          </Pressable>
          {exportError ? (
            <Text className="text-red-600 text-xs mb-3 ml-1">{exportError}</Text>
          ) : null}

          <Pressable
            onPress={() => setDeleteOpen(true)}
            className="mt-2 ml-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="text-red-600 text-xs">Delete my account</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(26,23,20,0.6)' }}>
          <View className="bg-white rounded-3xl p-6 w-full max-w-md">
            <Text className="text-lg font-bold text-gray-900 mb-2">Delete your account?</Text>
            <Text className="text-gray-600 text-sm mb-2">
              This removes your profile, your device PIN, your care-circle posts,
              and unlinks you from every elder you care for. Other caregivers
              keep access to those elders.
            </Text>
            <Text className="text-gray-600 text-sm mb-4">
              Elders for whom you were the only caregiver remain in the database
              under the org's ownership. Contact support if you also need them
              removed.
            </Text>
            <Text className="text-xs font-medium text-gray-500 mb-1.5">
              Type <Text className="font-semibold">delete my account</Text> to confirm:
            </Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 mb-3"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="delete my account"
              placeholderTextColor="#9ca3af"
            />
            {deleteError ? (
              <Text className="text-red-600 text-xs mb-2">{deleteError}</Text>
            ) : null}
            <View className="flex-row gap-2 mt-2">
              <Pressable
                onPress={() => { setDeleteOpen(false); setDeleteConfirmText(''); setDeleteError(null); }}
                disabled={deleting}
                className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 rounded-xl py-3 items-center"
              >
                {deleting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-paper font-semibold">Delete forever</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

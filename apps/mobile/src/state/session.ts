import { create } from 'zustand';
import { isMock } from '@/config/mode';
import { MOCK_ORG_ID, MOCK_USER_ID } from '@/lib/mock/fixtures';
import {
  getDeviceMode,
  setDeviceMode as persistDeviceMode,
  type DeviceMode,
} from '@/lib/kiosk';

interface SessionState {
  userId: string | null;
  activeOrgId: string | null;
  activeElderId: string | null;
  /** Device-level mode lock. null until kiosk hydration finishes. */
  deviceMode: DeviceMode;
  /** True once both auth and kiosk hydration have completed. */
  hydrated: boolean;
  setSession: (userId: string, orgId: string) => void;
  setActiveElder: (elderId: string | null) => void;
  setDeviceMode: (mode: DeviceMode) => Promise<void>;
  clearSession: () => void;
  setHydrated: () => void;
}

// Mock mode: session is pre-populated at store creation time — already hydrated.
// Real mode: hydrated becomes true after the first Supabase auth callback fires
// AND the persisted device mode is loaded from AsyncStorage.
export const useSession = create<SessionState>(set => ({
  userId: isMock ? MOCK_USER_ID : null,
  activeOrgId: isMock ? MOCK_ORG_ID : null,
  activeElderId: isMock ? 'elder-demo-0001' : null,
  deviceMode: null,
  hydrated: isMock,
  setSession: (userId, activeOrgId) => set({ userId, activeOrgId }),
  setActiveElder: elderId => set({ activeElderId: elderId }),
  setDeviceMode: async mode => {
    await persistDeviceMode(mode);
    set({ deviceMode: mode });
  },
  clearSession: () =>
    set({
      userId: null,
      activeOrgId: null,
      activeElderId: null,
      // deviceMode is cleared explicitly via the kiosk reset on sign-out;
      // we don't touch it here so that an in-progress lock-screen flow
      // can still see the prior mode if needed.
    }),
  setHydrated: () => set({ hydrated: true }),
}));

// ── Selectors ────────────────────────────────────────────────────────
//
// Use these helpers when reading "the current elder" so every consumer
// agrees on the resolution rule. Two state fields conspire to identify
// the active elder:
//   - deviceMode.elderId — set when the device is in kiosk mode (an
//     elder is using it). This wins when present: a handed-over device
//     is locked TO that elder, full stop.
//   - activeElderId — the legacy preview path, set when an intermediary
//     is previewing what an elder will see without entering kiosk.
//
// Bugs surface when readers pick one field and ignore the other —
// chat.tsx used to bounce out of kiosk because it only checked
// activeElderId. Always go through this selector.
export const selectActiveElderId = (s: SessionState): string | null =>
  s.deviceMode?.kind === 'elder' ? s.deviceMode.elderId : (s.activeElderId ?? null);

// Hydrate device mode from AsyncStorage once at module load. The result
// is set into the store regardless of mock mode (mock mode just doesn't
// USE the device mode for routing — it short-circuits to intermediary).
if (!isMock) {
  void getDeviceMode().then(mode => {
    useSession.setState({ deviceMode: mode });
  });
}

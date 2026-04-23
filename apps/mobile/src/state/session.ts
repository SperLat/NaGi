import { create } from 'zustand';
import { isMock } from '@/config/mode';
import { MOCK_ORG_ID, MOCK_USER_ID } from '@/lib/mock/fixtures';

interface SessionState {
  userId: string | null;
  activeOrgId: string | null;
  activeElderId: string | null;
  /** True once the auth state has been determined (immediately in mock mode,
   *  after the first onAuthStateChange callback in real mode). */
  hydrated: boolean;
  setSession: (userId: string, orgId: string) => void;
  setActiveElder: (elderId: string | null) => void;
  clearSession: () => void;
  setHydrated: () => void;
}

// Mock mode: session is pre-populated at store creation time — already hydrated.
// Real mode: hydrated becomes true after the first Supabase auth callback fires.
export const useSession = create<SessionState>(set => ({
  userId: isMock ? MOCK_USER_ID : null,
  activeOrgId: isMock ? MOCK_ORG_ID : null,
  activeElderId: isMock ? 'elder-demo-0001' : null,
  hydrated: isMock,
  setSession: (userId, activeOrgId) => set({ userId, activeOrgId }),
  setActiveElder: elderId => set({ activeElderId: elderId }),
  clearSession: () => set({ userId: null, activeOrgId: null, activeElderId: null }),
  setHydrated: () => set({ hydrated: true }),
}));

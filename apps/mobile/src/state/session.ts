import { create } from 'zustand';
import { isMock } from '@/config/mode';
import { MOCK_ORG_ID, MOCK_USER_ID } from '@/lib/mock/fixtures';

interface SessionState {
  userId: string | null;
  activeOrgId: string | null;
  activeElderId: string | null;
  setSession: (userId: string, orgId: string) => void;
  setActiveElder: (elderId: string | null) => void;
  clearSession: () => void;
}

// Step 4 hydrates this from real Supabase auth on sign-in.
export const useSession = create<SessionState>(set => ({
  userId: isMock ? MOCK_USER_ID : null,
  activeOrgId: isMock ? MOCK_ORG_ID : null,
  activeElderId: isMock ? 'elder-demo-0001' : null,
  setSession: (userId, activeOrgId) => set({ userId, activeOrgId }),
  setActiveElder: elderId => set({ activeElderId: elderId }),
  clearSession: () => set({ userId: null, activeOrgId: null, activeElderId: null }),
}));

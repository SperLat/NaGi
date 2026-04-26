// Tiny store for the demo walkthrough's open/closed state.
//
// Lives outside the dashboard component so the sidebar's "Replay tour"
// button (in app/(intermediary)/_layout.tsx) can directly trigger the
// modal without route navigation tricks. The previous URL-param
// approach (router.replace('?replay=1')) didn't survive expo-router's
// param parsing reliably and we burned a deploy debugging it.
//
// One subscriber (the dashboard) reads `isOpen` and renders <Walkthrough/>;
// any caller can `open()` or `close()`. Same module-singleton shape as
// the session store at @/state.

import { create } from 'zustand';

interface WalkthroughState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useWalkthrough = create<WalkthroughState>(set => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

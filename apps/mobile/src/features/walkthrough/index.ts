// First-time tour for the intermediary dashboard.
//
// Triggered automatically on first dashboard mount when the
// `@nagi/walkthrough_seen_v1` flag is unset. Also replayable on demand
// via the "Replay tour" button in the sidebar — judges who dismissed
// it accidentally can bring it back.
//
// The walkthrough is intentionally hard-coded to the Pemberton demo
// family at v1: it references Eleanor by name, mentions the 5678 PIN,
// and points at specific recall prompts that we know the seed includes.
// Generalizing to any family is a v2 task — we'd dynamically build the
// slides from the elder list and their profile fields.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@nagi/walkthrough_seen_v1';

export async function isWalkthroughSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
}

export async function markWalkthroughSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, 'true');
}

/** Used by the "Replay tour" button to force the walkthrough open again. */
export async function resetWalkthrough(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export { Walkthrough } from './Walkthrough';
export { useWalkthrough } from './state';

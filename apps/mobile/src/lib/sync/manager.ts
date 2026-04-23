// Sync manager: orchestrates drain + pull, triggered on app foreground.
import { AppState, AppStateStatus } from 'react-native';
import { isMock } from '@/config/mode';
import { drainOutbox } from './drain';
import { pullElders, pullActivityLog } from './pull';

let _syncing = false;

async function runSync(organizationId: string): Promise<void> {
  if (_syncing || isMock) return;
  _syncing = true;
  try {
    await drainOutbox();
    await pullElders(organizationId);
    await pullActivityLog(organizationId);
  } catch {
    // Sync errors are non-fatal; individual outbox errors are already persisted.
  } finally {
    _syncing = false;
  }
}

export function startSyncManager(organizationId: string): () => void {
  if (isMock) return () => {};

  const onStateChange = (state: AppStateStatus) => {
    if (state === 'active') runSync(organizationId);
  };

  const subscription = AppState.addEventListener('change', onStateChange);

  // Run immediately on mount.
  runSync(organizationId);

  return () => subscription.remove();
}

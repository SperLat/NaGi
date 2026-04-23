/**
 * Low-level AsyncStorage helpers for the outbox queue.
 *
 * All ops are stored under a single key as a JSON array. A single-key layout
 * avoids per-op key overhead and makes atomic reads simple.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OutboxOp } from './types';

const STORAGE_KEY = 'nagi:outbox:v1';

export async function readQueue(): Promise<OutboxOp[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OutboxOp[];
  } catch {
    return [];
  }
}

export async function writeQueue(ops: OutboxOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    // Storage write failure: non-fatal, op will be retried on next drain attempt.
  }
}

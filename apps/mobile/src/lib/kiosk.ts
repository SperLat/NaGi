// Device-level kiosk lock primitives.
//
// Two PINs gate the boundary between the elder surface and the
// intermediary dashboard on the same device:
//
//   - Elder PIN  — per-elder, hashed and stored in elders.kiosk_pin_*.
//                  Required to exit elder mode into a "locked" state.
//   - Device PIN — per-device, hashed and stored in AsyncStorage.
//                  Required to enter intermediary mode from "locked".
//
// All hashing is SHA-256 over (salt + ":" + pin). The threat model is
// physical-access elder against incidental navigation, NOT a determined
// attacker — see docs/PHILOSOPHY.md and the plan file for the framing.
//
// On Expo Web, expo-crypto's digestStringAsync transparently uses
// crypto.subtle. Same call site for native and web.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// ── Storage keys ──────────────────────────────────────────────────────
const K_DEVICE_MODE = '@nagi/device_mode';
const K_DEVICE_PIN_HASH = '@nagi/device_pin_hash';
const K_DEVICE_PIN_SALT = '@nagi/device_pin_salt';
const K_FAILED_ATTEMPTS = '@nagi/pin_failed_attempts';

// ── Device mode ───────────────────────────────────────────────────────

export type DeviceMode =
  | { kind: 'intermediary' }
  | { kind: 'elder'; elderId: string }
  | { kind: 'locked' }
  | null;

export async function getDeviceMode(): Promise<DeviceMode> {
  const raw = await AsyncStorage.getItem(K_DEVICE_MODE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceMode;
  } catch {
    return null;
  }
}

export async function setDeviceMode(mode: DeviceMode): Promise<void> {
  if (mode === null) {
    await AsyncStorage.removeItem(K_DEVICE_MODE);
    return;
  }
  await AsyncStorage.setItem(K_DEVICE_MODE, JSON.stringify(mode));
}

// ── Hashing ───────────────────────────────────────────────────────────

/** 16 random bytes hex-encoded (32 chars). */
async function newSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hash(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

/**
 * Hash a PIN with a fresh salt. Returns both so the caller can persist
 * them together (the hash is meaningless without its salt).
 */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = await newSalt();
  return { hash: await hash(pin, salt), salt };
}

/** Constant-time-ish equality check. */
function eq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(
  pin: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  const computed = await hash(pin, storedSalt);
  return eq(computed, storedHash);
}

// ── Device PIN (per-device, AsyncStorage) ─────────────────────────────

export async function isDevicePinSet(): Promise<boolean> {
  const h = await AsyncStorage.getItem(K_DEVICE_PIN_HASH);
  const s = await AsyncStorage.getItem(K_DEVICE_PIN_SALT);
  return Boolean(h && s);
}

export async function setDevicePin(pin: string): Promise<void> {
  const { hash, salt } = await hashPin(pin);
  await AsyncStorage.multiSet([
    [K_DEVICE_PIN_HASH, hash],
    [K_DEVICE_PIN_SALT, salt],
  ]);
}

export async function verifyDevicePin(pin: string): Promise<boolean> {
  const [[, h], [, s]] = await AsyncStorage.multiGet([K_DEVICE_PIN_HASH, K_DEVICE_PIN_SALT]);
  if (!h || !s) return false;
  return verifyPin(pin, h, s);
}

export async function clearDevicePin(): Promise<void> {
  await AsyncStorage.multiRemove([K_DEVICE_PIN_HASH, K_DEVICE_PIN_SALT]);
}

/**
 * Full device-side reset. Called on Supabase sign-out: a different user
 * means a different lock, so the previous device PIN and mode must go.
 */
export async function resetKioskDeviceState(): Promise<void> {
  await AsyncStorage.multiRemove([
    K_DEVICE_MODE,
    K_DEVICE_PIN_HASH,
    K_DEVICE_PIN_SALT,
    K_FAILED_ATTEMPTS,
  ]);
}

// ── Failed-attempt cooldown ───────────────────────────────────────────
//
// Rolling window: 5 wrong PINs within 5 min triggers a 60s cooldown.
// Persisted across app kills so force-quitting doesn't reset the counter.

const FAIL_WINDOW_MS = 5 * 60 * 1000;
const FAIL_THRESHOLD = 5;
const COOLDOWN_MS = 60 * 1000;

interface FailRecord {
  /** UNIX ms timestamps of recent failed attempts. */
  attempts: number[];
  /** UNIX ms when current cooldown ends, or 0 if no active cooldown. */
  cooldownUntil: number;
}

async function readFails(): Promise<FailRecord> {
  const raw = await AsyncStorage.getItem(K_FAILED_ATTEMPTS);
  if (!raw) return { attempts: [], cooldownUntil: 0 };
  try {
    return JSON.parse(raw) as FailRecord;
  } catch {
    return { attempts: [], cooldownUntil: 0 };
  }
}

async function writeFails(rec: FailRecord): Promise<void> {
  await AsyncStorage.setItem(K_FAILED_ATTEMPTS, JSON.stringify(rec));
}

/** Returns ms remaining if currently cooling down, else 0. */
export async function cooldownRemainingMs(): Promise<number> {
  const rec = await readFails();
  const remain = rec.cooldownUntil - Date.now();
  return remain > 0 ? remain : 0;
}

/**
 * Record a failed attempt. If the rolling-window threshold is hit, sets
 * a cooldown deadline and clears the attempt history (next failure
 * starts a fresh window after the cooldown).
 */
export async function recordFailedAttempt(): Promise<void> {
  const now = Date.now();
  const rec = await readFails();
  // If already cooling down, do nothing — caller should have checked.
  if (rec.cooldownUntil > now) return;

  const recent = rec.attempts.filter(t => now - t < FAIL_WINDOW_MS);
  recent.push(now);

  if (recent.length >= FAIL_THRESHOLD) {
    await writeFails({ attempts: [], cooldownUntil: now + COOLDOWN_MS });
  } else {
    await writeFails({ attempts: recent, cooldownUntil: 0 });
  }
}

/** Clears attempt counters after a successful PIN entry. */
export async function recordSuccessfulAttempt(): Promise<void> {
  await writeFails({ attempts: [], cooldownUntil: 0 });
}

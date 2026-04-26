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

// ── Device PIN (per-user, DB-backed, AsyncStorage as write-through cache) ──
//
// Source of truth lives on user_kiosk_pins (migration 0026). The local
// keys remain as a fast-path cache so verify on the lock screen doesn't
// require a round-trip on every digit. On miss/mismatch, fall through
// to the DB. On any successful DB write, refresh the cache so subsequent
// verifies stay local.
//
// Why both layers: web kiosk can't rely on localStorage alone (gets
// cleared by browser cleanup with no recovery path), and a DB-only
// path would round-trip on every entry attempt of a 4-digit PIN —
// laggy AND chatty.

import { supabase } from '@/lib/supabase';

async function dbWritePin(hash: string, salt: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('user_kiosk_pins')
    .upsert(
      { user_id: u.user.id, pin_hash: hash, pin_salt: salt, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(error.message);
}

async function dbReadPin(): Promise<{ hash: string; salt: string } | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  const { data } = await supabase
    .from('user_kiosk_pins')
    .select('pin_hash, pin_salt')
    .eq('user_id', u.user.id)
    .maybeSingle();
  if (!data) return null;
  const row = data as { pin_hash: string; pin_salt: string };
  return { hash: row.pin_hash, salt: row.pin_salt };
}

async function dbDeletePin(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return;
  await supabase.from('user_kiosk_pins').delete().eq('user_id', u.user.id);
}

async function cacheWrite(hash: string, salt: string): Promise<void> {
  await AsyncStorage.multiSet([
    [K_DEVICE_PIN_HASH, hash],
    [K_DEVICE_PIN_SALT, salt],
  ]);
}

/**
 * True if any source — DB or local cache — believes a PIN is set. The
 * cache is the fast path; DB is consulted only when the cache is empty,
 * so an offline caregiver with a cached PIN still sees "set".
 */
export async function isDevicePinSet(): Promise<boolean> {
  const [[, h], [, s]] = await AsyncStorage.multiGet([K_DEVICE_PIN_HASH, K_DEVICE_PIN_SALT]);
  if (h && s) return true;
  const remote = await dbReadPin();
  return remote !== null;
}

/**
 * Persist a new PIN. Writes DB first (source of truth), then updates
 * the cache. If the DB write fails (offline, RLS hiccup), the cache
 * stays untouched and the caller sees the error.
 */
export async function setDevicePin(pin: string): Promise<void> {
  const { hash, salt } = await hashPin(pin);
  await dbWritePin(hash, salt);
  await cacheWrite(hash, salt);
}

/**
 * Verify a PIN against either layer. Cache first (no network), then
 * DB. If the DB row is present and the cache wasn't, populate the
 * cache on the way out so the next verify is fast.
 *
 * Migration shim: if the cache has a hash that matches but DB has no
 * row, mirror it up. Lets pre-0026 caregivers carry their existing
 * localStorage PIN forward without re-entry.
 */
export async function verifyDevicePin(pin: string): Promise<boolean> {
  const [[, cachedHash], [, cachedSalt]] = await AsyncStorage.multiGet([
    K_DEVICE_PIN_HASH,
    K_DEVICE_PIN_SALT,
  ]);

  if (cachedHash && cachedSalt) {
    const ok = await verifyPin(pin, cachedHash, cachedSalt);
    if (ok) {
      // Migrate up: cache had it but DB might not.
      try {
        const remote = await dbReadPin();
        if (!remote) await dbWritePin(cachedHash, cachedSalt).catch(() => {});
      } catch { /* offline or RLS — fine, cache verified locally */ }
      return true;
    }
    // Cache mismatch — try DB in case the user updated their PIN on
    // another device and this device's cache is stale.
  }

  const remote = await dbReadPin();
  if (!remote) return false;

  const ok = await verifyPin(pin, remote.hash, remote.salt);
  if (ok) {
    // Refresh the cache so next verify is local.
    await cacheWrite(remote.hash, remote.salt);
  }
  return ok;
}

/**
 * Clear from both layers. Used by sign-out and by the "Forgot PIN"
 * recovery on /locked (caregiver with a valid session can always
 * reset their own PIN — same threat model as before, with a real
 * recovery path now).
 */
export async function clearDevicePin(): Promise<void> {
  await AsyncStorage.multiRemove([K_DEVICE_PIN_HASH, K_DEVICE_PIN_SALT]);
  await dbDeletePin().catch(() => {});
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

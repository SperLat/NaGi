import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, Vibration, Platform } from 'react-native';
import {
  cooldownRemainingMs,
  recordFailedAttempt,
  recordSuccessfulAttempt,
} from '@/lib/kiosk';

interface Props {
  /** Total digits the PIN should have. Default 4. */
  length?: number;
  /**
   * Verifier called with the typed PIN string. Returns whether it
   * matched. The component handles cooldown + failure tracking around
   * this — the caller just answers true/false.
   */
  onVerify: (pin: string) => Promise<boolean>;
  /** Called when verifier returns true. PIN cleared automatically. */
  onSuccess: () => void;
  /**
   * Optional: called when verifier returns false. Component will already
   * have recorded the failed attempt. Caller can use this to e.g. close
   * a modal silently per brand voice (no error feedback).
   */
  onFailure?: () => void;
  /** Optional headline shown above the dots. Defaults to no headline. */
  prompt?: string;
  /**
   * If true, ignore the global cooldown and refuse all input until it
   * elapses. The component shows a quiet "Try again in Ns" message.
   * Default true.
   */
  respectCooldown?: boolean;
}

/**
 * Numeric PIN keypad that fills a fixed-length buffer and verifies on
 * completion. Behavior matches the brand voice: silent on failure,
 * generous on success, no celebratory text. Cooldown surfaces calmly
 * ("Try again in Ns") rather than as an error.
 */
export function PinEntry({
  length = 4,
  onVerify,
  onSuccess,
  onFailure,
  prompt,
  respectCooldown = true,
}: Props) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the cooldown so the "Try again in Ns" message ticks down.
  useEffect(() => {
    if (!respectCooldown) return;
    let cancelled = false;
    void cooldownRemainingMs().then(ms => {
      if (cancelled) return;
      setCooldownRemaining(ms);
      if (ms > 0 && !cooldownTimer.current) {
        cooldownTimer.current = setInterval(async () => {
          const next = await cooldownRemainingMs();
          setCooldownRemaining(next);
          if (next <= 0 && cooldownTimer.current) {
            clearInterval(cooldownTimer.current);
            cooldownTimer.current = null;
          }
        }, 1000);
      }
    });
    return () => {
      cancelled = true;
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
    };
  }, [respectCooldown]);

  const inCooldown = respectCooldown && cooldownRemaining > 0;

  const append = async (digit: string) => {
    if (busy || inCooldown) return;
    const next = (pin + digit).slice(0, length);
    setPin(next);
    if (next.length === length) {
      setBusy(true);
      try {
        const ok = await onVerify(next);
        if (ok) {
          await recordSuccessfulAttempt();
          setPin('');
          onSuccess();
        } else {
          await recordFailedAttempt();
          // Subtle haptic on native, silent on web — no visual error per brand voice.
          if (Platform.OS !== 'web') Vibration.vibrate(40);
          setPin('');
          // Refresh cooldown in case this attempt tipped us into one.
          if (respectCooldown) {
            const ms = await cooldownRemainingMs();
            setCooldownRemaining(ms);
          }
          onFailure?.();
        }
      } finally {
        setBusy(false);
      }
    }
  };

  const erase = () => {
    if (busy || inCooldown) return;
    setPin(p => p.slice(0, -1));
  };

  const dots = Array.from({ length }, (_, i) => i < pin.length);

  return (
    <View className="items-center" style={{ gap: 24 }}>
      {prompt ? (
        <Text className="text-base text-neutral-500 text-center">{prompt}</Text>
      ) : null}

      <View className="flex-row" style={{ gap: 14 }}>
        {dots.map((filled, i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: filled ? '#34503E' : '#C2C0BC',
              backgroundColor: filled ? '#34503E' : 'transparent',
            }}
          />
        ))}
      </View>

      {inCooldown ? (
        <Text className="text-sm text-neutral-400 text-center">
          Try again in {Math.ceil(cooldownRemaining / 1000)}s
        </Text>
      ) : null}

      <View style={{ width: 240 }}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['', '0', '⌫'],
        ].map((row, ri) => (
          <View key={ri} className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
            {row.map((d, ci) => {
              if (d === '') return <View key={ci} style={{ flex: 1 }} />;
              const isErase = d === '⌫';
              return (
                <Pressable
                  key={ci}
                  onPress={() => (isErase ? erase() : append(d))}
                  disabled={busy || inCooldown}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 64,
                    borderRadius: 16,
                    backgroundColor: pressed ? '#F0F0EE' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#E0DFDC',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: busy || inCooldown ? 0.4 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: isErase ? 22 : 26,
                      color: isErase ? '#727270' : '#1E1E1E',
                      fontWeight: isErase ? '400' : '500',
                    }}
                  >
                    {d}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

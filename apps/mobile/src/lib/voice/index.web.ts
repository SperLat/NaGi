// Web Speech API + Web Audio API for STT and volume visualization.
//
// Silence-detection strategy:
//   - continuous: true  → recognition never auto-stops on breathing pauses
//   - Web Audio analyser tracks actual microphone volume at 60 fps
//   - Once speech is detected (volume > SPEECH_THRESHOLD), we start a silence
//     clock.  When silence lasts > SILENCE_MS we stop recognition and send.
//   - 1 800 ms covers a normal breathing pause without cutting mid-sentence.

export type StopFn = () => void;

const SPEECH_THRESHOLD = 0.05; // 0–1 normalized; below = silence
const SILENCE_MS       = 1800; // ms of consecutive silence before auto-send

export function startListening(
  lang: string,
  onResult: (text: string) => void,
  onEnd: () => void,
  onVolume?: (level: number) => void,
): StopFn {
  const SR =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

  if (!SR) { onEnd(); return () => {}; }

  // ── Speech recognition ───────────────────────────────────────────────────
  const recognition = new SR() as any;
  recognition.lang          = lang;
  recognition.continuous    = true;  // don't stop on breathing pauses
  recognition.interimResults = true;

  let lastTranscript = '';
  let userStopped = false;        // set true by the returned stop() — distinguishes intentional stop from browser auto-end
  let restartAttempts = 0;        // how many times we've silently restarted recognition
  const MAX_RESTARTS = 3;         // beyond this, treat as genuine end (most likely the network is down)

  recognition.onresult = (e: any) => {
    let transcript = '';
    for (let i = 0; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    lastTranscript = transcript;
    // Real speech detected — reset the restart budget so a long pause
    // mid-utterance doesn't get conflated with the cold-start case.
    if (transcript.trim()) restartAttempts = 0;
  };

  // Chrome's SpeechRecognition fires `onend` even with `continuous: true`
  // when the user hasn't started speaking yet (the "no-speech" cold-start
  // race). Tearing down on that empty end is what made the wave appear
  // and immediately die. So: if we ended without any transcript AND the
  // user didn't tap stop, silently restart recognition. The volume meter
  // (Web Audio path below) keeps running independently — the wave stays
  // visible across restarts.
  recognition.onend = () => {
    if (lastTranscript.trim()) {
      onResult(lastTranscript.trim());
      return;
    }
    if (userStopped) {
      onEnd();
      return;
    }
    if (restartAttempts < MAX_RESTARTS) {
      restartAttempts += 1;
      try {
        recognition.start();
        return;
      } catch {
        // start() can throw "InvalidStateError" if the engine is mid-teardown.
        // Fall through to onEnd — the user can tap mic again.
      }
    }
    onEnd();
  };

  // Surface the actual reason so the elder (or us, in dev) can tell
  // a network problem apart from a permission issue or a no-speech race.
  // Common error codes seen in the wild:
  //   no-speech       → cold-start race; we restart above
  //   network         → Chrome routes audio through Google STT; offline / blocked googleapis.com
  //   not-allowed     → mic permission denied (user or system)
  //   audio-capture   → no mic, or another tab holds it
  //   service-not-allowed → page is on http:// (Web Speech requires https or localhost)
  recognition.onerror = (e: any) => {
    const code = (e?.error as string | undefined) ?? 'unknown';
    if (typeof console !== 'undefined') {
      console.warn(`[voice] SpeechRecognition error: ${code}`);
    }
    // For `no-speech` we let onend handle the silent restart. Other errors
    // are real — tear down so the user can retry.
    if (code !== 'no-speech') {
      userStopped = true; // signal onend to NOT restart
    }
  };

  try { recognition.start(); } catch { onEnd(); return () => {}; }

  // ── Volume meter + silence detection via Web Audio API ───────────────────
  let audioCtx: AudioContext | null = null;
  let animFrame: number | null = null;
  let stream: MediaStream | null = null;
  let hasSpeech     = false; // has the user spoken at all yet?
  let lastSpeechTime = 0;    // timestamp of the last frame above threshold

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(s => {
      stream   = s;
      audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(s).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg   = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(1, avg / 60); // 60 ≈ comfortable speech level

        onVolume?.(level);

        if (level > SPEECH_THRESHOLD) {
          // Voice detected — update clock
          hasSpeech     = true;
          lastSpeechTime = Date.now();
        } else if (hasSpeech && Date.now() - lastSpeechTime > SILENCE_MS) {
          // Silence after speech for long enough → stop and send
          try { recognition.stop(); } catch {}
          return; // exit animation loop; cleanup via stopFn or onend
        }

        animFrame = requestAnimationFrame(tick);
      };

      tick();
    })
    .catch(() => {
      // Mic grab failed (already held, or permission denied).
      // Volume visualization won't work, but recognition continues.
      // The 9 s safety timer in chat.tsx remains the fallback.
    });

  return () => {
    userStopped = true; // mark intentional stop so onend doesn't restart
    if (animFrame !== null) cancelAnimationFrame(animFrame);
    stream?.getTracks().forEach(t => t.stop());
    audioCtx?.close().catch(() => {});
    try { recognition.stop(); } catch {}
  };
}

export const isSupported = (): boolean =>
  typeof window !== 'undefined' &&
  !!(
    (window as any).SpeechRecognition ??
    (window as any).webkitSpeechRecognition
  );

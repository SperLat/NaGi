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

  recognition.onresult = (e: any) => {
    let transcript = '';
    for (let i = 0; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    lastTranscript = transcript;
  };

  // Single exit point — fires after our stop() call or any error
  recognition.onend = () => {
    if (lastTranscript.trim()) {
      onResult(lastTranscript.trim());
    } else {
      onEnd();
    }
  };

  recognition.onerror = () => onEnd();

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

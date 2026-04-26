// MediaRecorder-based audio capture for voice messages on the web kiosk.
//
// Why MediaRecorder + not the existing voice/index.web.ts STT path?
// That lib uses the Web Speech API, which transcribes locally in the
// browser — it does NOT give us the original audio bytes. For voice
// messages we need:
//   1. The transcription to be consistent across devices/browsers
//      (Whisper on our server, not whatever the browser ships).
//   2. The original audio file in storage so the recipient can later
//      hear the sender's actual voice (the warmth play).
// MediaRecorder gives us raw bytes; transcription happens server-side.
//
// Native (iOS/Android) needs expo-av; this file only handles web.
// The non-web sibling (./index.ts) returns isSupported=false until
// the native recorder is built.

export interface AudioRecorderHandle {
  /** Stop recording and return the captured audio as a Blob. */
  stop: () => Promise<Blob>;
  /** Cancel without producing a blob (releases mic, no upload). */
  cancel: () => void;
}

const PREFERRED_MIME = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
];

function pickMime(): string | undefined {
  for (const m of PREFERRED_MIME) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return undefined;
}

/**
 * Begin capturing audio. Resolves once the mic is open and recording
 * has started; rejects if permission is denied or no mic is available.
 *
 * The returned handle lets the caller stop (and receive the blob) or
 * cancel (and discard).
 */
export async function startRecording(): Promise<AudioRecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  let stopResolve: ((blob: Blob) => void) | null = null;
  let stopReject:  ((err: Error) => void) | null = null;
  let cancelled = false;

  recorder.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    if (cancelled) return;
    if (chunks.length === 0) {
      stopReject?.(new Error('No audio captured'));
      return;
    }
    const blob = new Blob(chunks, { type: mimeType ?? 'audio/webm' });
    stopResolve?.(blob);
  };

  recorder.onerror = (e: Event) => {
    stream.getTracks().forEach(t => t.stop());
    stopReject?.(new Error('MediaRecorder error: ' + (e as ErrorEvent).message));
  };

  recorder.start();

  return {
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        stopResolve = resolve;
        stopReject  = reject;
        if (recorder.state !== 'inactive') recorder.stop();
      }),
    cancel: () => {
      cancelled = true;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch { /* already stopped */ }
      stream.getTracks().forEach(t => t.stop());
    },
  };
}

export function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function pickedExtension(blob: Blob): string {
  const t = (blob.type ?? '').toLowerCase();
  if (t.includes('webm')) return 'webm';
  if (t.includes('mp4'))  return 'm4a';
  if (t.includes('ogg'))  return 'ogg';
  if (t.includes('mpeg')) return 'mp3';
  if (t.includes('wav'))  return 'wav';
  return 'bin';
}

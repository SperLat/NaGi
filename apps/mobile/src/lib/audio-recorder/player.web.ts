// Audio playback for voice-message originals on the web kiosk.
// Lives in the audio-recorder dir because they're paired use cases
// (record → upload → playback).
//
// Native equivalent (expo-av Audio.Sound) is the post-demo follow-up;
// the non-web sibling reports isPlaybackSupported=false.

export interface PlaybackHandle {
  stop: () => void;
}

/**
 * Play an audio file from a URL. Returns a handle whose stop() halts
 * playback and releases the element. Resolves immediately after play
 * starts; pass an onEnded callback to know when it finishes naturally.
 */
export async function playAudioUrl(
  url: string,
  onEnded?: () => void,
): Promise<PlaybackHandle> {
  const el = new Audio(url);
  el.onended = () => onEnded?.();
  await el.play();
  return {
    stop: () => {
      try {
        el.pause();
        el.currentTime = 0;
      } catch { /* element already gone */ }
    },
  };
}

export function isPlaybackSupported(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

// Native audio playback is a post-demo follow-up via expo-av.
// Until then, the "Hear original voice" button hides on native.

export interface PlaybackHandle {
  stop: () => void;
}

export async function playAudioUrl(
  _url: string,
  _onEnded?: () => void,
): Promise<PlaybackHandle> {
  throw new Error('Audio playback not yet supported on native.');
}

export function isPlaybackSupported(): boolean {
  return false;
}

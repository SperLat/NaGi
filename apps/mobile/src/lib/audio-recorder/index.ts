// Native (iOS/Android) audio recording is a post-demo follow-up.
// Until expo-av is wired in, the recording UI hides itself on native
// platforms — the kiosk falls back to text-only reply.
//
// When we add native, this file will export the same surface as the
// .web.ts sibling (startRecording, isSupported, pickedExtension) backed
// by Audio.Recording from expo-av.

export interface AudioRecorderHandle {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export async function startRecording(): Promise<AudioRecorderHandle> {
  throw new Error('Voice recording not yet supported on native — use text reply.');
}

export function isSupported(): boolean {
  return false;
}

export function pickedExtension(_blob: Blob): string {
  return 'bin';
}

export type StopFn = () => void;

export function startListening(
  _lang: string,
  _onResult: (text: string) => void,
  onEnd: () => void,
  _onVolume?: (level: number) => void,
): StopFn {
  onEnd();
  return () => {};
}

export const isSupported = (): boolean => false;

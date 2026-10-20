import { createContext, useContext } from 'react';

export interface AudioControls {
  /** There is a song configured. */
  available: boolean;
  playing: boolean;
  muted: boolean;
  loop: boolean;
  currentTime: number;
  duration: number;
  /** Must be called inside a user gesture the first time (autoplay rules). Never throws. */
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  seek: (seconds: number) => void;
  setLoop: (loop: boolean) => void;
  toggleMute: () => void;
}

const noop = () => {};

export const AudioContext = createContext<AudioControls>({
  available: false,
  playing: false,
  muted: false,
  loop: true,
  currentTime: 0,
  duration: 0,
  play: noop,
  pause: noop,
  toggle: noop,
  restart: noop,
  seek: noop,
  setLoop: noop,
  toggleMute: noop,
});

export function useAudio(): AudioControls {
  return useContext(AudioContext);
}

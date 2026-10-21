import { createContext, useContext } from 'react';

// Three contexts so that the playback position (several updates per second) only
// re-renders the progress bar, not every component that can start or mute the music.

export interface AudioActions {
  /** Must be called inside a user gesture the first time (autoplay rules). Never throws. */
  play: () => void;
  /** Like play, fading in, and nothing if already playing. Resolves whether it plays. */
  start: () => Promise<boolean>;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  seek: (seconds: number) => void;
  setLoop: (loop: boolean) => void;
  toggleMute: () => void;
}

export interface AudioState {
  /** There is a song configured. */
  available: boolean;
  playing: boolean;
  muted: boolean;
  loop: boolean;
}

export interface AudioTime {
  currentTime: number;
  duration: number;
}

const noop = () => {};

export const AudioActionsContext = createContext<AudioActions>({
  play: noop,
  start: () => Promise.resolve(false),
  pause: noop,
  toggle: noop,
  restart: noop,
  seek: noop,
  setLoop: noop,
  toggleMute: noop,
});

export const AudioStateContext = createContext<AudioState>({
  available: false,
  playing: false,
  muted: false,
  loop: true,
});

export const AudioTimeContext = createContext<AudioTime>({ currentTime: 0, duration: 0 });

/** Stable functions: never cause a re-render. */
export function useAudioActions(): AudioActions {
  return useContext(AudioActionsContext);
}

/** Changes on play/pause/mute/loop only. */
export function useAudioState(): AudioState {
  return useContext(AudioStateContext);
}

/** Changes several times per second while playing: use only in the progress bar. */
export function useAudioTime(): AudioTime {
  return useContext(AudioTimeContext);
}

import { createContext, useContext } from 'react';

// Two contexts: the actions never change, so what only starts or mutes the music does not
// re-render when it plays or pauses.

export interface AudioActions {
  /**
   * Plays, fading in; nothing if already playing. Must be called inside a user gesture the
   * first time (autoplay rules). Never throws; resolves whether it plays.
   */
  start: () => Promise<boolean>;
  /** Mutes or unmutes (and starts the song if it was not playing). */
  toggleMute: () => void;
}

export interface AudioState {
  /** There is a song configured. */
  available: boolean;
  playing: boolean;
  muted: boolean;
}

export const AudioActionsContext = createContext<AudioActions>({
  start: () => Promise.resolve(false),
  toggleMute: () => {},
});

export const AudioStateContext = createContext<AudioState>({
  available: false,
  playing: false,
  muted: false,
});

/** Stable functions: never cause a re-render. */
export function useAudioActions(): AudioActions {
  return useContext(AudioActionsContext);
}

/** Changes on play, pause and mute only. */
export function useAudioState(): AudioState {
  return useContext(AudioStateContext);
}

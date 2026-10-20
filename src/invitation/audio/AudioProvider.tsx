import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AudioActionsContext,
  AudioStateContext,
  AudioTimeContext,
  type AudioActions,
} from './audioContext';

/** Owns the single <audio> element shared by the player and the floating mute button. */
export function AudioProvider({ src, children }: { src: string | null; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio();
    // Nothing is downloaded until the guest opens the envelope.
    audio.preload = 'none';
    audio.src = src;
    audio.loop = true;
    audioRef.current = audio;

    const syncState = () => setPlaying(!audio.paused);
    const syncTime = () => {
      setCurrentTime(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const stateEvents = ['play', 'pause', 'ended'];
    const timeEvents = ['timeupdate', 'loadedmetadata', 'durationchange'];
    stateEvents.forEach((event) => audio.addEventListener(event, syncState));
    timeEvents.forEach((event) => audio.addEventListener(event, syncTime));
    return () => {
      stateEvents.forEach((event) => audio.removeEventListener(event, syncState));
      timeEvents.forEach((event) => audio.removeEventListener(event, syncTime));
      audio.pause();
      audio.removeAttribute('src');
      audioRef.current = null;
    };
  }, [src]);

  // Built once: everything goes through the ref, so consumers never re-render for these.
  const actions = useMemo<AudioActions>(() => {
    const audio = () => audioRef.current;
    const play = () => {
      // In-app browsers may still refuse: stay paused, never break the page.
      audio()
        ?.play()
        .catch(() => setPlaying(false));
    };
    return {
      play,
      pause: () => audio()?.pause(),
      toggle: () => (audio()?.paused ? play() : audio()?.pause()),
      restart: () => {
        const a = audio();
        if (!a) return;
        a.currentTime = 0;
        if (a.paused) play();
      },
      seek: (seconds) => {
        const a = audio();
        if (a) a.currentTime = seconds;
      },
      setLoop: (value) => {
        const a = audio();
        if (a) a.loop = value;
        setLoop(value);
      },
      toggleMute: () => {
        const a = audio();
        if (!a) return;
        if (a.paused) {
          a.muted = false;
          setMuted(false);
          play();
          return;
        }
        a.muted = !a.muted;
        setMuted(a.muted);
      },
    };
  }, []);

  const state = useMemo(
    () => ({ available: Boolean(src), playing, muted, loop }),
    [src, playing, muted, loop],
  );
  const time = useMemo(() => ({ currentTime, duration }), [currentTime, duration]);

  return (
    <AudioActionsContext value={actions}>
      <AudioStateContext value={state}>
        <AudioTimeContext value={time}>{children}</AudioTimeContext>
      </AudioStateContext>
    </AudioActionsContext>
  );
}

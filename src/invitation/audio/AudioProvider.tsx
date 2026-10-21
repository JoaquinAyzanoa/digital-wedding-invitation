import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AudioActionsContext,
  AudioStateContext,
  AudioTimeContext,
  type AudioActions,
} from './audioContext';

// How long the song takes to rise to full volume after the envelope's tap.
const FADE_IN_MS = 3000;
// Buffering starts once the page has settled, while the guest looks at the envelope.
const PRELOAD_AFTER_MS = 1500;

/** Owns the single <audio> element shared by the player and the floating mute button. */
export function AudioProvider({ src, children }: { src: string | null; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio();
    // Not with the page: a moment later, so the song is ready by the time the guest taps.
    // (iPhones ignore this and load it on the tap.)
    audio.preload = 'none';
    audio.src = src;
    audio.loop = true;
    audioRef.current = audio;
    const preload = window.setTimeout(() => {
      if (!audio.paused || audio.currentTime > 0) return;
      audio.preload = 'auto';
      audio.load();
    }, PRELOAD_AFTER_MS);

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
      window.clearTimeout(preload);
      cancelAnimationFrame(fadeRef.current);
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
    // From silence to full volume once the sound really starts (not while it still loads).
    // iPhones do not let pages set the volume: there it simply starts at full volume.
    const start = () => {
      const a = audio();
      if (!a) return;
      cancelAnimationFrame(fadeRef.current);
      a.volume = 0;
      const rise = () => {
        const begin = performance.now();
        const step = (now: number) => {
          const k = Math.min(1, (now - begin) / FADE_IN_MS);
          a.volume = k * k;
          if (k < 1) fadeRef.current = requestAnimationFrame(step);
        };
        fadeRef.current = requestAnimationFrame(step);
      };
      a.addEventListener('playing', rise, { once: true });
      play();
    };
    return {
      play,
      start,
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

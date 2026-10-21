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

// Interactions that let a page start sound (a scroll does not count; the touch's end does).
const GESTURES = ['pointerdown', 'touchend', 'keydown', 'click'] as const;

interface AudioProviderProps {
  src: string | null;
  /**
   * Start the song as the page opens. Browsers only allow sound once the visitor has touched
   * the page (some allow it at once, e.g. on a site already visited): when refused, it
   * starts on the first touch anywhere, not only on the envelope.
   */
  autoplay?: boolean;
  children: ReactNode;
}

/** Owns the single <audio> element shared by the player and the floating mute button. */
export function AudioProvider({ src, autoplay = false, children }: AudioProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef(0);
  const riseRef = useRef<(() => void) | null>(null);
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
    // Called synchronously (phones only allow it inside the touch). Resolves whether it plays;
    // when refused (autoplay rules, in-app browsers) it stays paused, never breaks the page.
    const play = (): Promise<boolean> => {
      const a = audio();
      if (!a) return Promise.resolve(false);
      const refused = () => {
        setPlaying(false);
        return false;
      };
      try {
        return Promise.resolve(a.play()).then(() => true, refused);
      } catch {
        return Promise.resolve(refused());
      }
    };
    // From silence to full volume once the sound really starts (not while it still loads).
    // iPhones do not let pages set the volume: there it simply starts at full volume.
    const start = () => {
      const a = audio();
      if (!a) return Promise.resolve(false);
      // Already playing (it started with the page): the envelope's tap changes nothing.
      if (!a.paused) return Promise.resolve(true);
      cancelAnimationFrame(fadeRef.current);
      if (riseRef.current) a.removeEventListener('playing', riseRef.current);
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
      riseRef.current = rise;
      a.addEventListener('playing', rise, { once: true });
      return play();
    };
    return {
      play: () => void play(),
      start,
      pause: () => audio()?.pause(),
      toggle: () => (audio()?.paused ? void play() : audio()?.pause()),
      restart: () => {
        const a = audio();
        if (!a) return;
        a.currentTime = 0;
        if (a.paused) void play();
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
          void play();
          return;
        }
        a.muted = !a.muted;
        setMuted(a.muted);
      },
    };
  }, []);

  // Try as the page opens; if the browser refuses, on every touch until it plays.
  useEffect(() => {
    if (!src || !autoplay) return;
    let done = false;
    const stop = () => {
      done = true;
      GESTURES.forEach((event) => document.removeEventListener(event, onGesture, true));
    };
    function onGesture() {
      void actions.start().then((ok) => ok && stop());
    }
    void actions.start().then((ok) => {
      if (ok || done) return stop();
      GESTURES.forEach((event) => document.addEventListener(event, onGesture, true));
    });
    return stop;
  }, [src, autoplay, actions]);

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

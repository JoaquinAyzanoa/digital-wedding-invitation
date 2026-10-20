import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AudioContext, type AudioControls } from './audioContext';

/** Owns the single <audio> element shared by the player and the floating mute button. */
export function AudioProvider({ src, children }: { src: string | null; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loop, setLoopState] = useState(true);
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

    const sync = () => {
      setPlaying(!audio.paused);
      setCurrentTime(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const events = ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'ended'];
    events.forEach((event) => audio.addEventListener(event, sync));
    return () => {
      events.forEach((event) => audio.removeEventListener(event, sync));
      audio.pause();
      audio.removeAttribute('src');
      audioRef.current = null;
    };
  }, [src]);

  const controls = useMemo<AudioControls>(() => {
    const audio = () => audioRef.current;
    const play = () => {
      // In-app browsers may still refuse: stay paused, never break the page.
      audio()
        ?.play()
        .catch(() => setPlaying(false));
    };
    return {
      available: Boolean(src),
      playing,
      muted,
      loop,
      currentTime,
      duration,
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
        setLoopState(value);
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
  }, [src, playing, muted, loop, currentTime, duration]);

  return <AudioContext value={controls}>{children}</AudioContext>;
}

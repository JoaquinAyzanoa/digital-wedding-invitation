import type { CSSProperties } from 'react';
import { UiIcon } from '@/shared/icons/UiIcon';
import { useAudio } from './audioContext';
import styles from './AudioPlayer.module.css';

function formatSeconds(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "Dale play a nuestra canción": progress line and controls like a music app. */
export function AudioPlayer({ label }: { label: string }) {
  const audio = useAudio();
  if (!audio.available) return null;

  const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;

  return (
    <div className={styles.player}>
      <p className={styles.label}>{label}</p>

      <input
        type="range"
        className={styles.progress}
        min={0}
        max={audio.duration || 1}
        step={0.1}
        value={audio.currentTime}
        onChange={(e) => audio.seek(Number(e.target.value))}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        aria-label="Progreso de la canción"
        aria-valuetext={`${formatSeconds(audio.currentTime)} de ${formatSeconds(audio.duration)}`}
        disabled={!audio.duration}
      />

      <div className={styles.controls}>
        {/* Decorative, like the reference: there is only one song. */}
        <span className={styles.secondary} aria-hidden="true">
          <UiIcon name="shuffle" size={22} />
        </span>
        <button
          type="button"
          className={styles.icon}
          onClick={audio.restart}
          aria-label="Volver al inicio"
        >
          <UiIcon name="prev" size={24} />
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={audio.toggle}
          aria-label={audio.playing ? 'Pausar la canción' : 'Reproducir la canción'}
        >
          <UiIcon name={audio.playing ? 'pause' : 'play'} size={30} />
        </button>
        <span className={styles.secondary} aria-hidden="true">
          <UiIcon name="next" size={24} />
        </span>
        <button
          type="button"
          className={styles.icon}
          onClick={() => audio.setLoop(!audio.loop)}
          aria-pressed={audio.loop}
          aria-label="Repetir la canción"
          data-active={audio.loop}
        >
          <UiIcon name="repeat" size={22} />
        </button>
      </div>
    </div>
  );
}

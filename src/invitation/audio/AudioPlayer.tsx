import type { CSSProperties } from 'react';
import { UiIcon } from '@/shared/icons/UiIcon';
import { useAudioActions, useAudioState, useAudioTime } from './audioContext';
import styles from './AudioPlayer.module.css';

function formatSeconds(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "Dale play a nuestra canción": progress line and controls like a music app. */
export function AudioPlayer({ label }: { label: string }) {
  const { available, playing, loop } = useAudioState();
  const { currentTime, duration } = useAudioTime();
  const actions = useAudioActions();
  if (!available) return null;

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.player}>
      <p className={styles.label}>{label}</p>

      <input
        type="range"
        className={styles.progress}
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={(e) => actions.seek(Number(e.target.value))}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        aria-label="Progreso de la canción"
        aria-valuetext={`${formatSeconds(currentTime)} de ${formatSeconds(duration)}`}
        disabled={!duration}
      />

      <div className={styles.controls}>
        {/* Decorative, like the reference: there is only one song. */}
        <span className={styles.secondary} aria-hidden="true">
          <UiIcon name="shuffle" size={22} />
        </span>
        <button
          type="button"
          className={styles.icon}
          onClick={actions.restart}
          aria-label="Volver al inicio"
        >
          <UiIcon name="prev" size={24} />
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={actions.toggle}
          aria-label={playing ? 'Pausar la canción' : 'Reproducir la canción'}
        >
          <UiIcon name={playing ? 'pause' : 'play'} size={30} />
        </button>
        <span className={styles.secondary} aria-hidden="true">
          <UiIcon name="next" size={24} />
        </span>
        <button
          type="button"
          className={styles.icon}
          onClick={() => actions.setLoop(!loop)}
          aria-pressed={loop}
          aria-label="Repetir la canción"
          data-active={loop}
        >
          <UiIcon name="repeat" size={22} />
        </button>
      </div>
    </div>
  );
}

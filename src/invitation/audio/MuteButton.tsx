import { motion } from 'motion/react';
import { UiIcon } from '@/shared/icons/UiIcon';
import { useAudio } from './audioContext';
import styles from './MuteButton.module.css';

/** Floating button, always reachable once the envelope is open. */
export function MuteButton() {
  const audio = useAudio();
  if (!audio.available) return null;

  const silent = !audio.playing || audio.muted;

  return (
    <motion.button
      type="button"
      className={styles.button}
      onClick={audio.toggleMute}
      aria-label={silent ? 'Activar la música' : 'Silenciar la música'}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <UiIcon name={silent ? 'mute' : 'volume'} size={22} />
    </motion.button>
  );
}

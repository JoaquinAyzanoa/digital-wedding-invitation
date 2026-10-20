import { motion } from 'motion/react';
import { UiIcon } from '@/shared/icons/UiIcon';
import { useAudioActions, useAudioState } from './audioContext';
import styles from './MuteButton.module.css';

/** Floating button, always reachable once the envelope is open. */
export function MuteButton() {
  const { available, playing, muted } = useAudioState();
  const { toggleMute } = useAudioActions();
  if (!available) return null;

  const silent = !playing || muted;

  return (
    <motion.button
      type="button"
      className={styles.button}
      onClick={toggleMute}
      aria-label={silent ? 'Activar la música' : 'Silenciar la música'}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <UiIcon name={silent ? 'mute' : 'volume'} size={22} />
    </motion.button>
  );
}

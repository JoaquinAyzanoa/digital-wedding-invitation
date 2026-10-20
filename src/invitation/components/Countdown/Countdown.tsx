import { AnimatePresence, motion } from 'motion/react';
import { useNow } from '@/shared/hooks/useNow';
import { countdown } from '@/shared/utils/date';
import styles from './Countdown.module.css';

function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, '0');
  return (
    <div className={styles.unit}>
      <span className={styles.value}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            className={styles.digits}
            initial={{ y: '-55%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '55%', opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

export function Countdown({ target }: { target: string }) {
  const now = useNow();
  const left = countdown(new Date(target), now);

  if (left.done) {
    return <p className={styles.done}>¡Llegó el gran día!</p>;
  }

  return (
    <div className={styles.countdown}>
      <p className={styles.title}>Faltan:</p>
      {/* Screen readers get a calm summary instead of a value changing every second. */}
      <p className="visually-hidden">
        {left.days} días y {left.hours} horas
      </p>
      <div className={styles.units} aria-hidden="true">
        <Unit value={left.days} label="Días" />
        <span className={styles.colon}>:</span>
        <Unit value={left.hours} label="Horas" />
        <span className={styles.colon}>:</span>
        <Unit value={left.minutes} label="Min" />
        <span className={styles.colon}>:</span>
        <Unit value={left.seconds} label="Seg" />
      </div>
    </div>
  );
}

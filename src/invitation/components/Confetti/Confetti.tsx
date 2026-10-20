import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import { seededRandom } from '@/shared/utils/random';
import styles from './Confetti.module.css';

const COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--seal-hi)',
  'var(--env-side)',
  'var(--env-inside)',
];

const PIECES = Array.from({ length: 44 }, (_, i) => {
  const r = (n: number) => seededRandom(i * 131 + n * 6271);
  return {
    left: r(1) * 100,
    width: 6 + r(2) * 6,
    round: r(3) > 0.7,
    delay: r(4) * 0.5,
    duration: 2.2 + r(5) * 1.4,
    drift: (r(6) - 0.5) * 140,
    spin: (r(7) - 0.5) * 1080,
    color: COLORS[i % COLORS.length],
  };
});

const LONGEST_MS = Math.max(...PIECES.map((p) => (p.delay + p.duration) * 1000));

/** Celebration after confirming attendance. Calls onDone when it has finished falling. */
export function Confetti({ onDone }: { onDone: () => void }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDone, reducedMotion ? 0 : LONGEST_MS);
    return () => clearTimeout(timer);
  }, [onDone, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className={styles.confetti} aria-hidden="true">
      {PIECES.map((piece, i) => (
        <motion.span
          key={i}
          className={styles.piece}
          style={{
            left: `${piece.left}%`,
            width: piece.width,
            height: piece.round ? piece.width : piece.width * 1.6,
            borderRadius: piece.round ? '50%' : 2,
            background: piece.color,
          }}
          initial={{ y: '-6vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '106vh', x: piece.drift, rotate: piece.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: [0.25, 0.4, 0.6, 1] }}
        />
      ))}
    </div>
  );
}

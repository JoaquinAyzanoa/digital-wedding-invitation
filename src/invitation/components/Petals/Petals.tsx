import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import styles from './Petals.module.css';

const COLORS = ['var(--seal-hi)', 'var(--env-bottom)', 'var(--env-side)'];

// mulberry32: a tiny seeded hash, so the layout is scattered but the same for every guest.
function random(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const PETALS = Array.from({ length: 16 }, (_, i) => {
  const r = (n: number) => random(i * 97 + n * 7919);
  return {
    left: 4 + r(1) * 92,
    size: 12 + r(2) * 10,
    delay: 0.6 + r(3) * 1.2,
    duration: 3.2 + r(4) * 1.6,
    drift: (r(5) - 0.5) * 80,
    rotate: r(6) * 360,
    spin: (r(7) - 0.5) * 540,
    color: COLORS[i % COLORS.length],
  };
});

const LONGEST_MS = Math.max(...PETALS.map((p) => (p.delay + p.duration) * 1000));

/** Petals falling over the page while the envelope opens. Calls onDone when they are gone. */
export function Petals({ onDone }: { onDone: () => void }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDone, reducedMotion ? 0 : LONGEST_MS);
    return () => clearTimeout(timer);
  }, [onDone, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className={styles.petals} aria-hidden="true">
      {PETALS.map((petal, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 20 24"
          className={styles.petal}
          style={{ left: `${petal.left}%`, width: petal.size, color: petal.color }}
          initial={{ y: '-8vh', x: 0, rotate: petal.rotate, opacity: 0 }}
          animate={{
            y: '108vh',
            x: [0, petal.drift, -petal.drift / 2, petal.drift],
            rotate: petal.rotate + petal.spin,
            opacity: [0, 0.95, 0.95, 0],
          }}
          transition={{ duration: petal.duration, delay: petal.delay, ease: 'linear' }}
        >
          <path d="M10 0C17 6 18 15 10 24C2 15 3 6 10 0Z" fill="currentColor" />
          <path d="M10 3V20" stroke="white" strokeOpacity="0.35" strokeWidth="0.8" />
        </motion.svg>
      ))}
    </div>
  );
}

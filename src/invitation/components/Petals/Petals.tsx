import { useReducedMotion } from 'motion/react';
import type { CSSProperties, Ref } from 'react';
import { seededRandom } from '@/shared/utils/random';
import styles from './Petals.module.css';

const COLORS = ['var(--seal-hi)', 'var(--env-bottom)', 'var(--env-side)'];
// Over the cover video: gold and ivory, like the envelope's paper.
const COVER_COLORS = ['var(--seal-hi)', 'var(--paper)', '#fffaf2'];

const PETALS = Array.from({ length: 16 }, (_, i) => {
  const r = (n: number) => seededRandom(i * 97 + n * 7919);
  return {
    left: 4 + r(1) * 92,
    size: 12 + r(2) * 10,
    delay: 0.6 + r(3) * 1.2,
    duration: 3.2 + r(4) * 1.6,
    drift: (r(5) - 0.5) * 80,
    rotate: r(6) * 360,
    spin: (r(7) - 0.5) * 540,
  };
});

// The one that lands last: when it does, the layer hides.
const LAST = PETALS.reduce(
  (last, p, i) => (p.delay + p.duration > PETALS[last]!.delay + PETALS[last]!.duration ? i : last),
  0,
);

/**
 * Petals falling over the page while the envelope opens: plain CSS animations, already in
 * place, started by setting `data-falling="true"` on the element passed as `ref` (so the
 * tap re-renders nothing). They hide themselves once the last one lands.
 */
export function Petals({ ref, cover = false }: { ref: Ref<HTMLDivElement>; cover?: boolean }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;
  const colors = cover ? COVER_COLORS : COLORS;

  return (
    <div
      ref={ref}
      className={styles.petals}
      data-falling="false"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if ((event.target as Element).hasAttribute('data-last')) {
          event.currentTarget.dataset.falling = 'done';
        }
      }}
    >
      {PETALS.map((petal, i) => (
        <svg
          key={i}
          viewBox="0 0 20 24"
          className={styles.petal}
          data-last={i === LAST || undefined}
          style={
            {
              left: `${petal.left}%`,
              width: petal.size,
              color: colors[i % colors.length],
              '--delay': `${petal.delay}s`,
              '--duration': `${petal.duration}s`,
              '--drift': `${petal.drift}px`,
              '--rotate': `${petal.rotate}deg`,
              '--spin': `${petal.spin}deg`,
            } as CSSProperties
          }
        >
          <path d="M10 0C17 6 18 15 10 24C2 15 3 6 10 0Z" fill="currentColor" />
          <path d="M10 3V20" stroke="white" strokeOpacity="0.35" strokeWidth="0.8" />
        </svg>
      ))}
    </div>
  );
}

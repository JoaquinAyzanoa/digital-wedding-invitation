import { useReducedMotion } from 'motion/react';
import type { CSSProperties, Ref } from 'react';
import { seededRandom } from '@/shared/utils/random';
import styles from './Petals.module.css';

// Rose petals in the theme's rose (from the envelope's colours), blush and ivory.
const COLORS = ['var(--env-side)', 'var(--env-bottom)', '#f3dfe2', '#fbf5f1'];
// Over the cover video: ivory, blush and a touch of gold, like the envelope's paper.
const COVER_COLORS = ['#fbf5f1', '#f3dfe2', 'var(--seal-hi)', '#f7ece4'];

const PETALS = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => seededRandom(i * 97 + n * 7919);
  // A few come close to the eye: bigger and a little out of focus.
  const near = r(9) > 0.82;
  return {
    left: 2 + r(1) * 94,
    size: near ? 26 + r(2) * 8 : 13 + r(2) * 9,
    blur: near ? 0.8 : 0,
    delay: 0.3 + r(3) * 1,
    duration: (near ? 1.8 : 2.2) + r(4) * 1,
    // Its own wandering path: where it is at a quarter, half and three quarters of the way
    // down (a random walk, calmer for some petals, wider for others), and how low it gets
    // before it fades away.
    path: (() => {
      const width = 25 + r(10) * 55;
      const x1 = (r(13) - 0.5) * width;
      const x2 = x1 + (r(14) - 0.5) * width;
      const x3 = x2 + (r(15) - 0.5) * width;
      const x4 = x3 + (r(5) - 0.5) * width;
      return [x1, x2, x3, x4];
    })(),
    end: 58 + r(16) * 30,
    // Not all fall alike: steady, or a quicker start that slows as it floats.
    ease: ['linear', 'cubic-bezier(0.3, 0.2, 0.6, 1)', 'cubic-bezier(0.45, 0.1, 0.7, 0.9)'][
      Math.floor(r(17) * 3)
    ],
    rotate: r(6) * 360,
    spin: (r(7) - 0.5) * 300,
    // The tumbling of a light petal: how fast it turns over, and around which axis.
    flutter: 0.6 + r(8) * 0.6,
    axis: `${(0.6 + r(11) * 0.4).toFixed(2)}, ${(r(12) - 0.5).toFixed(2)}, 0`,
  };
});

// The one that lands last: when it does, the layer hides.
const LAST = PETALS.reduce(
  (last, p, i) => (p.delay + p.duration > PETALS[last]!.delay + PETALS[last]!.duration ? i : last),
  0,
);

// A rose petal: broad and rounded at the top with a shallow notch, a little lopsided, and
// narrowing to a small rounded base.
const PETAL =
  'M11.6 27.2C5.8 23.6 1.4 17.6 1.6 11C1.8 5.4 5.6 1.6 9.4 1.6C10.7 1.6 11.5 2.2 12.1 2.7' +
  'C12.8 2.1 13.8 1.4 15.3 1.5C19.2 1.7 22.6 5.6 22.5 11.4C22.4 17.8 17.6 23.6 12.6 27.2' +
  'C12.3 27.5 11.9 27.5 11.6 27.2Z';
// Fine veins fanning out from the base.
const VEINS = [
  'M12.1 26.6C12 20 11.9 12 12.2 4.5',
  'M12 26.2C10.4 21 8.4 15.6 6.6 9.6',
  'M12.2 26.2C13.9 21 16 15.6 18 9.8',
  'M11.9 25.8C9.2 22.4 6 18.6 3.6 14.2',
  'M12.3 25.8C15 22.4 18.3 18.6 20.6 14.4',
];

/** The petals' shading, drawn once and shared (gradients are referenced by id). */
function PetalShading() {
  return (
    <svg width="0" height="0" className={styles.defs} aria-hidden="true">
      <defs>
        {/* Deeper towards the pinched base, where a petal is thicker. */}
        <linearGradient id="petal-base" x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0" stopColor="#5a1d32" stopOpacity="0.38" />
          <stop offset="0.45" stopColor="#5a1d32" stopOpacity="0.08" />
          <stop offset="1" stopColor="#5a1d32" stopOpacity="0" />
        </linearGradient>
        {/* Light catching the cupped middle. */}
        <radialGradient id="petal-light" cx="0.42" cy="0.34" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.62" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* A shadow along one side, where the edge curls. */}
        <linearGradient id="petal-curl" x1="1" y1="0.3" x2="0.55" y2="0.5">
          <stop offset="0" stopColor="#3b1424" stopOpacity="0.22" />
          <stop offset="1" stopColor="#3b1424" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Petals falling over the page while the envelope opens: plain CSS animations, already in
 * place, started by setting `data-falling="true"` on the element passed as `ref` (so the
 * tap re-renders nothing). Each one sways down and tumbles over in 3D, shaded like a real
 * rose petal. They hide themselves once the last one lands.
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
      <PetalShading />
      {PETALS.map((petal, i) => (
        <span
          key={i}
          className={styles.petal}
          data-last={i === LAST || undefined}
          style={
            {
              left: `${petal.left}%`,
              width: petal.size,
              color: colors[i % colors.length],
              filter: petal.blur ? `blur(${petal.blur}px)` : undefined,
              '--delay': `${petal.delay}s`,
              '--duration': `${petal.duration}s`,
              '--x1': `${petal.path[0]}px`,
              '--x2': `${petal.path[1]}px`,
              '--x3': `${petal.path[2]}px`,
              '--x4': `${petal.path[3]}px`,
              '--end': `${petal.end}vh`,
              '--ease': petal.ease,
              '--rotate': `${petal.rotate}deg`,
              '--spin': `${petal.spin}deg`,
              '--flutter': `${petal.flutter}s`,
              '--axis': petal.axis,
            } as CSSProperties
          }
        >
          <span className={styles.drift}>
            <svg viewBox="0 0 24 28" className={styles.leaf}>
              <path d={PETAL} fill="currentColor" />
              <path d={PETAL} fill="url(#petal-base)" />
              <path d={PETAL} fill="url(#petal-curl)" />
              <path d={PETAL} fill="url(#petal-light)" />
              {VEINS.map((d) => (
                <path
                  key={d}
                  d={d}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity="0.2"
                  strokeWidth="0.3"
                  strokeLinecap="round"
                />
              ))}
              {/* The rim: a thin light edge, as on a real petal against the light. */}
              <path d={PETAL} fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.5" />
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
}

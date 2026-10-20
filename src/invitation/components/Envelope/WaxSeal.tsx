import { useId } from 'react';
import styles from './WaxSeal.module.css';

// Irregular wax outline: a circle with a fixed "random" radius per point, smoothed with
// quadratic curves through the midpoints.
const OUTLINE = (() => {
  const jitter = [
    3.2, 1.1, 2.6, 0.4, 3.6, 1.8, 2.9, 0.8, 3.4, 2.1, 1.2, 3.0, 0.6, 2.4, 3.5, 1.5, 2.8, 0.9, 3.1,
    1.9, 2.2, 1.0,
  ];
  const points = jitter.map((j, i) => {
    const angle = (i / jitter.length) * Math.PI * 2;
    const r = 50 + j;
    return [60 + r * Math.cos(angle), 60 + r * Math.sin(angle)] as const;
  });
  const mid = (a: readonly [number, number], b: readonly [number, number]) =>
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const fmt = (p: readonly [number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const start = mid(points[points.length - 1]!, points[0]!);
  const segments = points.map(
    (p, i) => `Q${fmt(p)} ${fmt(mid(p, points[(i + 1) % points.length]!))}`,
  );
  return `M${fmt(start)}${segments.join('')}Z`;
})();

// Jagged crack through the middle, used to split the seal in two halves.
const CRACK_LEFT = 'M-10 -10H63L57 22L65 41L55 63L64 82L58 130H-10Z';
const CRACK_RIGHT = 'M130 -10H63L57 22L65 41L55 63L64 82L58 130H130Z';

interface WaxSealProps {
  monogram: string;
  /** Draw only one half (for the cracking animation). */
  half?: 'left' | 'right';
  shine?: boolean;
  className?: string;
}

export function WaxSeal({ monogram, half, shine = false, className }: WaxSealProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const fontSize = monogram.length <= 3 ? 30 : monogram.length <= 5 ? 24 : 18;

  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-wax`} cx="36%" cy="30%" r="78%">
          <stop offset="0" style={{ stopColor: 'var(--seal-hi)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--color-accent)' }} />
          <stop offset="1" style={{ stopColor: 'var(--seal-lo)' }} />
        </radialGradient>
        <radialGradient id={`${id}-well`} cx="64%" cy="70%" r="80%">
          <stop offset="0" style={{ stopColor: 'var(--seal-well-hi)' }} />
          <stop offset="0.6" style={{ stopColor: 'var(--color-accent)' }} />
          <stop offset="1" style={{ stopColor: 'var(--seal-well-lo)' }} />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0" x2="1">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-outline`}>
          <path d={OUTLINE} />
        </clipPath>
        {half && (
          <clipPath id={`${id}-half`}>
            <path d={half === 'left' ? CRACK_LEFT : CRACK_RIGHT} />
          </clipPath>
        )}
      </defs>

      <g clipPath={half ? `url(#${id}-half)` : undefined}>
        <path d={OUTLINE} fill={`url(#${id}-wax)`} />
        <path d={OUTLINE} fill="none" style={{ stroke: 'var(--seal-lo)' }} strokeOpacity="0.35" />

        {/* Pressed well with a light rim on the bottom-right and shadow on the top-left */}
        <circle cx="60" cy="60" r="37" fill={`url(#${id}-well)`} />
        <path
          d="M33.8 86.2A37 37 0 0 0 86.2 33.8"
          fill="none"
          stroke="white"
          strokeOpacity="0.45"
          strokeWidth="1.4"
        />
        <path
          d="M86.2 33.8A37 37 0 0 0 33.8 86.2"
          fill="none"
          style={{ stroke: 'var(--seal-emboss-lo)' }}
          strokeOpacity="0.5"
          strokeWidth="1.4"
        />
        <circle
          cx="60"
          cy="60"
          r="31"
          fill="none"
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="0.8"
          strokeDasharray="0.1 2.6"
          strokeLinecap="round"
        />

        {/* Embossed monogram: light copy offset under a dark one */}
        <text
          x="60.8"
          y="61.8"
          className={styles.monogram}
          fontSize={fontSize}
          style={{ fill: 'var(--seal-emboss-hi)' }}
        >
          {monogram}
        </text>
        <text
          x="60"
          y="61"
          className={styles.monogram}
          fontSize={fontSize}
          style={{ fill: 'var(--seal-emboss-lo)' }}
        >
          {monogram}
        </text>

        {shine && (
          <g clipPath={`url(#${id}-outline)`}>
            <rect
              className={styles.shine}
              x="-40"
              y="-10"
              width="40"
              height="140"
              fill={`url(#${id}-shine)`}
            />
          </g>
        )}
      </g>
    </svg>
  );
}

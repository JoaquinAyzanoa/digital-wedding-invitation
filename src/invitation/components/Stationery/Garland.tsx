import { useId } from 'react';
import { GARLAND, TILE_HEIGHT, TILE_WIDTH } from './garlandArt';
import styles from './Stationery.module.css';

function Art() {
  return (
    <>
      {GARLAND.lines.map((d) => (
        <path key={d} d={d} fill="none" strokeWidth="1" />
      ))}
      {GARLAND.leaves.map(({ d, transform }) => (
        <path key={transform} d={d} transform={transform} stroke="none" />
      ))}
      {GARLAND.petals.map(({ cx, cy, rx, ry, rotate }) => (
        <ellipse
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          transform={`rotate(${rotate} ${cx} ${cy})`}
          stroke="none"
        />
      ))}
      {GARLAND.berries.map(({ cx, cy, r }) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} stroke="none" />
      ))}
    </>
  );
}

/**
 * A garland pressed into the paper (blind embossing): the same colour as the page, drawn by
 * a light edge above and a soft shadow below. Spans the whole width.
 */
export function Garland({ className }: { className?: string }) {
  const id = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-garland`;
  return (
    <svg
      className={[styles.garland, className].filter(Boolean).join(' ')}
      height={TILE_HEIGHT}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={id} width={TILE_WIDTH} height={TILE_HEIGHT} patternUnits="userSpaceOnUse">
          <g className={styles.garlandShadow} transform="translate(0.8 0.9)">
            <Art />
          </g>
          <g className={styles.garlandLight} transform="translate(-0.6 -0.6)">
            <Art />
          </g>
          <g className={styles.garlandPaper}>
            <Art />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height={TILE_HEIGHT} fill={`url(#${id})`} />
    </svg>
  );
}

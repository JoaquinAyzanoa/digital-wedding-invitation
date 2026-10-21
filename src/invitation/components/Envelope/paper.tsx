// The envelope's paper: shapes (viewBox 300 × 200), a grain texture and the patterned liner.
// Every colour comes from CSS variables, so it follows the theme (and the video cover's paper).
import { GarlandArt } from '../Stationery/Garland';
import { TILE_HEIGHT, TILE_WIDTH } from '../Stationery/garlandArt';
import styles from './Envelope.module.css';
import type { PaperIds } from './paperIds';

const FLAP = 'M0 0H300V5C272 30 206 80 172 104Q150 120 128 104C94 80 28 30 0 5Z';
// The flap's edge, raised a few units: a debossed line that follows it inside.
const FLAP_LINE = 'M0 -6C28 19 94 69 128 93Q150 109 172 93C206 69 272 19 300 -6';
// The flap's lower edge itself, gilded.
const FLAP_EDGE = 'M0 5C28 30 94 80 128 104Q150 120 172 104C206 80 272 30 300 5';
// The garland pressed along the bottom of the envelope: the page's garland, smaller.
const VINE_SCALE = 0.4;
const VINE_TOP = 200 - TILE_HEIGHT * VINE_SCALE;
const SIDE_LEFT = 'M0 2Q72 52 141 104Q72 154 0 198Z';
const SIDE_RIGHT = 'M300 2Q228 52 159 104Q228 154 300 198Z';
const BOTTOM = 'M0 200C46 166 106 122 136 101Q150 91 164 101C194 122 254 166 300 200Z';
const BOTTOM_EDGE = 'M0 200C46 166 106 122 136 101Q150 91 164 101C194 122 254 166 300 200';

/** Shared definitions, referenced by the envelope's SVG pieces. */
export function PaperDefs({ ids }: { ids: PaperIds }) {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', overflow: 'hidden' }}
    >
      <defs>
        {/* Fine grain plus soft mottling, added to the paper's colour and kept inside it. */}
        <filter id={ids.grain} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"
            result="grain"
          />
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="3" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"
            result="mottle"
          />
          <feComposite
            in="SourceGraphic"
            in2="grain"
            operator="arithmetic"
            k2="1"
            k3="0.11"
            k4="-0.055"
            result="grained"
          />
          <feComposite
            in="grained"
            in2="mottle"
            operator="arithmetic"
            k2="1"
            k3="0.07"
            k4="-0.035"
            result="paper"
          />
          <feComposite in="paper" in2="SourceGraphic" operator="in" />
        </filter>

        {/* The liner: ivory with a fine gold lattice and a small flower at every crossing. */}
        <pattern
          id={ids.liner}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45 150 100)"
        >
          <rect width="16" height="16" style={{ fill: 'var(--liner)' }} />
          <path
            d="M0 0H16M0 0V16"
            fill="none"
            strokeWidth="0.45"
            style={{ stroke: 'var(--liner-ink)' }}
          />
          <g style={{ fill: 'var(--liner-ink)' }}>
            <circle cx="0" cy="0" r="1.3" />
            <circle cx="16" cy="0" r="1.3" />
            <circle cx="0" cy="16" r="1.3" />
            <circle cx="16" cy="16" r="1.3" />
            <ellipse cx="8" cy="5.8" rx="0.7" ry="1.3" />
            <ellipse cx="8" cy="10.2" rx="0.7" ry="1.3" />
            <ellipse cx="5.8" cy="8" rx="1.3" ry="0.7" />
            <ellipse cx="10.2" cy="8" rx="1.3" ry="0.7" />
          </g>
          <circle cx="8" cy="8" r="0.8" style={{ fill: 'var(--liner)' }} />
        </pattern>

        {/* Shade along a fold: deeper where the bottom flap overlaps the sides. */}
        <linearGradient id={ids.fold} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0.035" />
          <stop offset="1" stopColor="#000" stopOpacity="0.09" />
        </linearGradient>
        {/* Soft daylight from the upper left over the whole front. */}
        <radialGradient id={ids.light} cx="0.2" cy="0" r="1.15">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.07" />
        </radialGradient>
        {/* The garland, blind-embossed: a light edge, a soft shadow and the paper itself. */}
        <pattern
          id={ids.vine}
          width={TILE_WIDTH}
          height={TILE_HEIGHT}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(0 ${VINE_TOP}) scale(${VINE_SCALE})`}
        >
          <g className={styles.embossShadow} transform="translate(1.4 1.6)">
            <GarlandArt />
          </g>
          <g className={styles.embossLight} transform="translate(-1.2 -1.2)">
            <GarlandArt />
          </g>
          <g className={styles.embossPaper}>
            <GarlandArt />
          </g>
        </pattern>
        {/* Light from above on the bottom flap. */}
        <linearGradient id={ids.lift} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.04" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Inside of the envelope's back: kraft rim, with the liner set in. */
export function Back({ ids }: { ids: PaperIds }) {
  return (
    <svg
      className={styles.back}
      viewBox="0 0 300 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect
        width="300"
        height="200"
        rx="4"
        filter={`url(#${ids.grain})`}
        className={styles.inside}
      />
      <rect x="7" y="6" width="286" height="150" rx="2" fill={`url(#${ids.liner})`} />
    </svg>
  );
}

/** Sides and bottom: the pocket in front of the card. */
export function Pocket({ ids }: { ids: PaperIds }) {
  return (
    <svg
      className={styles.pocket}
      viewBox="0 0 300 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g filter={`url(#${ids.grain})`}>
        <path d={SIDE_LEFT} className={styles.side} />
        <path d={SIDE_RIGHT} className={styles.side} />
      </g>
      <path d={SIDE_LEFT} fill={`url(#${ids.fold})`} />
      <path d={SIDE_RIGHT} fill={`url(#${ids.fold})`} transform="matrix(-1 0 0 1 300 0)" />
      {/* The bottom flap casts a soft shadow on the sides. */}
      <path
        d={BOTTOM_EDGE}
        fill="none"
        stroke="#000"
        strokeOpacity="0.07"
        strokeWidth="5"
        transform="translate(0 -1.5)"
      />
      <path d={BOTTOM} className={styles.bottom} filter={`url(#${ids.grain})`} />
      <path d={BOTTOM} fill={`url(#${ids.lift})`} />
      <defs>
        <clipPath id={`${ids.vine}-bottom`}>
          <path d={BOTTOM} />
        </clipPath>
      </defs>
      <rect
        y={VINE_TOP}
        width="300"
        height={200 - VINE_TOP}
        fill={`url(#${ids.vine})`}
        clipPath={`url(#${ids.vine}-bottom)`}
      />
      <path d={BOTTOM_EDGE} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.8" />
      <rect width="300" height="200" fill={`url(#${ids.light})`} />
    </svg>
  );
}

/** The flap seen from outside, with a debossed line along its edge. */
export function FlapFront({ ids }: { ids: PaperIds }) {
  const clip = `${ids.grain}-flap`;
  return (
    <svg
      className={styles.flapFront}
      viewBox="0 0 300 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <path d={FLAP} />
        </clipPath>
      </defs>
      <path d={FLAP} className={styles.flapPaper} filter={`url(#${ids.grain})`} />
      <g clipPath={`url(#${clip})`} fill="none" strokeWidth="0.7">
        <path d={FLAP_LINE} stroke="#000" strokeOpacity="0.13" />
        <path d={FLAP_LINE} stroke="#fff" strokeOpacity="0.5" transform="translate(0 0.8)" />
      </g>
      <path d={FLAP} fill={`url(#${ids.light})`} />
      <path d={FLAP_EDGE} fill="none" className={styles.gilt} strokeWidth="1.1" />
    </svg>
  );
}

/** The flap's inside, lined like the back (drawn upside down: see .flapInside). */
export function FlapInside({ ids }: { ids: PaperIds }) {
  return (
    <svg
      className={styles.flapInside}
      viewBox="0 0 300 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g transform="matrix(1 0 0 -1 0 200)">
        <path d={FLAP} className={styles.inside} filter={`url(#${ids.grain})`} />
        <path
          d={FLAP}
          fill={`url(#${ids.liner})`}
          transform="translate(150 0) scale(0.95 0.9) translate(-150 0)"
        />
      </g>
    </svg>
  );
}

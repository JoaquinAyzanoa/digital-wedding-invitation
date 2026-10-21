import type { DateParts } from '@/shared/utils/date';
import { Crest } from '../Stationery/Crest';
import { GarlandArt } from '../Stationery/Garland';
import { TILE_HEIGHT, TILE_WIDTH } from '../Stationery/garlandArt';
import styles from './Envelope.module.css';
import type { PaperIds } from './paperIds';

// The card inside the envelope (viewBox 264 × 176, the envelope's 3:2), like a printed
// invitation: gilded edges, a double rule with scrolled corners, an embossed arch panel
// flanked by garlands pressed into the paper, and the crest, the names and the date.

const ARCH = 'M62 176V66C62 34 94 17 132 17C170 17 202 34 202 66V176';
const ARCH_INNER = 'M67 176V67C67 39 97 22 132 22C167 22 197 39 197 67V176';

// A corner ornament for the top-left corner of the rule (mirrored for the others): a curved
// bracket whose ends curl into small volutes, a leaf pointing into the card and a bead.
const CORNER_BRACKET =
  'M3 24C3 12 11 3 24 3C28.5 3 31 6.2 29.4 8.6C28.2 10.3 25.6 9.8 25.8 7.8M3 24C3 28.5 6.2 31 8.6 29.4C10.3 28.2 9.8 25.6 7.8 25.8';
const CORNER_INNER = 'M8 21C8 14 14 8 21 8';
const CORNER_LEAF = 'M0 0C2 -2.4 5.6 -3 8.8 -0.4C5.6 2.2 2 2 0 0Z';

function Corner({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <path d={CORNER_BRACKET} fill="none" strokeWidth="0.9" className={styles.cardLine} />
      <path d={CORNER_INNER} fill="none" strokeWidth="0.5" className={styles.cardLine} />
      <path d={CORNER_LEAF} transform="translate(11 11) rotate(45)" className={styles.cardFill} />
      <circle cx="9.6" cy="9.6" r="1.1" className={styles.cardFill} />
    </g>
  );
}

/** An embossed line: a light copy under it, offset towards the light. */
function Embossed({ d, width = 0.7 }: { d: string; width?: number }) {
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.9"
        strokeWidth={width}
        transform="translate(0.7 0.7)"
      />
      <path d={d} fill="none" strokeWidth={width} className={styles.cardLine} />
    </>
  );
}

// The page's garland, small and upright, pressed into the paper on each side of the arch.
const SPRAY_SCALE = 0.34;
const SPRAY_WIDTH = TILE_HEIGHT * SPRAY_SCALE;
const SPRAYS = [36, 228];

interface CardFaceProps {
  ids: PaperIds;
  monogram: string;
  bride: string;
  groom: string;
  date: DateParts;
}

export function CardFace({ ids, monogram, bride, groom, date }: CardFaceProps) {
  const sprayId = (x: number) => `${ids.vine}-card-${x}`;
  return (
    <>
      <svg
        className={styles.cardArt}
        viewBox="0 0 264 176"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {SPRAYS.map((x) => (
            <pattern
              key={x}
              id={sprayId(x)}
              width={TILE_WIDTH}
              height={TILE_HEIGHT}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${x + SPRAY_WIDTH / 2} 24) rotate(90) scale(${SPRAY_SCALE})`}
            >
              <g className={styles.cardEmbossShadow} transform="translate(1.6 1.6)">
                <GarlandArt />
              </g>
              <g className={styles.cardEmbossLight} transform="translate(-1.4 -1.4)">
                <GarlandArt />
              </g>
              <g className={styles.cardEmbossPaper}>
                <GarlandArt />
              </g>
            </pattern>
          ))}
        </defs>
        <rect
          width="264"
          height="176"
          rx="2.5"
          className={styles.cardPaper}
          filter={`url(#${ids.grain})`}
        />
        {/* Gilded edges, like a fine printed card */}
        <rect
          x="0.6"
          y="0.6"
          width="262.8"
          height="174.8"
          rx="2.2"
          fill="none"
          strokeWidth="1.2"
          className={styles.gilt}
        />
        <rect
          x="7"
          y="7"
          width="250"
          height="162"
          fill="none"
          strokeWidth="0.7"
          className={styles.cardLine}
        />
        <rect
          x="10"
          y="10"
          width="244"
          height="156"
          fill="none"
          strokeWidth="0.3"
          className={styles.cardLine}
        />
        {SPRAYS.map((x) => (
          <rect
            key={x}
            x={x - SPRAY_WIDTH / 2}
            y="24"
            width={SPRAY_WIDTH}
            height="140"
            fill={`url(#${sprayId(x)})`}
          />
        ))}
        <Embossed d={ARCH} width={0.8} />
        <Embossed d={ARCH_INNER} width={0.45} />
        <Corner transform="translate(10 10)" />
        <Corner transform="translate(254 10) scale(-1 1)" />
        <Corner transform="translate(10 166) scale(1 -1)" />
        <Corner transform="translate(254 166) scale(-1 -1)" />
      </svg>
      <span className={styles.cardText}>
        <Crest className={styles.cardCrest} monogram={monogram} />
        <span className={styles.cardNames}>
          {bride} <span className={styles.cardAmp}>&amp;</span> {groom}
        </span>
        <span className={styles.cardDate}>
          <span className={styles.cardDateSide}>{date.weekday}</span>
          <span className={styles.cardDay}>{date.day}</span>
          <span className={styles.cardDateSide}>{date.month}</span>
        </span>
        <span className={styles.cardYear}>{date.year}</span>
        <svg className={styles.cardDivider} viewBox="0 0 80 8" aria-hidden="true">
          <path d="M2 4H31M49 4H78" fill="none" strokeWidth="0.5" className={styles.cardLine} />
          <path d="M40 0.6L43.4 4 40 7.4 36.6 4Z" className={styles.cardFill} />
          <circle cx="33.5" cy="4" r="0.9" className={styles.cardFill} />
          <circle cx="46.5" cy="4" r="0.9" className={styles.cardFill} />
        </svg>
      </span>
    </>
  );
}

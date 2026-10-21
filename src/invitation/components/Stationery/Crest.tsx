import {
  BASE_SHELL,
  CROWN,
  DROP,
  ECHOES,
  EYES,
  FINIAL,
  LEAF,
  LEAF_RIB,
  LEAVES,
  RIBBONS,
} from './crestArt';
import styles from './Stationery.module.css';

/** A line drawn hollow, like an engraved ribbon: the ink, then the paper down its middle. */
function Ribbon({ d, width }: { d: string; width: number }) {
  return (
    <>
      <path d={d} className={styles.crestInk} strokeWidth={width} />
      <path d={d} className={styles.crestPaper} strokeWidth={width * 0.4} />
    </>
  );
}

function LeftHalf() {
  return (
    <>
      {ECHOES.map((d) => (
        <path key={d} d={d} className={styles.crestInk} strokeWidth="0.6" />
      ))}
      {RIBBONS.map(({ d, width }) => (
        <Ribbon key={d} d={d} width={width} />
      ))}
      {LEAVES.map((transform) => (
        <g key={transform} transform={transform}>
          <Ribbon d={LEAF} width={2.2} />
          <path d={LEAF_RIB} className={styles.crestInk} strokeWidth="0.6" />
        </g>
      ))}
      {EYES.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" className={styles.crestDot} />
      ))}
    </>
  );
}

/** The letters of a monogram such as "C·J" or "C & J". */
function initials(monogram: string): string[] {
  return [...monogram.matchAll(/\p{L}/gu)].map((match) => match[0]);
}

/**
 * The couple's monogram inside an engraved baroque cartouche, like a stationery crest: two
 * initials are intertwined (the first above and to the left), anything else is centred.
 */
export function Crest({
  monogram,
  label,
  className,
}: {
  monogram: string;
  /** Without one, the crest is decorative (hidden from screen readers). */
  label?: string;
  className?: string;
}) {
  const letters = initials(monogram);
  return (
    <svg
      className={[styles.crest, className].filter(Boolean).join(' ')}
      viewBox="-108 -126 216 244"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <LeftHalf />
        <g transform="scale(-1 1)">
          <LeftHalf />
        </g>
        <ellipse rx="55" ry="67" className={styles.crestInk} strokeWidth="2.6" />
        <ellipse rx="55" ry="67" className={styles.crestPaper} strokeWidth="1" />
        <ellipse rx="50" ry="62" className={styles.crestInk} strokeWidth="0.5" />
        <ellipse
          rx="47"
          ry="59"
          className={styles.crestInk}
          strokeWidth="0.6"
          strokeDasharray="0.1 3.2"
        />
        <g className={styles.crestInk}>
          <path d={CROWN.ribs} strokeWidth="0.8" />
          <path d={CROWN.edge} strokeWidth="1.6" />
          <path d={CROWN.base} strokeWidth="1.2" />
          <path d={BASE_SHELL.ribs} strokeWidth="0.7" />
          <path d={BASE_SHELL.edge} strokeWidth="1.3" />
          <path d={FINIAL} strokeWidth="1.4" />
          <path d={DROP} strokeWidth="1.2" />
        </g>
      </g>
      <circle cy="-124.5" r="1.9" className={styles.crestDot} />
      {letters.length === 2 ? (
        <g className={styles.crestMonogram}>
          <text x="-12" y="-8" fontSize="80">
            {letters[0]}
          </text>
          <text x="13" y="11" fontSize="80">
            {letters[1]}
          </text>
        </g>
      ) : (
        <text
          className={styles.crestMonogram}
          y="4"
          fontSize={monogram.length <= 3 ? 34 : monogram.length <= 5 ? 28 : 22}
        >
          {monogram}
        </text>
      )}
    </svg>
  );
}

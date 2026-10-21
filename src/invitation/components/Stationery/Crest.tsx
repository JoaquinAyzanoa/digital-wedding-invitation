import { BASE_SHELL, CROWN, ECHOES, FINIAL, LEAF, LEAF_RIB, LEAVES, SCROLLS } from './crestArt';
import styles from './Stationery.module.css';

function LeftHalf() {
  return (
    <>
      {SCROLLS.map((d) => (
        <path key={d} d={d} strokeWidth="1.35" />
      ))}
      {ECHOES.map((d) => (
        <path key={d} d={d} strokeWidth="0.55" />
      ))}
      {LEAVES.map((transform) => (
        <g key={transform} transform={transform}>
          <path d={LEAF} strokeWidth="1" />
          <path d={LEAF_RIB} strokeWidth="0.5" />
        </g>
      ))}
    </>
  );
}

/** The couple's monogram inside an engraved baroque cartouche, like a stationery crest. */
export function Crest({ monogram, label }: { monogram: string; label: string }) {
  // Script capitals and an ampersand are wide: keep them inside the oval (about 84 across).
  const fontSize =
    monogram.length <= 2 ? 46 : monogram.length === 3 ? 32 : monogram.length <= 5 ? 28 : 22;
  return (
    <svg className={styles.crest} viewBox="-104 -122 208 236" role="img" aria-label={label}>
      <g className={styles.crestLines} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <LeftHalf />
        <g transform="scale(-1 1)">
          <LeftHalf />
        </g>
        <ellipse rx="54" ry="66" strokeWidth="1" />
        <ellipse rx="50.5" ry="62.5" strokeWidth="0.45" />
        <ellipse rx="47" ry="59" strokeWidth="0.5" strokeDasharray="0.1 3.4" />
        <path d={CROWN.ribs} strokeWidth="0.7" />
        <path d={CROWN.edge} strokeWidth="1.1" />
        <path d={CROWN.base} strokeWidth="0.9" />
        <path d={BASE_SHELL.ribs} strokeWidth="0.6" />
        <path d={BASE_SHELL.edge} strokeWidth="1" />
        <path d={FINIAL} strokeWidth="1" />
      </g>
      <g className={styles.crestDots}>
        <circle cy="-119.5" r="1.7" />
        <circle cy="100" r="1.8" />
      </g>
      <text className={styles.crestMonogram} y="6" fontSize={fontSize}>
        {monogram}
      </text>
    </svg>
  );
}

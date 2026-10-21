import styles from './Stationery.module.css';

/** The small rule under a section title: two fine lines meeting at a diamond. */
export function Flourish() {
  return (
    <svg className={styles.flourish} viewBox="0 0 120 10" aria-hidden="true" focusable="false">
      <path d="M2 5H50M70 5H118" fill="none" strokeWidth="0.7" />
      <path d="M60 1.2L63.8 5 60 8.8 56.2 5Z" stroke="none" />
      <circle cx="52.5" cy="5" r="1" stroke="none" />
      <circle cx="67.5" cy="5" r="1" stroke="none" />
    </svg>
  );
}

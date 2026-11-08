import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import type { PhotoQuote, PhotoSlot, PublicContent } from '@/shared/schemas/content';
import styles from './PhotoSection.module.css';
import type { SectionProps } from './types';

interface PhotoProps {
  src: string;
  alt: string;
  priority?: boolean;
  /** Written over the photo, like the cover of a wedding album. */
  cover?: { bride: string; groom: string } | undefined;
  /** A verse at the top of the photo (under the names on the cover). */
  quote?: PhotoQuote | undefined;
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
}

/** A light colour gets a soft dark halo and a dark one a light halo, to read on any photo. */
function haloFor(hex: string): string {
  return isLight(hex)
    ? '0 0 2px rgb(0 0 0 / 0.3), 0 1px 14px rgb(0 0 0 / 0.5)'
    : '0 0 2px rgb(255 255 255 / 0.5), 0 0 14px rgb(255 255 255 / 0.8)';
}

/** The verse: the words, then the reference in italics, a little see-through. */
function Quote({ quote }: { quote: PhotoQuote }) {
  const style = {
    '--quote-color': quote.color,
    '--quote-halo': haloFor(quote.color),
  } as CSSProperties;
  return (
    <figure className={styles.quote} style={style}>
      <blockquote className={styles.quoteText}>{quote.text}</blockquote>
      {quote.reference && (
        <figcaption className={styles.quoteReference}>{quote.reference}</figcaption>
      )}
    </figure>
  );
}

/**
 * Full-width photo that fades into the background at the top and bottom, with light parallax.
 * The cover stands still: moving it inside its faded frame stuttered on iPhones.
 */
export function Photo({ src, alt, priority = false, cover, quote }: PhotoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);
  const verse = quote?.text ? quote : undefined;
  const fadeIn = {
    initial: reducedMotion ? false : { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div
      ref={ref}
      className={styles.photo}
      data-cover={cover ? 'true' : undefined}
      // Light words get a soft shade at the top of the photo (the cover always has one).
      data-quote={verse && !cover ? (isLight(verse.color) ? 'light' : 'dark') : undefined}
    >
      <motion.img
        src={src}
        // Photos uploaded from the admin come in two sizes (see admin/data/storage.ts).
        {...(src.endsWith('-2000.webp')
          ? {
              srcSet: `${src.replace(/-2000\.webp$/, '-1000.webp')} 1000w, ${src} 2000w`,
              sizes: '(max-width: 720px) 100vw, 720px',
            }
          : {})}
        alt={alt}
        className={styles.image}
        style={reducedMotion || cover ? undefined : { y }}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
      {cover ? (
        <motion.div className={styles.title} {...fadeIn}>
          <p className={styles.kicker}>Nuestra boda</p>
          <p className={styles.names}>
            <span>{cover.bride} &amp;</span> <span>{cover.groom}</span>
          </p>
          {verse && <Quote quote={verse} />}
        </motion.div>
      ) : (
        verse && (
          <motion.div className={styles.top} {...fadeIn}>
            <Quote quote={verse} />
          </motion.div>
        )
      )}
    </div>
  );
}

/** The photo of a slot, or nothing when that slot is empty. */
export function SlotPhoto({ content, slot }: { content: PublicContent; slot: PhotoSlot }) {
  const src = content.photos[slot];
  if (!src) return null;
  return (
    <Photo
      src={src}
      alt={`${content.couple.bride} y ${content.couple.groom}`}
      priority={slot === 'hero'}
      cover={
        slot === 'hero' ? { bride: content.couple.bride, groom: content.couple.groom } : undefined
      }
      quote={content.photoQuotes?.[slot]}
    />
  );
}

export function PhotoSection({ content, entry }: SectionProps) {
  if (!entry.photo) return null;
  return <SlotPhoto content={content} slot={entry.photo} />;
}

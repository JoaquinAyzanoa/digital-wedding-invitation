import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import type { PhotoSlot, PublicContent } from '@/shared/schemas/content';
import styles from './PhotoSection.module.css';
import type { SectionProps } from './types';

interface PhotoProps {
  src: string;
  alt: string;
  priority?: boolean;
  /** Written over the photo, like the cover of a wedding album. */
  cover?: { bride: string; groom: string };
}

/** Full-width photo that fades into the background at the top and bottom, with light parallax. */
export function Photo({ src, alt, priority = false, cover }: PhotoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <div ref={ref} className={styles.photo} data-cover={cover ? 'true' : undefined}>
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
        style={reducedMotion ? undefined : { y }}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
      {cover && (
        <motion.div
          className={styles.title}
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className={styles.kicker}>Nuestra boda</p>
          <p className={styles.names}>
            <span>{cover.bride} &amp;</span> <span>{cover.groom}</span>
          </p>
        </motion.div>
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
      {...(slot === 'hero'
        ? { cover: { bride: content.couple.bride, groom: content.couple.groom } }
        : {})}
    />
  );
}

export function PhotoSection({ content, entry }: SectionProps) {
  if (!entry.photo) return null;
  return <SlotPhoto content={content} slot={entry.photo} />;
}

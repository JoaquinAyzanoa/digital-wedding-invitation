import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import type { PhotoSlot, PublicContent } from '@/shared/schemas/content';
import styles from './PhotoSection.module.css';
import type { SectionProps } from './types';

interface PhotoProps {
  src: string;
  alt: string;
  priority?: boolean;
}

/** Full-width photo that fades into the background at the top and bottom, with light parallax. */
export function Photo({ src, alt, priority = false }: PhotoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <div ref={ref} className={styles.photo}>
      <motion.img
        src={src}
        alt={alt}
        className={styles.image}
        style={reducedMotion ? undefined : { y }}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
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
    />
  );
}

export function PhotoSection({ content, entry }: SectionProps) {
  if (!entry.photo) return null;
  return <SlotPhoto content={content} slot={entry.photo} />;
}

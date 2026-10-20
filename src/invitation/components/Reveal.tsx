import { motion } from 'motion/react';
import { useContext, type ReactNode } from 'react';
import { RevealContext } from './revealContext';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const enabled = useContext(RevealContext);

  // Mounting the motion element only once enabled gives it a fresh in-view check.
  if (!enabled) {
    return (
      <div className={className} style={{ opacity: 0 }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

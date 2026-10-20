import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { UiIcon } from '@/shared/icons/UiIcon';
import { ToastContext } from './toastContext';
import styles from './Toast.module.css';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const regionRef = useRef<HTMLDivElement>(null);

  const show = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  // Modal <dialog>s (the admin's panels) live in the browser's top layer, above any z-index.
  // A popover is top-layer too, and re-showing it stacks it above whatever opened last, so
  // the message is visible over an open panel. Without the Popover API it stays as before.
  useEffect(() => {
    const region = regionRef.current;
    if (!toast || !region || typeof region.showPopover !== 'function') return;
    if (region.matches(':popover-open')) region.hidePopover();
    region.showPopover();
  }, [toast]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <div
        ref={regionRef}
        popover="manual"
        className={styles.region}
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className={styles.toast}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3 }}
            >
              <UiIcon name="check" size={18} />
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext>
  );
}

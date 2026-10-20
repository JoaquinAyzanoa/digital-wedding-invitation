import { useEffect, useRef, useState } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import { PREVIEW_CONTENT, PREVIEW_READY } from '@/shared/preview';
import { contentFormSchema, type ContentForm } from './form';
import styles from './PreviewFrame.module.css';

const PHONE = { width: 390, height: 844 };
const BEZEL = 10;

/**
 * The invitation in a phone-sized iframe (`/?preview=1&i=demo`), fed the unsaved content
 * over postMessage. Only this component re-renders while typing.
 */
export function PreviewFrame({
  control,
  fit = 'width',
}: {
  control: Control<ContentForm>;
  fit?: 'width' | 'fill';
}) {
  const values = useWatch({ control }) as ContentForm;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);

  // The invitation says when it is listening (also after reloading itself).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin === window.location.origin &&
        event.source === frameRef.current?.contentWindow &&
        (event.data as { type?: string })?.type === PREVIEW_READY
      ) {
        setReady(true);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      // Same normalization as saving (e.g. no song → null). Mid-edit values that are not
      // valid yet (a half-typed color) are skipped: the preview keeps the last valid state.
      const parsed = contentFormSchema.safeParse(values);
      if (!parsed.success) return;
      frameRef.current?.contentWindow?.postMessage(
        { type: PREVIEW_CONTENT, content: parsed.data.public, private: parsed.data.private },
        window.location.origin,
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [ready, values]);

  // Scale the 390 px phone down to the available width.
  useEffect(() => {
    if (fit !== 'width' || !boxRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const outer = PHONE.width + BEZEL * 2;
      setScale(Math.min(1, (entry?.contentRect.width ?? outer) / outer));
    });
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, [fit]);

  const src = `${window.location.origin}/?preview=1&i=demo`;

  if (fit === 'fill') {
    return (
      <iframe
        ref={frameRef}
        src={src}
        title="Vista previa de la invitación"
        className={styles.fill}
      />
    );
  }

  return (
    <div ref={boxRef} className={styles.box} style={{ height: (PHONE.height + BEZEL * 2) * scale }}>
      <iframe
        ref={frameRef}
        src={src}
        title="Vista previa de la invitación"
        className={styles.phone}
        style={{ width: PHONE.width, height: PHONE.height, transform: `scale(${scale})` }}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';

/** Current time, re-rendered on every whole interval (aligned to the clock, not to mount). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        intervalMs - (Date.now() % intervalMs),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [intervalMs]);

  return now;
}

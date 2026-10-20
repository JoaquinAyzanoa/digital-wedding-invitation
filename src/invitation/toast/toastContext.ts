import { createContext, useContext } from 'react';

export const ToastContext = createContext<(message: string) => void>(() => {});

/** Shows a short message at the bottom of the screen (also announced to screen readers). */
export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

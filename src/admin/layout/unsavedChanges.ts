import { createContext, useContext, useEffect } from 'react';

/** Set by an editor with unsaved changes; the layout asks before navigating away. */
export const UnsavedChangesContext = createContext<(dirty: boolean) => void>(() => {});

export const LEAVE_MESSAGE = 'Tienes cambios sin guardar. ¿Salir sin guardar?';

export function useUnsavedChanges(dirty: boolean) {
  const setDirty = useContext(UnsavedChangesContext);

  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);

  // Reload or closing the tab: the browser shows its own confirmation.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

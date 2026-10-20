import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { supabase } from '@/admin/supabase';
import styles from './AdminLayout.module.css';
import { LEAVE_MESSAGE, UnsavedChangesContext } from './unsavedChanges';

const NAV = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/invitations', label: 'Invitados', end: false },
  { to: '/content', label: 'Contenido', end: false },
  { to: '/theme', label: 'Diseño', end: false },
  { to: '/settings', label: 'Ajustes', end: false },
];

export function AdminLayout({ email }: { email: string }) {
  const queryClient = useQueryClient();
  // An editor with unsaved changes: confirm before leaving it through the navigation.
  const [dirty, setDirty] = useState(false);
  const leave = (event: { preventDefault: () => void }) => {
    if (dirty && !window.confirm(LEAVE_MESSAGE)) event.preventDefault();
  };

  async function signOut() {
    if (dirty && !window.confirm(LEAVE_MESSAGE)) return;
    await supabase.auth.signOut();
    // Nothing from this session may stay in memory.
    queryClient.clear();
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>Panel</span>
        <nav className={styles.nav} aria-label="Secciones">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={leave}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.account}>
          <span className={styles.email} title={email}>
            {email}
          </span>
          <button type="button" className={styles.signOut} onClick={signOut}>
            Salir
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <UnsavedChangesContext value={setDirty}>
          <Outlet />
        </UnsavedChangesContext>
      </main>
    </div>
  );
}

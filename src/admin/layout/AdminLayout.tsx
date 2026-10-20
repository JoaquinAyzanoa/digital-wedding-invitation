import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { supabase } from '@/admin/supabase';
import styles from './AdminLayout.module.css';

const NAV = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/invitations', label: 'Invitados', end: false },
];

export function AdminLayout({ email }: { email: string }) {
  const queryClient = useQueryClient();

  async function signOut() {
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
        <Outlet />
      </main>
    </div>
  );
}

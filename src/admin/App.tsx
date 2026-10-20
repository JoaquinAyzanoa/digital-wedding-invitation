import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { ToastProvider } from '@/shared/toast/ToastProvider';
import { LoginPage } from './auth/LoginPage';
import { useSession } from './auth/useSession';
import { AdminLayout } from './layout/AdminLayout';
import { DashboardPage } from './routes/DashboardPage';
import { InvitationsPage } from './routes/InvitationsPage';
import { hasBackend, supabase } from './supabase';
import ui from './ui/ui.module.css';

export default function App() {
  const session = useSession();
  const deniedAccount = session.status === 'signedIn' && !session.isAdmin;

  // Signed in (e.g. from an old session) with an account that is not an admin: sign out.
  useEffect(() => {
    if (deniedAccount) void supabase.auth.signOut();
  }, [deniedAccount]);

  if (!hasBackend) {
    return <p className={ui.empty}>El panel necesita Supabase: configura VITE_SUPABASE_URL.</p>;
  }
  if (session.status === 'loading') return <p className={ui.empty}>Cargando…</p>;
  if (session.status === 'signedOut') return <LoginPage />;
  if (deniedAccount) return <LoginPage notice="Esta cuenta no tiene acceso." />;

  return (
    <ToastProvider>
      {/* Hash routes (/login/#/invitations): static hosting needs no rewrites. */}
      <HashRouter>
        <Routes>
          <Route element={<AdminLayout email={session.session.user.email ?? ''} />}>
            <Route index element={<DashboardPage />} />
            <Route path="invitations" element={<InvitationsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}

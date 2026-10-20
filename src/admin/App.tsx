import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { ToastProvider } from '@/shared/toast/ToastProvider';
import { LoginPage } from './auth/LoginPage';
import { useSession } from './auth/useSession';
import { AdminLayout } from './layout/AdminLayout';
import { ContentPage } from './routes/ContentPage';
import { DashboardPage } from './routes/DashboardPage';
import { InvitationsPage } from './routes/InvitationsPage';
import { ThemePage } from './routes/ThemePage';
import { hasBackend } from './supabase';
import ui from './ui/ui.module.css';

export default function App() {
  const session = useSession();

  if (!hasBackend) {
    return <p className={ui.empty}>El panel necesita Supabase: configura VITE_SUPABASE_URL.</p>;
  }
  if (session.status === 'loading') return <p className={ui.empty}>Cargando…</p>;
  if (session.status === 'signedOut') {
    return <LoginPage notice={session.denied ? 'Esta cuenta no tiene acceso.' : undefined} />;
  }

  return (
    <ToastProvider>
      {/* Hash routes (/login/#/invitations): static hosting needs no rewrites. */}
      <HashRouter>
        <Routes>
          <Route element={<AdminLayout email={session.session.user.email ?? ''} />}>
            <Route index element={<DashboardPage />} />
            <Route path="invitations" element={<InvitationsPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="theme" element={<ThemePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}

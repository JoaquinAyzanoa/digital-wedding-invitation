import { useId, useState, type FormEvent } from 'react';
import { isAdminSession } from '@/admin/auth/useSession';
import { supabase } from '@/admin/supabase';
import { Btn } from '@/admin/ui/Btn';
import ui from '@/admin/ui/ui.module.css';
import styles from './LoginPage.module.css';

export function LoginPage({ notice }: { notice?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(notice ?? '');
  const [busy, setBusy] = useState(false);
  const id = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (signInError) {
      setError(
        signInError.status === 400 || /invalid/i.test(signInError.message)
          ? 'Correo o contraseña incorrectos.'
          : 'No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.',
      );
      return;
    }
    // Only accounts with app_metadata.role = 'admin' get in (RLS enforces it too).
    if (data.session && !isAdminSession(data.session)) {
      await supabase.auth.signOut();
      setError('Esta cuenta no tiene acceso.');
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={submit} noValidate>
        <h1 className={styles.title}>Acceso</h1>

        <div className={ui.field}>
          <label htmlFor={`${id}-email`} className={ui.label}>
            Correo
          </label>
          <input
            id={`${id}-email`}
            type="email"
            className={ui.input}
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className={ui.field}>
          <label htmlFor={`${id}-password`} className={ui.label}>
            Contraseña
          </label>
          <input
            id={`${id}-password`}
            type="password"
            className={ui.input}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className={ui.errorBox} role="alert">
            {error}
          </p>
        )}

        <Btn type="submit" disabled={busy || !email || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Btn>
      </form>
    </main>
  );
}

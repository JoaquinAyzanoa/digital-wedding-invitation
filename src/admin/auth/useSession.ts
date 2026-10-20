import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '@/admin/supabase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session; isAdmin: boolean };

export function isAdminSession(session: Session): boolean {
  return session.user.app_metadata?.role === 'admin';
}

/** Current session, kept in sync with sign-in, sign-out and token refreshes. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    const apply = (session: Session | null) =>
      setState(
        session
          ? { status: 'signedIn', session, isAdmin: isAdminSession(session) }
          : { status: 'signedOut' },
      );

    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

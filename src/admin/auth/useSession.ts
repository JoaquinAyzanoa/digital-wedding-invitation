import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '@/admin/supabase';

export type SessionState =
  | { status: 'loading' }
  /** `denied`: the last session belonged to an account without the admin role. */
  | { status: 'signedOut'; denied: boolean }
  | { status: 'signedIn'; session: Session };

export function isAdminSession(session: Session): boolean {
  return session.user.app_metadata?.role === 'admin';
}

/** Current admin session. A session of a non-admin account is signed out right away. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    const apply = (session: Session | null) => {
      if (session && !isAdminSession(session)) {
        void supabase.auth.signOut();
        setState({ status: 'signedOut', denied: true });
        return;
      }
      setState((previous) =>
        session
          ? { status: 'signedIn', session }
          : // Keep the "no access" notice through the SIGNED_OUT event that follows.
            { status: 'signedOut', denied: previous.status === 'signedOut' && previous.denied },
      );
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

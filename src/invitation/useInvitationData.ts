import { useEffect, useState } from 'react';
import { ApiError, type PublicApi } from '@/shared/api';
import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';

export type CodeStatus = 'none' | 'valid' | 'not_found';

export type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | {
      status: 'ready';
      content: PublicContent;
      invitation: InvitationView | null;
      codeStatus: CodeStatus;
    };

/** Loads the content and the guest's invitation in parallel. Bump `attempt` to retry. */
export function useInvitationData(
  api: PublicApi,
  code: string | null,
  track: boolean,
  attempt: number,
): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    Promise.all([api.getContent(), code ? api.getInvitation(code, { track }) : null]).then(
      ([content, invitation]) => {
        if (!active) return;
        setState({
          status: 'ready',
          content,
          invitation,
          codeStatus: !code ? 'none' : invitation ? 'valid' : 'not_found',
        });
      },
      (error: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError('unknown', String(error)),
        });
      },
    );
    return () => {
      active = false;
    };
  }, [api, code, track, attempt]);

  return state;
}

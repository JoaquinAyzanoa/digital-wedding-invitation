import { createContext, useContext } from 'react';
import type { PublicApi } from '@/shared/api';
import type { InvitationView } from '@/shared/schemas/invitation';

export interface RsvpContextValue {
  api: PublicApi;
  /** Replaces the invitation after the guest answers (or when the server says it closed). */
  onInvitationChange: (invitation: InvitationView) => void;
}

export const RsvpContext = createContext<RsvpContextValue | null>(null);

export function useRsvpContext(): RsvpContextValue {
  const value = useContext(RsvpContext);
  if (!value) throw new Error('useRsvpContext must be used inside <Invitation>');
  return value;
}

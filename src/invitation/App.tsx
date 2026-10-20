import { useState } from 'react';
import { selectPublicApi } from '@/shared/api';
import { normalizeCode } from '@/shared/utils/code';
import { Invitation } from './Invitation';
import { ErrorScreen, LoadingScreen } from './StatusScreen';
import { useInvitationData } from './useInvitationData';

const params = new URLSearchParams(window.location.search);
const code = normalizeCode(params.get('i'));
// Previews and links opened from the admin must not count as guest visits.
const track = !params.has('preview') && !params.has('notrack');
const showDesignPanel = params.has('design');
const api = selectPublicApi(code);

export default function App() {
  const [attempt, setAttempt] = useState(0);
  const state = useInvitationData(api, code, track, attempt);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') {
    return <ErrorScreen error={state.error} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  return (
    <Invitation
      api={api}
      content={state.content}
      invitation={state.invitation}
      codeStatus={state.codeStatus}
      showDesignPanel={showDesignPanel}
    />
  );
}

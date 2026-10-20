import { useState } from 'react';
import { selectPublicApi } from '@/shared/api';
import { normalizeCode } from '@/shared/utils/code';
import { Invitation } from './Invitation';
import { ErrorScreen, LoadingScreen } from './StatusScreen';
import { useInvitationData } from './useInvitationData';
import { usePreviewContent } from './usePreviewContent';

const params = new URLSearchParams(window.location.search);
const code = normalizeCode(params.get('i'));
// Previews and links opened from the admin must not count as guest visits.
const preview = params.has('preview');
const track = !preview && !params.has('notrack');
const showDesignPanel = params.has('design');
const api = selectPublicApi(code);

export default function App() {
  const [attempt, setAttempt] = useState(0);
  const state = useInvitationData(api, code, track, attempt);
  const previewOverride = usePreviewContent(preview);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') {
    return <ErrorScreen error={state.error} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  // In the admin's preview, its unsaved content (and payment details) replace the loaded ones.
  const content = previewOverride?.content ?? state.content;
  const invitation =
    previewOverride && state.invitation
      ? { ...state.invitation, private: previewOverride.private }
      : state.invitation;

  return (
    <Invitation
      api={api}
      content={content}
      invitation={invitation}
      codeStatus={state.codeStatus}
      showDesignPanel={showDesignPanel}
    />
  );
}

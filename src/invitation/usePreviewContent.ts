import { useEffect, useState } from 'react';
import { isPreviewContentMessage, PREVIEW_READY } from '@/shared/preview';
import {
  privateContentSchema,
  publicContentSchema,
  type PrivateContent,
  type PublicContent,
} from '@/shared/schemas/content';

export interface PreviewOverride {
  content: PublicContent;
  private: PrivateContent;
}

/**
 * In `?preview=1`, the admin (parent window, same origin) sends its unsaved content.
 * Anything else is ignored: other origins, malformed or invalid content.
 */
export function usePreviewContent(enabled: boolean): PreviewOverride | null {
  const [override, setOverride] = useState<PreviewOverride | null>(null);

  useEffect(() => {
    if (!enabled || window.parent === window) return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isPreviewContentMessage(event.data)) return;
      const content = publicContentSchema.safeParse(event.data.content);
      const privateContent = privateContentSchema.safeParse(event.data.private);
      if (content.success && privateContent.success) {
        setOverride({ content: content.data, private: privateContent.data });
      }
    }

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [enabled]);

  return override;
}

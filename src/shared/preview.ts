import type { PrivateContent, PublicContent } from './schemas/content';

// The admin shows the invitation in an iframe (`/?preview=1&i=demo`) and sends it the
// unsaved content, so changes are visible before saving.

export const PREVIEW_READY = 'wi-preview-ready';
export const PREVIEW_CONTENT = 'wi-preview-content';

export interface PreviewContentMessage {
  type: typeof PREVIEW_CONTENT;
  content: PublicContent;
  private: PrivateContent;
}

export function isPreviewContentMessage(data: unknown): data is PreviewContentMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === PREVIEW_CONTENT
  );
}

import { createDemoApi, DEMO_CODE } from './demoApi';
import { createSupabaseApi } from './supabaseApi';
import type { PublicApi } from './types';

export { ApiError, type ApiErrorCode, type PublicApi, type UploadOptions } from './types';
export { DEMO_CODE } from './demoApi';

export const hasBackend = Boolean(import.meta.env.VITE_SUPABASE_URL);

/** Demo when there is no backend configured or the guest opens `?i=demo`; Supabase otherwise. */
export function selectPublicApi(code: string | null): PublicApi {
  if (!hasBackend || code === DEMO_CODE) return createDemoApi();
  return createSupabaseApi();
}

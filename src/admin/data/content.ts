import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/admin/supabase';
import { demoContent } from '@/demo/content';
import {
  privateContentSchema,
  publicContentSchema,
  type PrivateContent,
  type PublicContent,
} from '@/shared/schemas/content';
import type { Json } from '@/shared/types/database.types';
import { keys } from './queries';

// The columns are `jsonb not null`: a plain object, never null.
type JsonObject = { [key: string]: Json | undefined };

export const contentKey = ['siteContent'] as const;

export interface SiteContent {
  public: PublicContent;
  private: PrivateContent;
  /** Optimistic concurrency: saving only succeeds if nobody saved in between. */
  version: number;
  /** The database had no (valid) content yet: this is the example to start from. */
  isStarter: boolean;
}

export class ContentConflictError extends Error {
  constructor() {
    super('Alguien guardó cambios mientras editabas. Recarga para ver la última versión.');
  }
}

export function useSiteContent() {
  return useQuery({
    queryKey: contentKey,
    queryFn: async (): Promise<SiteContent> => {
      const { data, error } = await supabase
        .from('site_content')
        .select('public_data, private_data, version')
        .eq('id', 1)
        .single();
      if (error) throw error;

      const parsedPublic = publicContentSchema.safeParse(data.public_data);
      const parsedPrivate = privateContentSchema.safeParse(data.private_data);
      return {
        public: parsedPublic.success ? parsedPublic.data : structuredClone(demoContent),
        private: parsedPrivate.success ? parsedPrivate.data : { gifts: [] },
        version: data.version,
        isStarter: !parsedPublic.success,
      };
    },
    // The editor owns its draft: never replace it with a background refetch.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSaveContent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      content,
      version,
    }: {
      content: Omit<SiteContent, 'version' | 'isStarter'>;
      version: number;
    }) => {
      const { data, error } = await supabase
        .from('site_content')
        .update({
          public_data: content.public as unknown as JsonObject,
          private_data: content.private as unknown as JsonObject,
        })
        .eq('id', 1)
        .eq('version', version)
        .select('version');
      if (error) throw error;
      if (!data?.length) throw new ContentConflictError();
      return data[0]!.version;
    },
    onSuccess: async (version, { content }) => {
      client.setQueryData<SiteContent>(contentKey, { ...content, version, isStarter: false });
      // Menu options and questions feed the RSVP editor.
      await client.invalidateQueries({ queryKey: keys.rsvpRules });
    },
  });
}

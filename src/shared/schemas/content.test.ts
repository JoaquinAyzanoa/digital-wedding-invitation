import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoContent } from '@/demo/content';
import { privateContentSchema, publicContentSchema } from './content';

// The two jsonb literals in seed.sql: `set public_data = $json$...$json$` and `private_data`.
function seedJson(): unknown[] {
  const sql = readFileSync(new URL('../../../supabase/seed.sql', import.meta.url), 'utf8');
  return [...sql.matchAll(/\$json\$([\s\S]*?)\$json\$/g)].map((match) => JSON.parse(match[1]!));
}

describe('content schema', () => {
  it('accepts the demo fixture', () => {
    expect(publicContentSchema.safeParse(demoContent).error).toBeUndefined();
  });

  it('accepts the seed content, so the fixture and the database agree', () => {
    const [publicData, privateData] = seedJson();
    expect(publicContentSchema.safeParse(publicData).error).toBeUndefined();
    expect(privateContentSchema.safeParse(privateData).error).toBeUndefined();
  });

  it('rejects an invalid color and an unknown icon', () => {
    const bad = structuredClone(demoContent) as unknown as {
      theme: { colors: { primary: string } };
      itinerary: Array<{ icon: string }>;
    };
    bad.theme.colors.primary = 'blue';
    bad.itinerary[0]!.icon = 'rocket';
    const issues = publicContentSchema.safeParse(bad).error?.issues.map((i) => i.path.join('.'));
    expect(issues).toEqual(['itinerary.0.icon', 'theme.colors.primary']);
  });
});

describe('content schema security', () => {
  it('only accepts http(s) URLs', () => {
    const bad = structuredClone(demoContent);
    bad.events[0]!.mapsUrl = 'javascript:alert(1)';
    expect(publicContentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects font names that could break out of CSS', () => {
    const bad = structuredClone(demoContent);
    bad.theme.fonts.script = { source: 'google', family: 'X"; } body { display: none' };
    expect(publicContentSchema.safeParse(bad).success).toBe(false);
  });
});

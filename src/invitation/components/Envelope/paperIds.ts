/** Ids of the envelope's shared SVG definitions (unique per envelope). */
export interface PaperIds {
  grain: string;
  liner: string;
  fold: string;
  lift: string;
  light: string;
  vine: string;
}

export function paperIds(base: string): PaperIds {
  const id = base.replace(/[^a-zA-Z0-9_-]/g, '');
  return {
    grain: `${id}-grain`,
    liner: `${id}-liner`,
    fold: `${id}-fold`,
    lift: `${id}-lift`,
    light: `${id}-light`,
    vine: `${id}-vine`,
  };
}

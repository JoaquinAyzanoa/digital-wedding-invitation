import { createContext } from 'react';

/**
 * Whether a section starts a sheet of paper (the first one, or right after a full-width
 * photo): there the embossed garland runs along its top edge.
 */
export const PaperEdgeContext = createContext(false);

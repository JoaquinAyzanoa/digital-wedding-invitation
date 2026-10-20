import { createContext } from 'react';

/**
 * False while the envelope covers the page. Elements behind it count as "in view" for the
 * browser, so without this the first sections would reveal before anyone could see them.
 */
export const RevealContext = createContext(true);

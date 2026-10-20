import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Only for component tests (`// @vitest-environment jsdom`); unit tests run in node.
if (typeof window !== 'undefined') {
  // Animated step transitions run slower in jsdom than in a browser.
  configure({ asyncUtilTimeout: 3000 });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  // Reduced motion: the envelope fades instead of playing its 3 s sequence.
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

  class NoopObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;
  window.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
  window.scrollTo = () => {};
  // Animations (motion) need a frame loop to finish.
  window.requestAnimationFrame ??= (callback) =>
    window.setTimeout(() => callback(performance.now()), 16);
  window.cancelAnimationFrame ??= (id) => window.clearTimeout(id);

  // jsdom has no media playback.
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
}

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { lazy, Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('shows the fallback when a child throws, instead of unmounting the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new Error('boom');
    }
    render(
      <>
        <p>Resto de la página</p>
        <ErrorBoundary fallback={<p>Algo salió mal</p>}>
          <Broken />
        </ErrorBoundary>
      </>,
    );
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByText('Resto de la página')).toBeInTheDocument();
  });

  it('catches a lazy chunk that fails to download', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Lazy = lazy(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module')),
    );
    render(
      <ErrorBoundary fallback={<p>No pudimos cargar el formulario</p>}>
        <Suspense fallback={<p>Cargando…</p>}>
          <Lazy />
        </Suspense>
      </ErrorBoundary>,
    );
    expect(await screen.findByText('No pudimos cargar el formulario')).toBeInTheDocument();
  });
});

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/global.css';
import { CrashScreen } from '@/invitation/StatusScreen';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { PhotosApp } from './PhotosApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<CrashScreen />}>
      <PhotosApp />
    </ErrorBoundary>
  </StrictMode>,
);

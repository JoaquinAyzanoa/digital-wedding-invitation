import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/global.css';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import App from './App';
import { CrashScreen } from './StatusScreen';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<CrashScreen />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

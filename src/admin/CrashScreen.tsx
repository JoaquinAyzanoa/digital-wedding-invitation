import { Btn } from './ui/Btn';
import ui from './ui/ui.module.css';

export function CrashScreen() {
  return (
    <main className={ui.empty} role="alert">
      <p>Algo salió mal en el panel.</p>
      <p style={{ margin: '12px 0' }}>Recarga la página para continuar.</p>
      <Btn onClick={() => window.location.reload()}>Recargar</Btn>
    </main>
  );
}

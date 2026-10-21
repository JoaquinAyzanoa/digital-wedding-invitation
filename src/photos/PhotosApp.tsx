import { useEffect, useState } from 'react';
import { AlbumUploader } from '@/invitation/album/AlbumUploader';
import { ErrorScreen, LoadingScreen } from '@/invitation/StatusScreen';
import { ApiError, selectPublicApi } from '@/shared/api';
import { Icon } from '@/shared/icons/Icon';
import type { PublicContent } from '@/shared/schemas/content';
import { applyTheme } from '@/shared/theme/theme';
import { isAlbumOpen, limaInstant } from '@/shared/utils/album';
import { dayMonthInLima } from '@/shared/utils/date';
import styles from './PhotosApp.module.css';

// No code: this page is for everyone (the QR on the tables). Content only.
const api = selectPublicApi(null);

type State =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; content: PublicContent };

/** Why there is no upload button, in the guest's words. */
function closedMessage(album: PublicContent['album'], now = new Date()) {
  if (!album.enabled || !album.uploadUrl) return 'Muy pronto podrás subir tus fotos aquí.';
  if (now < limaInstant(album.opensAt)) {
    return `El álbum se abre el ${dayMonthInLima(album.opensAt)}. ¡Vuelve ese día!`;
  }
  return 'El álbum ya se cerró. ¡Gracias por compartir tus recuerdos!';
}

/** /photos/: names, the album text and "Subir fotos", in the invitation's look. */
export function PhotosApp() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    api.getContent().then(
      (content) => {
        if (!active) return;
        document.title = `Fotos · ${content.couple.bride} & ${content.couple.groom}`;
        void applyTheme(content.theme, content.customFonts).then(() => {
          if (active) setState({ status: 'ready', content });
        });
      },
      (error: unknown) => {
        if (active) {
          setState({
            status: 'error',
            error: error instanceof ApiError ? error : new ApiError('unknown'),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') {
    return (
      <ErrorScreen
        error={state.error}
        onRetry={() => {
          setState({ status: 'loading' });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const { content } = state;
  const { album, couple } = content;
  const open = isAlbumOpen(album);

  return (
    <main className={styles.page}>
      {content.decorations.cornerTL && (
        <img className={styles.flowers} src={content.decorations.cornerTL} alt="" />
      )}
      <p className={styles.names}>
        {couple.bride} <span className={styles.amp}>&</span> {couple.groom}
      </p>
      <Icon name="camera" size={64} className={styles.icon} />
      <h1 className={styles.title}>Comparte tus fotos y videos</h1>
      {album.text && <p className={styles.text}>{album.text}</p>}
      {open && album.uploadUrl ? (
        <AlbumUploader api={api} uploadUrl={album.uploadUrl} />
      ) : (
        <p className={styles.closed} role="status">
          {closedMessage(album)}
        </p>
      )}
    </main>
  );
}

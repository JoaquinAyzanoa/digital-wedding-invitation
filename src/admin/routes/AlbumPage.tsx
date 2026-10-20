import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlbumZipDialog } from '@/admin/album/AlbumZipDialog';
import { PhotoViewer } from '@/admin/album/PhotoViewer';
import {
  useAlbumPhotos,
  useAlbumStats,
  useThumbnails,
  type AlbumPhoto,
  type AlbumStats,
} from '@/admin/data/album';
import { adminErrorMessage } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import ui from '@/admin/ui/ui.module.css';
import styles from './AlbumPage.module.css';

/** Supabase free plan: 1 GB of Storage for photos, music, fonts… */
const STORAGE_LIMIT = 1024 ** 3;
const PAGE = 60;

type Show = 'all' | 'visible' | 'hidden';

function megabytes(bytes: number) {
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return bytes < 1024 ** 3
    ? `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`
    : `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function Usage({ stats }: { stats: AlbumStats }) {
  const used = stats.albumBytes + stats.siteBytes;
  const percent = Math.min(100, Math.round((used / STORAGE_LIMIT) * 100));
  return (
    <div className={styles.usage}>
      <div className={styles.usageText}>
        <span>Espacio usado</span>
        <strong>
          {megabytes(used)} de 1 GB ({percent} %)
        </strong>
      </div>
      <span className={styles.bar} data-warn={percent >= 80} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
      <span className={ui.hint}>
        Fotos del álbum {megabytes(stats.albumBytes)} · fotos, música y fuentes de la invitación{' '}
        {megabytes(stats.siteBytes)}. Caben unas{' '}
        {Math.max(0, Math.floor((STORAGE_LIMIT - used) / (550 * 1024))).toLocaleString('es-PE')}{' '}
        fotos más.
      </span>
    </div>
  );
}

function Thumbnail({
  photo,
  url,
  onOpen,
}: {
  photo: AlbumPhoto;
  url: string | null | undefined;
  onOpen: () => void;
}) {
  return (
    <li className={styles.thumb} data-hidden={photo.hidden}>
      <button
        type="button"
        className={styles.thumbButton}
        onClick={onOpen}
        aria-label={`Ver foto de ${photo.invitation.display_name}${photo.hidden ? ' (oculta)' : ''}`}
      >
        {url ? <img src={url} alt="" loading="lazy" /> : <span className={styles.placeholder} />}
        {photo.hidden && <span className={styles.hiddenBadge}>Oculta</span>}
      </button>
    </li>
  );
}

export function AlbumPage() {
  const photos = useAlbumPhotos();
  const stats = useAlbumStats();
  const [guest, setGuest] = useState('all');
  const [show, setShow] = useState<Show>('all');
  const [limit, setLimit] = useState(PAGE);
  const [viewing, setViewing] = useState<number | null>(null);
  const [zip, setZip] = useState<AlbumPhoto[] | null>(null);

  const all = useMemo(() => photos.data ?? [], [photos.data]);
  const guests = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const p of all) {
      const entry = counts.get(p.invitation.code) ?? { name: p.invitation.display_name, count: 0 };
      entry.count++;
      counts.set(p.invitation.code, entry);
    }
    return [...counts].sort(([, a], [, b]) => a.name.localeCompare(b.name, 'es'));
  }, [all]);
  const filtered = useMemo(
    () =>
      all.filter(
        (p) =>
          (guest === 'all' || p.invitation.code === guest) &&
          (show === 'all' || (show === 'hidden') === p.hidden),
      ),
    [all, guest, show],
  );
  const onScreen = filtered.slice(0, limit);
  const thumbs = useThumbnails(onScreen);
  const downloadable = filtered.filter((p) => !p.hidden);

  if (photos.isPending) return <p className={ui.empty}>Cargando…</p>;
  if (photos.isError) {
    return (
      <div className={ui.empty} role="alert">
        <p>{adminErrorMessage(photos.error)}</p>
        <Btn variant="secondary" onClick={() => photos.refetch()}>
          Reintentar
        </Btn>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Álbum <span className={ui.muted}>({all.length})</span>
        </h1>
        <Btn disabled={downloadable.length === 0} onClick={() => setZip(downloadable)}>
          Descargar {downloadable.length === all.length ? 'todo' : downloadable.length} (ZIP)
        </Btn>
      </div>

      <section className={ui.card}>
        <p>
          {stats.data
            ? `${stats.data.photos} ${stats.data.photos === 1 ? 'foto' : 'fotos'} de ${stats.data.guests} ${
                stats.data.guests === 1 ? 'invitado' : 'invitados'
              }${stats.data.hidden ? ` · ${stats.data.hidden} ocultas` : ''}`
            : '…'}
        </p>
        {stats.data && <Usage stats={stats.data} />}
        <p className={ui.hint}>
          Abrir o cerrar el álbum, sus fechas y el texto: en{' '}
          <Link to="/content">Contenido → Álbum y despedida</Link>. Las fotos ocultas no entran en
          las descargas.
        </p>
      </section>

      {all.length === 0 ? (
        <p className={ui.empty}>
          Todavía no hay fotos. Aparecerán aquí cuando los invitados las suban.
        </p>
      ) : (
        <>
          <div className={styles.filters}>
            <label className={ui.field}>
              <span className={ui.label}>Invitado</span>
              <select
                className={ui.select}
                value={guest}
                onChange={(e) => {
                  setGuest(e.target.value);
                  setLimit(PAGE);
                }}
              >
                <option value="all">Todos</option>
                {guests.map(([code, { name, count }]) => (
                  <option key={code} value={code}>
                    {name} ({count})
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Mostrar</span>
              <select
                className={ui.select}
                value={show}
                onChange={(e) => {
                  setShow(e.target.value as Show);
                  setLimit(PAGE);
                }}
              >
                <option value="all">Todas</option>
                <option value="visible">Visibles</option>
                <option value="hidden">Ocultas</option>
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <p className={ui.empty}>Ninguna foto con estos filtros.</p>
          ) : (
            <ul className={styles.grid} aria-label="Fotos del álbum">
              {onScreen.map((photo, index) => (
                <Thumbnail
                  key={photo.id}
                  photo={photo}
                  url={thumbs.data?.get(photo.path)}
                  onOpen={() => setViewing(index)}
                />
              ))}
            </ul>
          )}
          {filtered.length > limit && (
            <Btn variant="secondary" className={styles.more} onClick={() => setLimit(limit + PAGE)}>
              Ver más ({filtered.length - limit})
            </Btn>
          )}
        </>
      )}

      {viewing !== null && filtered[viewing] && (
        <PhotoViewer
          photos={filtered}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
      {zip && <AlbumZipDialog photos={zip} onClose={() => setZip(null)} />}
    </div>
  );
}

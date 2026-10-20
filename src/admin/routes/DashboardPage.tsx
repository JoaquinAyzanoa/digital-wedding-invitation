import { Link } from 'react-router';
import { adminErrorMessage, useDashboard, useInvitations } from '@/admin/data/queries';
import { Btn } from '@/admin/ui/Btn';
import ui from '@/admin/ui/ui.module.css';
import { SIDE_LABELS, type Side } from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import { copyText } from '@/shared/utils/clipboard';
import { invitationLink } from '@/shared/utils/links';
import styles from './DashboardPage.module.css';

const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

function when(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Nunca';
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail?: string;
}) {
  return (
    <div className={`${ui.card} ${styles.stat}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {detail && <span className={styles.statDetail}>{detail}</span>}
    </div>
  );
}

function Bar({ value, total }: { value: number; total: number }) {
  return (
    <span className={styles.bar} aria-hidden="true">
      <span style={{ width: `${percent(value, total)}%` }} />
    </span>
  );
}

export function DashboardPage() {
  const dashboard = useDashboard();
  const invitations = useInvitations();
  const toast = useToast();

  if (dashboard.isPending) return <p className={ui.empty}>Cargando…</p>;
  if (dashboard.isError) {
    return (
      <div className={ui.empty} role="alert">
        <p>{adminErrorMessage(dashboard.error)}</p>
        <Btn variant="secondary" onClick={() => dashboard.refetch()}>
          Reintentar
        </Btn>
      </div>
    );
  }

  const d = dashboard.data;
  const pending = (invitations.data ?? []).filter((i) => i.attending === null);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Resumen</h1>

      <section className={styles.stats} aria-label="Invitaciones">
        <Stat
          label="Invitaciones"
          value={d.invitations.total}
          detail={`${d.invitations.seats} pases`}
        />
        <Stat
          label="Personas confirmadas"
          value={d.people.confirmed}
          detail={`de ${d.invitations.seats} pases · ${d.people.adults} adultos · ${d.people.children} niños`}
        />
        <Stat
          label="Respondieron"
          value={`${percent(d.invitations.responded, d.invitations.total)}%`}
          detail={`${d.invitations.responded} de ${d.invitations.total}`}
        />
        <Stat label="No asisten" value={d.invitations.declined} detail="invitaciones" />
      </section>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>Seguimiento</h2>
        <ul className={styles.funnel}>
          {[
            ['Enviadas', d.invitations.sent],
            ['Abiertas', d.invitations.opened],
            ['Respondidas', d.invitations.responded],
            ['Pendientes', d.invitations.pending],
          ].map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <Bar value={Number(value)} total={d.invitations.total} />
              <strong>{value}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.columns}>
        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Por lado</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Lado</th>
                <th scope="col">Invit.</th>
                <th scope="col">Pases</th>
                <th scope="col">Confirm.</th>
              </tr>
            </thead>
            <tbody>
              {d.bySide.map((row) => (
                <tr key={row.side}>
                  <th scope="row">{SIDE_LABELS[row.side as Side] ?? row.side}</th>
                  <td>{row.invitations}</td>
                  <td>{row.seats}</td>
                  <td>{row.confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Por grupo</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Grupo</th>
                <th scope="col">Invit.</th>
                <th scope="col">Pases</th>
                <th scope="col">Confirm.</th>
              </tr>
            </thead>
            <tbody>
              {d.byGroup.map((row) => (
                <tr key={row.group ?? '—'}>
                  <th scope="row">{row.group ?? 'Sin grupo'}</th>
                  <td>{row.invitations}</td>
                  <td>{row.seats}</td>
                  <td>{row.confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Menús</h2>
          {d.menu.length === 0 ? (
            <p className={ui.muted}>Aún no hay confirmaciones.</p>
          ) : (
            <ul className={styles.list}>
              {d.menu.map((row) => (
                <li key={row.menu ?? '—'}>
                  <span>{row.menu ?? 'Sin menú'}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          )}
          {d.dietary.length > 0 && (
            <>
              <h3 className={styles.subtitle}>Alergias y restricciones</h3>
              <ul className={styles.notes}>
                {d.dietary.map((row, i) => (
                  <li key={i}>
                    <strong>{row.fullName}</strong> ({row.invitation}): {row.dietary}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Logística</h2>
          <ul className={styles.list}>
            <li>
              <span>Necesitan transporte</span>
              <strong>{d.logistics.transport.people} personas</strong>
            </li>
            <li>
              <span>Necesitan hospedaje</span>
              <strong>{d.logistics.lodging.people} personas</strong>
            </li>
            <li>
              <span>Fotos en el álbum</span>
              <strong>{d.album.photos}</strong>
            </li>
            <li>
              <span>Última sincronización del Sheet</span>
              <strong>{when(d.sheet.lastSyncAt)}</strong>
            </li>
          </ul>
        </section>
      </div>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>Pendientes de responder ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className={ui.muted}>¡Todos respondieron!</p>
        ) : (
          <ul className={styles.pending}>
            {pending.slice(0, 50).map((i) => (
              <li key={i.id}>
                <span>
                  {i.display_name}
                  <span className={ui.muted}>
                    {' · '}
                    {i.first_opened_at
                      ? 'la abrió'
                      : i.sent_at
                        ? 'enviada, sin abrir'
                        : 'sin enviar'}
                  </span>
                </span>
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={async () =>
                    toast(
                      (await copyText(invitationLink(i.code)))
                        ? 'Enlace copiado'
                        : 'No se pudo copiar',
                    )
                  }
                >
                  Copiar enlace
                </Btn>
              </li>
            ))}
          </ul>
        )}
        {pending.length > 50 && (
          <Link to="/invitations?status=pending" className={styles.more}>
            Ver los {pending.length}
          </Link>
        )}
      </section>

      <div className={styles.columns}>
        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Mensajes ({d.messages.length})</h2>
          {d.messages.length === 0 ? (
            <p className={ui.muted}>Todavía no hay mensajes.</p>
          ) : (
            <ul className={styles.messages}>
              {d.messages.map((m, i) => (
                <li key={i}>
                  <p>“{m.message}”</p>
                  <span className={ui.muted}>
                    {m.invitation} · {m.attending ? 'asiste' : 'no asiste'} · {when(m.respondedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={ui.card}>
          <h2 className={ui.cardTitle}>Canciones sugeridas ({d.songs.length})</h2>
          {d.songs.length === 0 ? (
            <p className={ui.muted}>Todavía no hay canciones.</p>
          ) : (
            <ul className={styles.notes}>
              {d.songs.map((s, i) => (
                <li key={i}>
                  <strong>{s.song}</strong> <span className={ui.muted}>({s.invitation})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { adminErrorMessage, useDeleteInvitations, useInvitations } from '@/admin/data/queries';
import {
  applyFilters,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  groupsOf,
  isFiltered,
  NO_GROUP,
  SORTS,
  type InvitationFilters,
} from '@/admin/invitations/filters';
import { ImportDialog } from '@/admin/invitations/ImportDialog';
import { InvitationPanel } from '@/admin/invitations/InvitationPanel';
import { InvitationRow } from '@/admin/invitations/InvitationRow';
import { PdfZipDialog } from '@/admin/invitations/PdfZipDialog';
import { Btn } from '@/admin/ui/Btn';
import { ConfirmDialog } from '@/admin/ui/ConfirmDialog';
import ui from '@/admin/ui/ui.module.css';
import { SIDE_LABELS, SIDES, type InvitationWithAttendees } from '@/shared/schemas/invitationAdmin';
import { useToast } from '@/shared/toast/toastContext';
import { attendeesCsv, downloadText, invitationsCsv } from '@/shared/utils/csv';
import { invitationLink } from '@/shared/utils/links';
import styles from './InvitationsPage.module.css';

type Panel =
  | { kind: 'new' }
  | { kind: 'edit'; id: string }
  | { kind: 'import' }
  // A frozen copy of the rows: the ZIP must not restart if the list changes meanwhile.
  | { kind: 'zip'; rows: InvitationWithAttendees[] }
  | null;

export function InvitationsPage() {
  const invitations = useInvitations();
  const remove = useDeleteInvitations();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const urlFilters = useMemo(() => filtersFromParams(params), [params]);
  // The search box keeps its own state: URL updates are asynchronous, and a box controlled
  // by the URL lost keystrokes when typing fast. The URL catches up after a short pause.
  const [query, setQuery] = useState(urlFilters.q);
  const filters = useMemo(() => ({ ...urlFilters, q: query }), [urlFilters, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setParams((current) => filtersToParams({ ...filtersFromParams(current), q: query }), {
        replace: true,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, setParams]);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showFilters, setShowFilters] = useState(isFiltered(filters));

  const all = useMemo(() => invitations.data ?? [], [invitations.data]);
  const visible = useMemo(() => applyFilters(all, filters), [all, filters]);
  const groups = useMemo(() => groupsOf(all), [all]);
  // Bulk actions only touch selected rows that are on screen: rows hidden by a search or
  // filter (or deleted elsewhere) are never deleted or exported by surprise.
  const selectedRows = visible.filter((i) => selected.has(i.id));

  function setFilter<K extends keyof InvitationFilters>(key: K, value: InvitationFilters[K]) {
    // From the current URL, not this render's copy, so quick changes never undo each other.
    setParams(
      (current) => filtersToParams({ ...filtersFromParams(current), q: query, [key]: value }),
      {
        replace: true,
      },
    );
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));

  function exportCsv(kind: 'invitations' | 'attendees') {
    const rows = selectedRows.length ? selectedRows : visible;
    const date = new Date().toISOString().slice(0, 10);
    if (kind === 'invitations')
      downloadText(invitationsCsv(rows, invitationLink), `invitaciones-${date}.csv`);
    else downloadText(attendeesCsv(rows), `asistentes-${date}.csv`);
  }

  async function deleteSelected() {
    try {
      await remove.mutateAsync(selectedRows.map((i) => i.id));
      toast(`${selectedRows.length} eliminadas`);
      setSelected(new Set());
    } catch (error) {
      toast(adminErrorMessage(error));
    } finally {
      setConfirmDelete(false);
    }
  }

  if (invitations.isPending) return <p className={ui.empty}>Cargando…</p>;
  if (invitations.isError) {
    return (
      <div className={ui.empty} role="alert">
        <p>{adminErrorMessage(invitations.error)}</p>
        <Btn variant="secondary" onClick={() => invitations.refetch()}>
          Reintentar
        </Btn>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Invitados <span className={ui.muted}>({all.length})</span>
        </h1>
        <div className={styles.headerActions}>
          <Btn variant="secondary" onClick={() => setPanel({ kind: 'import' })}>
            Importar CSV
          </Btn>
          <Btn onClick={() => setPanel({ kind: 'new' })}>Nueva invitación</Btn>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          type="search"
          className={ui.input}
          placeholder="Buscar por nombre, código, grupo, teléfono…"
          aria-label="Buscar invitaciones"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Btn
          variant="secondary"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filtros{isFiltered(filters) && filters.q === '' ? ' •' : ''}
        </Btn>
      </div>

      {showFilters && (
        <div className={styles.filters}>
          <label className={ui.field}>
            <span className={ui.label}>Respuesta</span>
            <select
              className={ui.select}
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value as InvitationFilters['status'])}
            >
              <option value="all">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="attending">Asisten</option>
              <option value="declined">No asisten</option>
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Lado</span>
            <select
              className={ui.select}
              value={filters.side}
              onChange={(e) => setFilter('side', e.target.value as InvitationFilters['side'])}
            >
              <option value="all">Todos</option>
              {SIDES.map((side) => (
                <option key={side} value={side}>
                  {SIDE_LABELS[side]}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Grupo</span>
            <select
              className={ui.select}
              value={filters.group}
              onChange={(e) => setFilter('group', e.target.value)}
            >
              <option value="all">Todos</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
              <option value={NO_GROUP}>Sin grupo</option>
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Enviada</span>
            <select
              className={ui.select}
              value={filters.sent}
              onChange={(e) => setFilter('sent', e.target.value as InvitationFilters['sent'])}
            >
              <option value="all">Todas</option>
              <option value="yes">Enviadas</option>
              <option value="no">Sin enviar</option>
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Abierta</span>
            <select
              className={ui.select}
              value={filters.opened}
              onChange={(e) => setFilter('opened', e.target.value as InvitationFilters['opened'])}
            >
              <option value="all">Todas</option>
              <option value="yes">Abiertas</option>
              <option value="no">Sin abrir</option>
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Orden</span>
            <select
              className={ui.select}
              value={filters.sort}
              onChange={(e) => setFilter('sort', e.target.value as InvitationFilters['sort'])}
            >
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {isFiltered(filters) && (
            <Btn
              variant="ghost"
              className={styles.clear}
              onClick={() => {
                setQuery('');
                setParams(filtersToParams({ ...DEFAULT_FILTERS, sort: filters.sort }));
              }}
            >
              Quitar filtros
            </Btn>
          )}
        </div>
      )}

      <div className={styles.listHeader}>
        <label className={ui.checkbox}>
          <input
            type="checkbox"
            aria-label="Seleccionar todas las visibles"
            checked={allVisibleSelected}
            onChange={() =>
              setSelected(allVisibleSelected ? new Set() : new Set(visible.map((i) => i.id)))
            }
          />
          {visible.length === all.length
            ? `${all.length} invitaciones`
            : `${visible.length} de ${all.length}`}
        </label>
        <div className={styles.exports}>
          <Btn size="sm" variant="ghost" onClick={() => exportCsv('invitations')}>
            Exportar invitaciones
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => exportCsv('attendees')}>
            Exportar asistentes
          </Btn>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className={ui.empty}>
          {all.length === 0
            ? 'Aún no hay invitaciones. Crea una o importa un CSV.'
            : 'Ninguna invitación coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visible.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              selected={selected.has(invitation.id)}
              onToggle={() => toggle(invitation.id)}
              onOpen={() => setPanel({ kind: 'edit', id: invitation.id })}
            />
          ))}
        </ul>
      )}

      {selectedRows.length > 0 && (
        <div className={styles.selectionBar} role="region" aria-label="Acciones de la selección">
          <span>{selectedRows.length} seleccionadas</span>
          <Btn size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
            Deseleccionar
          </Btn>
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => setPanel({ kind: 'zip', rows: selectedRows })}
          >
            PDFs (ZIP)
          </Btn>
          <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
            Eliminar
          </Btn>
        </div>
      )}

      {panel?.kind === 'new' && <InvitationPanel onClose={() => setPanel(null)} />}
      {panel?.kind === 'edit' && (
        <InvitationPanel
          invitation={all.find((i) => i.id === panel.id)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel?.kind === 'import' && <ImportDialog existing={all} onClose={() => setPanel(null)} />}
      {panel?.kind === 'zip' && (
        <PdfZipDialog invitations={panel.rows} onClose={() => setPanel(null)} />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`¿Eliminar ${selectedRows.length} invitaciones?`}
          message="Se borran también sus respuestas y asistentes. No se puede deshacer."
          confirmLabel="Eliminar"
          danger
          busy={remove.isPending}
          onConfirm={deleteSelected}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

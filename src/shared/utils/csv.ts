import Papa from 'papaparse';
import { downloadBlob } from './download';
import {
  invitationInputSchema,
  SIDE_LABELS,
  type InvitationInput,
  type InvitationWithAttendees,
  type Side,
} from '@/shared/schemas/invitationAdmin';
import { isInvitationCode } from './code';

// ------------------------------------------------------------------ import

/** Accepted headers (accents, case and spaces ignored) for each field. */
const HEADER_ALIASES: Record<keyof InvitationInput, string[]> = {
  displayName: ['nombre', 'invitacion', 'name', 'display_name', 'displayname'],
  seats: ['pases', 'lugares', 'seats'],
  side: ['lado', 'side'],
  groupName: ['grupo', 'group', 'group_name'],
  phone: ['telefono', 'celular', 'whatsapp', 'phone'],
  email: ['email', 'correo', 'e-mail'],
  notes: ['notas', 'nota', 'notes'],
  code: ['codigo', 'code'],
};

const SIDE_ALIASES: Record<string, Side> = {
  novia: 'bride',
  bride: 'bride',
  novio: 'groom',
  groom: 'groom',
  ambos: 'both',
  both: 'both',
  '': 'both',
};

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, '_');
}

export const CSV_TEMPLATE =
  'nombre,pases,lado,grupo,telefono,email,notas,codigo\n' +
  'Familia Pérez,4,novia,Familia,987654321,,Mesa cerca del escenario,\n' +
  'Ana y Luis,2,novio,Amigos,912345678,ana@example.com,,\n';

export interface ImportRow {
  /** Line in the file (1 = header). */
  line: number;
  input: InvitationInput | null;
  errors: string[];
  warnings: string[];
}

export interface ImportResult {
  rows: ImportRow[];
  /** Problems with the file itself (missing columns, unreadable). */
  fileErrors: string[];
}

interface ExistingInvitation {
  code: string;
  display_name: string;
}

/** Parses and validates a CSV of invitations against the ones already in the database. */
export function parseInvitationsCsv(text: string, existing: ExistingInvitation[]): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    // Excel in Spanish often uses ";"
    delimitersToGuess: [',', ';', '\t'],
    transformHeader: normalize,
  });

  const headers = parsed.meta.fields ?? [];
  const column = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => [
      field,
      headers.find((header) => aliases.includes(header)),
    ]),
  ) as Record<keyof InvitationInput, string | undefined>;

  if (!column.displayName) {
    return { rows: [], fileErrors: ['Falta la columna "nombre".'] };
  }

  const existingCodes = new Set(existing.map((e) => e.code));
  const existingNames = new Set(existing.map((e) => normalize(e.display_name)));
  const seenCodes = new Map<string, number>();
  const seenNames = new Map<string, number>();

  const rows = parsed.data.map((record, index): ImportRow => {
    const line = index + 2;
    const get = (field: keyof InvitationInput) => {
      const key = column[field];
      return key ? (record[key] ?? '').trim() : '';
    };
    const errors: string[] = [];
    const warnings: string[] = [];

    const sideText = normalize(get('side'));
    const side = SIDE_ALIASES[sideText];
    if (!side) errors.push(`Lado "${get('side')}" no válido: usa novia, novio o ambos.`);

    const seatsText = get('seats');
    const seats = seatsText === '' ? 1 : Number(seatsText);

    const result = invitationInputSchema.safeParse({
      displayName: get('displayName'),
      seats,
      side: side ?? 'both',
      groupName: get('groupName'),
      phone: get('phone'),
      email: get('email'),
      notes: get('notes'),
      code: get('code'),
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        errors.push(
          field === 'seats' && Number.isNaN(seats) ? 'Pases debe ser un número.' : issue.message,
        );
      }
    }

    const input = result.success ? result.data : null;
    // Checked even when the row has other errors, so fixing those does not reveal a
    // duplicate only at import time.
    const code = get('code').toLowerCase();
    if (isInvitationCode(code)) {
      if (existingCodes.has(code)) errors.push(`El código ${code} ya existe.`);
      const previous = seenCodes.get(code);
      if (previous) errors.push(`Código repetido en la fila ${previous}.`);
      else seenCodes.set(code, line);
    }
    if (input) {
      const name = normalize(input.displayName);
      if (existingNames.has(name)) warnings.push('Ya hay una invitación con este nombre.');
      const previous = seenNames.get(name);
      if (previous) warnings.push(`Mismo nombre que la fila ${previous}.`);
      else seenNames.set(name, line);
    }

    return { line, input: errors.length ? null : input, errors, warnings };
  });

  return { rows, fileErrors: rows.length ? [] : ['El archivo no tiene filas.'] };
}

// ------------------------------------------------------------------ export

const yesNo = (value: boolean | null) => (value === null ? '' : value ? 'Sí' : 'No');
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '';

/**
 * Exports include text typed by guests (names, messages, songs). Excel runs a cell that
 * starts with = + - @ (or tab/CR) as a formula ("CSV injection"), so those get a leading
 * apostrophe. Phone numbers like "+51 987…" and negative numbers are left alone.
 */
export function neutralizeCell(value: string | number): string | number {
  if (typeof value !== 'string') return value;
  return /^[=@\t\r]|^[+-](?![\d\s])/.test(value) ? `'${value}` : value;
}

/** UTF-8 with BOM so Excel shows accents correctly. */
export function toCsv(rows: Record<string, string | number>[]): string {
  const safe = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeCell(value)])),
  );
  return '\uFEFF' + Papa.unparse(safe);
}

export function invitationsCsv(
  invitations: InvitationWithAttendees[],
  link: (code: string) => string,
): string {
  return toCsv(
    invitations.map((i) => ({
      codigo: i.code,
      nombre: i.display_name,
      pases: i.seats,
      lado: SIDE_LABELS[i.side as Side] ?? i.side,
      grupo: i.group_name ?? '',
      telefono: i.phone ?? '',
      email: i.email ?? '',
      enlace: link(i.code),
      enviada: date(i.sent_at),
      abierta: date(i.first_opened_at),
      visitas: i.open_count,
      respuesta: i.attending === null ? 'Pendiente' : i.attending ? 'Asiste' : 'No asiste',
      personas: i.attending ? i.attendees.length : 0,
      ceremonia: yesNo(i.attends_ceremony),
      recepcion: yesNo(i.attends_reception),
      transporte: yesNo(i.needs_transport),
      hospedaje: yesNo(i.needs_lodging),
      telefono_contacto: i.contact_phone ?? '',
      cancion: i.song_request ?? '',
      mensaje: i.message ?? '',
      respondio: date(i.responded_at),
      notas: i.notes ?? '',
    })),
  );
}

export function attendeesCsv(invitations: InvitationWithAttendees[]): string {
  return toCsv(
    invitations.flatMap((i) =>
      [...i.attendees]
        .sort((a, b) => a.position - b.position)
        .map((a) => ({
          codigo: i.code,
          invitacion: i.display_name,
          nombre: a.full_name,
          dni: a.dni ?? '',
          tipo: a.kind === 'child' ? 'Niño' : 'Adulto',
          edad: a.age ?? '',
          menu: a.menu ?? '',
          restricciones: a.dietary ?? '',
        })),
    ),
  );
}

export function downloadText(content: string, filename: string, type = 'text/csv;charset=utf-8') {
  downloadBlob(new Blob([content], { type }), filename);
}

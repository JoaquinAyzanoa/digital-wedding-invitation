import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import type { InvitationWithAttendees } from '@/shared/schemas/invitationAdmin';
import {
  attendeesCsv,
  CSV_TEMPLATE,
  invitationsCsv,
  neutralizeCell,
  parseInvitationsCsv,
  toCsv,
} from './csv';

describe('parseInvitationsCsv', () => {
  it('reads the template', () => {
    const { rows, fileErrors } = parseInvitationsCsv(CSV_TEMPLATE, []);
    expect(fileErrors).toEqual([]);
    expect(rows.map((r) => r.errors)).toEqual([[], []]);
    expect(rows[0]!.input).toEqual({
      displayName: 'Familia Pérez',
      seats: 4,
      side: 'bride',
      groupName: 'Familia',
      phone: '987654321',
      email: '',
      notes: 'Mesa cerca del escenario',
      code: '',
    });
  });

  it('accepts semicolons, accents and English headers; defaults seats to 1', () => {
    const { rows } = parseInvitationsCsv(
      '\uFEFFNombre;Teléfono;Side\nLucía;  912 345 678 ;Groom\n',
      [],
    );
    expect(rows[0]!.input).toMatchObject({
      displayName: 'Lucía',
      phone: '912 345 678',
      side: 'groom',
      seats: 1,
    });
  });

  it('reports each problem with its line', () => {
    const csv = [
      'nombre,pases,lado,telefono,email,codigo',
      ',2,novia,,,',
      'Ana,cero,novio,,,',
      'Luis,30,primos,abc,no-es-correo,ABC234',
      'Carla,1,ambos,,,abc234',
    ].join('\n');
    const { rows } = parseInvitationsCsv(csv, [{ code: 'zzzzzz', display_name: 'Otra' }]);
    expect(rows.map((r) => [r.line, r.errors.length > 0])).toEqual([
      [2, true],
      [3, true],
      [4, true],
      [5, true],
    ]);
    expect(rows[1]!.errors).toContain('Pases debe ser un número.');
    expect(rows[2]!.errors).toEqual(
      expect.arrayContaining([
        'Lado "primos" no válido: usa novia, novio o ambos.',
        'Máximo 20 pases',
        'Teléfono no válido',
        'Correo no válido',
      ]),
    );
    expect(rows[3]!.errors).toEqual(['Código repetido en la fila 4.']);
  });

  it('rejects codes that already exist and warns about repeated names', () => {
    const csv = 'nombre,codigo\nFamilia López,abc234\nfamilia lopez,\n';
    const { rows } = parseInvitationsCsv(csv, [{ code: 'abc234', display_name: 'Familia López' }]);
    expect(rows[0]!.errors).toEqual(['El código abc234 ya existe.']);
    expect(rows[1]!.errors).toEqual([]);
    expect(rows[1]!.warnings).toEqual([
      'Ya hay una invitación con este nombre.',
      'Mismo nombre que la fila 2.',
    ]);
  });

  it('requires a name column', () => {
    expect(parseInvitationsCsv('pases\n2\n', []).fileErrors).toEqual([
      'Falta la columna "nombre".',
    ]);
  });
});

describe('export', () => {
  const invitation = {
    id: '1',
    code: 'abc234',
    display_name: 'Familia López',
    seats: 3,
    side: 'bride',
    group_name: 'Familia',
    phone: null,
    email: null,
    notes: null,
    sent_at: null,
    first_opened_at: null,
    last_opened_at: null,
    open_count: 0,
    attending: true,
    attends_ceremony: true,
    attends_reception: true,
    needs_transport: null,
    needs_lodging: null,
    contact_phone: null,
    song_request: 'Tusa',
    message: null,
    responded_at: null,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
    attendees: [
      {
        id: 'b',
        invitation_id: '1',
        position: 2,
        full_name: 'Sofía',
        kind: 'child',
        age: 6,
        menu: 'Infantil',
        dietary: 'Maní',
        dni: null,
      },
      {
        id: 'a',
        invitation_id: '1',
        position: 1,
        full_name: 'Marta',
        kind: 'adult',
        age: null,
        menu: 'Carne',
        dietary: null,
        dni: '01234567',
      },
    ],
  } satisfies InvitationWithAttendees;

  it('writes invitations with a BOM and readable values', () => {
    const csv = invitationsCsv([invitation], (code) => `https://x.com/?i=${code}`);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const [row] = Papa.parse<Record<string, string>>(csv.slice(1), { header: true }).data;
    expect(row).toMatchObject({
      lado: 'Novia',
      respuesta: 'Asiste',
      personas: '2',
      enlace: 'https://x.com/?i=abc234',
    });
  });

  it('writes attendees in position order', () => {
    const rows = Papa.parse<Record<string, string>>(attendeesCsv([invitation]).slice(1), {
      header: true,
    }).data;
    expect(rows.map((r) => [r.nombre, r.dni, r.tipo, r.edad])).toEqual([
      ['Marta', '01234567', 'Adulto', ''],
      ['Sofía', '', 'Niño', '6'],
    ]);
  });
});

describe('CSV injection', () => {
  it('neutralizes cells Excel would run as formulas', () => {
    expect(neutralizeCell('=HYPERLINK("http://x","clic")')).toBe(`'=HYPERLINK("http://x","clic")`);
    expect(neutralizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(neutralizeCell('\t=1')).toBe("'\t=1");
  });

  it('leaves phones, negative numbers and normal text alone', () => {
    expect(neutralizeCell('+51 987 654 321')).toBe('+51 987 654 321');
    expect(neutralizeCell('-5')).toBe('-5');
    expect(neutralizeCell('-2+3')).toBe('-2+3');
    expect(neutralizeCell('¡Felicidades!')).toBe('¡Felicidades!');
    expect(neutralizeCell(3)).toBe(3);
  });

  it('applies to the exported files', () => {
    expect(toCsv([{ mensaje: '=1+1' }])).toContain(`'=1+1`);
  });
});

// Runs the Apps Script in Node with small fakes of the Google services it uses.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

type Row = unknown[];

class FakeRange {
  constructor(
    private sheet: FakeSheet,
    readonly at: string,
  ) {}
  setValues(values: Row[]) {
    this.sheet.writes.push({ at: this.at, values });
    return this;
  }
  setValue(value: unknown) {
    this.sheet.writes.push({ at: this.at, values: [[value]] });
    return this;
  }
  setFormula(formula: string) {
    this.sheet.writes.push({ at: this.at, values: [[formula]] });
    return this;
  }
  setFontWeight() {
    return this;
  }
  setNumberFormat() {
    return this;
  }
}

class FakeSheet {
  writes: Array<{ at: string; values: Row[] }> = [];
  rules: unknown[] = [];
  constructor(readonly name: string) {}
  clearContents() {
    this.writes = [];
  }
  getRange(...args: unknown[]) {
    return new FakeRange(this, args.join(','));
  }
  /** The table written at A1 (header + rows). */
  table() {
    return this.writes.find((w) => w.at === '1,1,' + w.values.length + ',' + w.values[0]!.length)
      ?.values;
  }
  setFrozenRows() {}
  setColumnWidth() {}
  setConditionalFormatRules(rules: unknown[]) {
    this.rules = rules;
  }
}

class FakeSpreadsheet {
  sheets = new Map<string, FakeSheet>();
  getSheetByName(name: string) {
    return this.sheets.get(name) ?? null;
  }
  insertSheet(name: string) {
    const sheet = new FakeSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
  setSpreadsheetTimeZone() {}
}

const EXPORT = {
  unchanged: false,
  hash: 'h1',
  syncedAt: '2026-10-22T15:00:00Z',
  invitations: [
    {
      code: 'abc234',
      displayName: 'Familia López',
      seats: 4,
      side: 'bride',
      group: 'Familia',
      phone: '987654321',
      email: null,
      notes: null,
      sentAt: '2026-10-20T15:00:00Z',
      firstOpenedAt: '2026-10-20T16:00:00Z',
      lastOpenedAt: '2026-10-21T16:00:00Z',
      openCount: 2,
      attending: true,
      attendsCeremony: true,
      attendsReception: true,
      needsTransport: true,
      needsLodging: null,
      contactPhone: '+51 987 654 321',
      songRequest: 'Vivir mi vida',
      message: '¡Felicidades!',
      respondedAt: '2026-10-21T16:05:00Z',
      people: 2,
    },
    {
      code: 'def567',
      displayName: 'Carla',
      seats: 1,
      side: 'both',
      group: null,
      phone: null,
      email: null,
      notes: 'prima',
      sentAt: null,
      firstOpenedAt: null,
      lastOpenedAt: null,
      openCount: 0,
      attending: null,
      attendsCeremony: null,
      attendsReception: null,
      needsTransport: null,
      needsLodging: null,
      contactPhone: null,
      songRequest: null,
      message: null,
      respondedAt: null,
      people: 0,
    },
  ],
  attendees: [
    {
      code: 'abc234',
      invitation: 'Familia López',
      position: 1,
      fullName: 'Ana López',
      kind: 'adult',
      age: null,
      menu: 'Carne',
      dietary: null,
    },
    {
      code: 'abc234',
      invitation: 'Familia López',
      position: 2,
      fullName: 'Mateo López',
      kind: 'child',
      age: 6,
      menu: 'Infantil',
      dietary: 'Maní',
    },
  ],
};

function load() {
  const spreadsheet = new FakeSpreadsheet();
  const props = new Map<string, string>([
    ['SUPABASE_URL', 'https://demo.supabase.co/'],
    ['SUPABASE_KEY', 'sb_publishable_x'],
    ['SECRET', 's3cret'],
    ['SITE_URL', 'https://example.com/'],
  ]);
  const requests: Array<{ url: string; payload: { p_secret: string; p_hash: string | null } }> = [];
  const responses: Array<{ status: number; body: unknown }> = [];
  const triggers: string[] = [];
  const conditionalRule = () => {
    const rule: Record<string, unknown> = {};
    const builder = {
      whenTextEqualTo: (text: string) => ((rule.text = text), builder),
      setBackground: (color: string) => ((rule.color = color), builder),
      setRanges: () => builder,
      build: () => rule,
    };
    return builder;
  };
  const context: Record<string, unknown> = {
    module: { exports: {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      newConditionalFormatRule: conditionalRule,
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => props.get(key) ?? null,
        setProperty: (key: string, value: string) => props.set(key, value),
        deleteProperty: (key: string) => props.delete(key),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    UrlFetchApp: {
      fetch: (url: string, options: { payload: string }) => {
        requests.push({ url, payload: JSON.parse(options.payload) });
        const next = responses.shift() ?? { status: 200, body: EXPORT };
        return {
          getResponseCode: () => next.status,
          getContentText: () =>
            typeof next.body === 'string' ? next.body : JSON.stringify(next.body),
        };
      },
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((name) => ({ getHandlerFunction: () => name })),
      deleteTrigger: () => triggers.shift(),
      newTrigger: (name: string) => ({
        timeBased: () => ({
          everyMinutes: () => ({ create: () => triggers.push(name) }),
        }),
      }),
    },
  };
  runInNewContext(readFileSync('apps-script/Code.js', 'utf8'), context);
  const script = (context.module as { exports: Record<string, (...args: unknown[]) => unknown> })
    .exports;
  return { script, spreadsheet, props, requests, responses, triggers };
}

describe('Apps Script sync', () => {
  let env: ReturnType<typeof load>;
  beforeEach(() => {
    env = load();
  });

  it('writes invitations, attendees and the summary, then remembers the hash', () => {
    env.script.sync!();

    expect(env.requests[0]).toEqual({
      url: 'https://demo.supabase.co/rest/v1/rpc/export_for_sheet',
      payload: { p_secret: 's3cret', p_hash: null },
    });
    const invitations = env.spreadsheet.getSheetByName('Invitaciones')!.table()!;
    expect(invitations).toHaveLength(3);
    const [header, lopez, carla] = invitations as [string[], Row, Row];
    const cell = (row: Row, name: string) => row[header.indexOf(name)];
    expect(cell(lopez, 'Estado')).toBe('Sí');
    expect(cell(lopez, 'Personas')).toBe(2);
    expect(cell(lopez, 'Lado')).toBe('Novia');
    expect(cell(lopez, 'Transporte')).toBe('Sí');
    expect(cell(lopez, 'Hospedaje')).toBe('');
    expect(cell(lopez, 'Teléfono')).toBe("'987654321");
    expect(cell(lopez, 'Respondió')).toEqual(new Date('2026-10-21T16:05:00Z'));
    expect(cell(lopez, 'Link')).toBe('https://example.com/?i=abc234');
    expect(cell(carla, 'Estado')).toBe('Pendiente');
    expect(cell(carla, 'Enviada')).toBe('');
    expect(cell(carla, 'Teléfono')).toBe('');

    const attendees = env.spreadsheet.getSheetByName('Asistentes')!.table()!;
    expect(attendees.slice(1)).toEqual([
      ['abc234', 'Familia López', 1, 'Ana López', 'Adulto', '', 'Carne', ''],
      ['abc234', 'Familia López', 2, 'Mateo López', 'Niño', 6, 'Infantil', 'Maní'],
    ]);
    expect(env.spreadsheet.getSheetByName('Invitaciones')!.rules).toEqual([
      { text: 'Sí', color: '#d9ead3' },
      { text: 'No', color: '#f4cccc' },
      { text: 'Pendiente', color: '#fff2cc' },
    ]);
    expect(env.props.get('LAST_HASH')).toBe('h1');
  });

  it('sends the last hash and leaves the sheets alone when nothing changed', () => {
    env.script.sync!();
    const before = env.spreadsheet.getSheetByName('Invitaciones')!.writes.length;
    env.responses.push({
      status: 200,
      body: { unchanged: true, hash: 'h1', syncedAt: '2026-10-22T15:05:00Z' },
    });
    env.script.sync!();

    expect(env.requests[1]!.payload.p_hash).toBe('h1');
    expect(env.spreadsheet.getSheetByName('Invitaciones')!.writes).toHaveLength(before);
    const summary = env.spreadsheet.getSheetByName('Resumen')!;
    expect(summary.writes.at(-1)).toEqual({
      at: 'B1',
      values: [[new Date('2026-10-22T15:05:00Z')]],
    });
  });

  it('explains a wrong secret', () => {
    env.responses.push({ status: 400, body: '{"code":"P0001","message":"forbidden"}' });
    expect(() => env.script.sync!()).toThrow('El SECRET no es válido');
    expect(env.props.get('LAST_HASH')).toBeUndefined();
  });

  it('asks for the missing properties', () => {
    env.props.delete('SECRET');
    expect(() => env.script.sync!()).toThrow('Faltan propiedades del script');
  });

  it('setup creates one 5-minute trigger and syncs everything again', () => {
    env.props.set('LAST_HASH', 'old');
    env.script.setup!();
    env.script.setup!();
    expect(env.triggers).toEqual(['sync']);
    expect(env.requests[0]!.payload.p_hash).toBeNull();
  });

  it('summary formulas point at the right columns', () => {
    const rows = env.script.summaryRows!() as Array<[string, string]>;
    const formula = (label: string) => rows.find(([l]) => l === label)![1];
    expect(env.script.column!(['A', 'B'], 'B')).toBe('B');
    expect(formula('Pendientes')).toBe('=COUNTIF(Invitaciones!F2:F,"Pendiente")');
    expect(formula('Personas confirmadas')).toBe('=SUM(Invitaciones!G2:G)');
    expect(formula('Niños')).toBe('=COUNTIF(Asistentes!E2:E,"Niño")');
    expect(formula('Transporte (personas)')).toBe(
      '=SUMIF(Invitaciones!J2:J,"Sí",Invitaciones!G2:G)',
    );
  });
});

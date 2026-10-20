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

interface FakeFile {
  id: string;
  bytes: number[];
  type: string;
  name: string;
}

class FakeFolder {
  folders: FakeFolder[] = [];
  files: FakeFile[] = [];
  trashed = false;
  constructor(
    private drive: FakeDrive,
    readonly id: string,
    readonly name: string,
  ) {}
  getId() {
    return this.id;
  }
  getUrl() {
    return `https://drive.google.com/drive/folders/${this.id}`;
  }
  isTrashed() {
    return this.trashed;
  }
  createFolder(name: string) {
    const folder = this.drive.folder(name);
    this.folders.push(folder);
    return folder;
  }
  createFile(blob: { bytes: number[]; type: string; name: string }) {
    const file = { id: `file${this.drive.next++}xxxxxxxx`, ...blob };
    this.files.push(file);
    return { getId: () => file.id };
  }
}

class FakeDrive {
  next = 1;
  all = new Map<string, FakeFolder>();
  folder(name: string) {
    const folder = new FakeFolder(this, `folder${this.next++}xxxxxx`, name);
    this.all.set(folder.id, folder);
    return folder;
  }
  createFolder(name: string) {
    return this.folder(name);
  }
  getFolderById(id: string) {
    const folder = this.all.get(id);
    if (!folder) throw new Error('No item with the given ID could be found');
    return folder;
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
  const requests: Array<{ url: string; payload: Record<string, unknown> }> = [];
  /** Answers of the other RPCs (album check, register, folder), by name. */
  const rpc = new Map<
    string,
    (payload: Record<string, unknown>) => { status: number; body: unknown }
  >([
    [
      'album_drive_check',
      () => ({ status: 200, body: { code: 'abc234', displayName: 'Familia López', count: 0 } }),
    ],
    ['register_drive_photo', () => ({ status: 200, body: '' })],
    ['google_register_folder', () => ({ status: 200, body: '' })],
  ]);
  const drive = new FakeDrive();
  /** A project at script.google.com (not inside a Sheet). */
  let standalone = false;
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
      getActiveSpreadsheet: () => (standalone ? null : spreadsheet),
      newConditionalFormatRule: conditionalRule,
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => props.get(key) ?? null,
        setProperty: (key: string, value: string) => props.set(key, value),
        deleteProperty: (key: string) => props.delete(key),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }),
    },
    DriveApp: drive,
    Utilities: {
      base64Decode: (data: string) => [...Buffer.from(data, 'base64')],
      newBlob: (bytes: number[], type: string, name: string) => ({ bytes, type, name }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({ text, setMimeType: () => ({ text }) }),
    },
    console: { error: () => {}, log: () => {} },
    UrlFetchApp: {
      fetch: (url: string, options: { payload: string }) => {
        const payload = JSON.parse(options.payload);
        requests.push({ url, payload });
        const name = url.split('/rpc/')[1]!;
        const next =
          name === 'export_for_sheet'
            ? (responses.shift() ?? { status: 200, body: EXPORT })
            : rpc.get(name)!(payload);
        return {
          getResponseCode: () => next.status,
          getContentText: () =>
            typeof next.body === 'string' ? next.body : JSON.stringify(next.body),
        };
      },
    },
    ScriptApp: {
      getProjectTriggers: () =>
        triggers.map((name) => ({ getHandlerFunction: () => name.split(' ')[0] })),
      deleteTrigger: () => triggers.shift(),
      newTrigger: (name: string) => ({
        timeBased: () => ({
          everyMinutes: (minutes: number) => ({
            create: () => triggers.push(`${name} every ${minutes}`),
          }),
        }),
      }),
    },
  };
  runInNewContext(readFileSync('apps-script/Code.js', 'utf8'), context);
  const script = (context.module as { exports: Record<string, (...args: unknown[]) => unknown> })
    .exports;
  const noSpreadsheet = () => {
    standalone = true;
  };
  return { script, spreadsheet, props, requests, responses, triggers, rpc, drive, noSpreadsheet };
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
    expect(cell(lopez, 'Link')).toBe('https://example.com/?abc234');
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
    expect(env.triggers).toEqual(['sync every 10']);
    const exports = env.requests.filter((r) => r.url.endsWith('/export_for_sheet'));
    expect(exports[0]!.payload.p_hash).toBeNull();
    // The Sheet's setup leaves the album alone (it may live in another Google account).
    expect(env.drive.all.size).toBe(0);
    expect(env.requests.some((r) => r.url.endsWith('/google_register_folder'))).toBe(false);
  });

  it('setup explains when the project is not inside a Sheet', () => {
    env.noSpreadsheet();
    expect(() => env.script.setup!()).toThrow('Este proyecto no está dentro de una hoja');
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

describe('Apps Script album (photos to Google Drive)', () => {
  let env: ReturnType<typeof load>;
  beforeEach(() => {
    env = load();
  });

  const photo = Buffer.from('original photo bytes, not recompressed');
  const post = (body: Record<string, unknown>) =>
    JSON.parse(
      (env.script.doPost!({ postData: { contents: JSON.stringify(body) } }) as { text: string })
        .text,
    );
  const upload = (extra: Record<string, unknown> = {}) =>
    post({
      code: 'ABC234',
      name: 'IMG_2041.JPG',
      type: 'image/jpeg',
      data: photo.toString('base64'),
      ...extra,
    });

  it('setupAlbum creates the album folder once and registers its link', () => {
    env.script.setupAlbum!();
    env.script.setupAlbum!();
    const albums = [...env.drive.all.values()].filter((f) => f.name === 'Fotos de la boda');
    expect(albums).toHaveLength(1);
    const registered = env.requests.filter((r) => r.url.endsWith('/google_register_folder'));
    expect(registered.at(-1)!.payload).toEqual({
      p_secret: 's3cret',
      p_folder_url: `https://drive.google.com/drive/folders/${albums[0]!.id}`,
    });
  });

  it('saves the original photo in the guest folder and records it', () => {
    expect(upload()).toEqual({ ok: true });
    expect(upload({ name: 'IMG_2042.JPG' })).toEqual({ ok: true });

    const album = [...env.drive.all.values()].find((f) => f.name === 'Fotos de la boda')!;
    expect(album.folders.map((f) => f.name)).toEqual(['Familia López (abc234)']);
    const files = album.folders[0]!.files;
    expect(files.map((f) => f.name)).toEqual(['IMG_2041.JPG', 'IMG_2042.JPG']);
    expect(Buffer.from(files[0]!.bytes).equals(photo)).toBe(true);
    expect(files[0]!.type).toBe('image/jpeg');

    const calls = env.requests.map((r) => r.url.split('/rpc/')[1]);
    expect(calls).toEqual([
      'album_drive_check',
      'register_drive_photo',
      'album_drive_check',
      'register_drive_photo',
    ]);
    expect(env.requests[0]!.payload).toEqual({ p_secret: 's3cret', p_code: 'abc234' });
    expect(env.requests[1]!.payload).toEqual({
      p_secret: 's3cret',
      p_code: 'abc234',
      p_file_id: files[0]!.id,
      p_name: 'IMG_2041.JPG',
      p_bytes: photo.length,
    });
  });

  it('a deleted guest folder is created again', () => {
    upload();
    const album = [...env.drive.all.values()].find((f) => f.name === 'Fotos de la boda')!;
    album.folders[0]!.trashed = true;
    upload();
    expect(album.folders.filter((f) => !f.trashed)).toHaveLength(1);
  });

  it('passes on the reasons Supabase refuses a photo, and saves nothing', () => {
    env.rpc.set('album_drive_check', () => ({
      status: 400,
      body: { code: 'P0001', message: 'album_closed' },
    }));
    expect(upload()).toEqual({ ok: false, error: 'album_closed' });
    env.rpc.set('album_drive_check', () => ({
      status: 400,
      body: { code: 'P0001', message: 'album_full' },
    }));
    expect(upload()).toEqual({ ok: false, error: 'album_full' });
    const files = [...env.drive.all.values()].flatMap((f) => f.files);
    expect(files).toHaveLength(0);
  });

  it('rejects bad requests before calling Supabase', () => {
    expect(upload({ type: 'application/pdf' })).toEqual({ ok: false, error: 'invalid_payload' });
    expect(upload({ code: '../x' })).toEqual({ ok: false, error: 'invalid_payload' });
    expect(upload({ data: 'A'.repeat(36 * 1024 * 1024) })).toEqual({
      ok: false,
      error: 'too_large',
    });
    expect(env.requests).toHaveLength(0);
  });

  it('answers the connection test and unexpected errors without details', () => {
    expect(JSON.parse((env.script.doGet!() as { text: string }).text)).toEqual({
      ok: true,
      service: 'album',
    });
    env.rpc.set('register_drive_photo', () => ({ status: 500, body: 'boom' }));
    expect(upload()).toEqual({ ok: false, error: 'unknown' });
  });

  it('keeps file names safe for Drive', () => {
    expect(env.script.photoName!('IMG_1.HEIC', 'image/heic')).toBe('IMG_1.HEIC');
    expect(env.script.photoName!('a/b:c?.jpg', 'image/jpeg')).toBe('a_b_c_.jpg');
    expect(env.script.photoName!('', 'image/jpeg')).toMatch(/^foto-.+\.jpg$/);
  });
});

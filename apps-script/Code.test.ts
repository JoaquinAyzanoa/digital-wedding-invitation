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
  getName() {
    return this.name;
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
      dni: '01234567',
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
      dni: null,
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
  const requests: Array<{
    url: string;
    payload: Record<string, unknown>;
    headers?: Record<string, string>;
  }> = [];
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
      fetch: (url: string, options: { payload: string; headers: Record<string, string> }) => {
        const payload = JSON.parse(options.payload);
        requests.push({ url, payload, headers: options.headers });
        if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
          return {
            getResponseCode: () => 200,
            getHeaders: () => ({ Location: `${url}&upload_id=SESSION1` }),
            getContentText: () => '',
          };
        }
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
      getOAuthToken: () => 'owner-token',
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

    expect(env.requests[0]).toMatchObject({
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
      // The DNI stays text (a leading 0 must not be lost).
      ['abc234', 'Familia López', 1, 'Ana López', "'01234567", 'Adulto', '', 'Carne', ''],
      ['abc234', 'Familia López', 2, 'Mateo López', '', 'Niño', 6, 'Infantil', 'Maní'],
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
    expect(formula('Niños')).toBe('=COUNTIF(Asistentes!F2:F,"Niño")');
    expect(formula('Transporte (personas)')).toBe(
      '=SUMIF(Invitaciones!J2:J,"Sí",Invitaciones!G2:G)',
    );
  });
});

describe('Apps Script album (photos to a Google Drive folder)', () => {
  let env: ReturnType<typeof load>;
  let folder: { id: string; files: Array<{ name: string; type: string; bytes: number[] }> };
  beforeEach(() => {
    env = load();
    folder = env.drive.folder('Photos');
    env.props.set('FOLDER_ID', `https://drive.google.com/drive/folders/${folder.id}?usp=sharing`);
  });

  const photo = Buffer.from('original photo bytes, not recompressed');
  const post = (body: Record<string, unknown>) =>
    JSON.parse(
      (env.script.doPost!({ postData: { contents: JSON.stringify(body) } }) as { text: string })
        .text,
    );
  const upload = (extra: Record<string, unknown> = {}) =>
    post({ name: 'IMG_2041.JPG', type: 'image/jpeg', data: photo.toString('base64'), ...extra });

  it('saves the original photo in the FOLDER_ID folder, without asking Supabase', () => {
    expect(upload()).toEqual({ ok: true });
    expect(upload({ name: 'IMG_2042.HEIC', type: 'image/heic' })).toEqual({ ok: true });
    expect(folder.files.map((f) => [f.name, f.type])).toEqual([
      ['IMG_2041.JPG', 'image/jpeg'],
      ['IMG_2042.HEIC', 'image/heic'],
    ]);
    expect(Buffer.from(folder.files[0]!.bytes).equals(photo)).toBe(true);
    expect(env.requests).toHaveLength(0);
  });

  it('accepts the folder id alone too', () => {
    env.props.set('FOLDER_ID', folder.id);
    expect(upload()).toEqual({ ok: true });
    expect(folder.files).toHaveLength(1);
  });

  it('rejects files that are not photos or are too big', () => {
    expect(upload({ type: 'application/pdf' })).toEqual({ ok: false, error: 'invalid_payload' });
    expect(upload({ data: 'A'.repeat(36 * 1024 * 1024) })).toEqual({
      ok: false,
      error: 'too_large',
    });
    expect(folder.files).toHaveLength(0);
  });

  it('answers the connection test with the folder', () => {
    expect(JSON.parse((env.script.doGet!() as { text: string }).text)).toEqual({
      ok: true,
      service: 'album',
      sessions: true,
      folderName: 'Photos',
      folderUrl: `https://drive.google.com/drive/folders/${folder.id}`,
    });
  });

  it('without FOLDER_ID: setupAlbum explains it and uploads fail without details', () => {
    env.props.delete('FOLDER_ID');
    expect(() => env.script.setupAlbum!()).toThrow('Falta la propiedad FOLDER_ID');
    expect(upload()).toEqual({ ok: false, error: 'unknown' });
    expect(JSON.parse((env.script.doGet!() as { text: string }).text).ok).toBe(false);
  });

  it('keeps file names safe for Drive', () => {
    expect(env.script.photoName!('IMG_1.HEIC', 'image/heic')).toBe('IMG_1.HEIC');
    expect(env.script.photoName!('a/b:c?.jpg', 'image/jpeg')).toBe('a_b_c_.jpg');
    expect(env.script.photoName!('', 'image/jpeg')).toMatch(/^foto-.+\.jpg$/);
  });
});

describe('Apps Script album: straight to Drive (upload sessions)', () => {
  let env: ReturnType<typeof load>;
  let folder: { id: string };
  beforeEach(() => {
    env = load();
    folder = env.drive.folder('Photos');
    env.props.set('FOLDER_ID', folder.id);
  });

  const session = (params: Record<string, string>) =>
    JSON.parse(
      (env.script.doGet!({ parameter: { action: 'session', ...params } }) as { text: string }).text,
    );
  const photo = {
    name: 'IMG_1.JPG',
    type: 'image/jpeg',
    size: '4194304',
    origin: 'https://camilayjoaquin.com',
  };

  it('creates a resumable session in the folder for that origin, size and type', () => {
    expect(session(photo)).toEqual({
      ok: true,
      session: expect.stringContaining('upload_id=SESSION1'),
    });
    const [request] = env.requests;
    expect(request!.url).toBe(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
    );
    expect(request!.payload).toEqual({ name: 'IMG_1.JPG', parents: [folder.id] });
    expect(request!.headers).toMatchObject({
      Authorization: 'Bearer owner-token',
      'X-Upload-Content-Type': 'image/jpeg',
      'X-Upload-Content-Length': '4194304',
      // Without the origin, Google would not let the guest's browser use the session.
      Origin: 'https://camilayjoaquin.com',
    });
  });

  it('accepts videos, each kind with its own limit', () => {
    const video = { ...photo, name: 'VID_1.MOV', type: 'video/quicktime' };
    expect(session({ ...video, size: String(900 * 1024 * 1024) }).ok).toBe(true);
    expect(session({ ...video, size: String(1025 * 1024 * 1024) })).toEqual({
      ok: false,
      error: 'too_large',
    });
    expect(session({ ...photo, size: String(51 * 1024 * 1024) })).toEqual({
      ok: false,
      error: 'too_large',
    });
  });

  it('refuses anything else before asking Drive', () => {
    expect(session({ ...photo, type: 'application/pdf' }).error).toBe('invalid_payload');
    expect(session({ ...photo, origin: 'javascript:alert(1)' }).error).toBe('invalid_payload');
    expect(session({ ...photo, size: '0' }).error).toBe('invalid_payload');
    expect(env.requests).toHaveLength(0);
  });

  it('tells the admin test that sessions are available', () => {
    expect(
      JSON.parse((env.script.doGet!({ parameter: {} }) as { text: string }).text),
    ).toMatchObject({
      ok: true,
      sessions: true,
    });
  });
});

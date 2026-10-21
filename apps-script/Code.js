/**
 * Supabase → Google Sheet mirror for the wedding invitation (read only: edit in the admin).
 *
 * Every 10 minutes `sync` asks Supabase for the invitations and attendees and rewrites the
 * "Invitaciones" and "Asistentes" sheets; "Resumen" holds formulas over them. When nothing
 * changed since the last run, Supabase answers with a few bytes and nothing is rewritten.
 * These calls also keep the free Supabase project from pausing for inactivity.
 *
 * Deployed as a web app, the same code receives the guests' album photos (`doPost`) and
 * saves them, at their original quality, in a Google Drive folder (property FOLDER_ID). It
 * does not talk to Supabase: no codes, no limits, anyone with the page can upload (the
 * invitation and the /fotos/ page with the QR on the tables).
 *
 * The Sheet and the photos can live in different Google accounts: the same file goes into
 * two projects (see README.md in this folder).
 *   - Sheet account: Extensions → Apps Script of a Google Sheet, properties SUPABASE_URL,
 *     SUPABASE_KEY, SECRET and SITE_URL, run `setup`.
 *   - Photos account: a new project at script.google.com, property FOLDER_ID (the link of
 *     the Drive folder), run `setupAlbum` and deploy it as a web app.
 *
 * Script properties:
 *   SUPABASE_URL  https://<project>.supabase.co            (Sheet)
 *   SUPABASE_KEY  publishable key (sb_publishable_…)       (Sheet)
 *   SECRET        shown in the admin, Ajustes              (Sheet)
 *   SITE_URL      https://your-domain, for the links       (Sheet)
 *   FOLDER_ID     the Drive folder's link or id            (album)
 */

const SHEET_NAMES = {
  invitations: 'Invitaciones',
  attendees: 'Asistentes',
  summary: 'Resumen',
};

const INVITATION_HEADERS = [
  'Código',
  'Invitación',
  'Pases',
  'Lado',
  'Grupo',
  'Estado',
  'Personas',
  'Ceremonia',
  'Recepción',
  'Transporte',
  'Hospedaje',
  'Canción',
  'Mensaje',
  'Respondió',
  'Teléfono',
  'Teléfono de contacto',
  'Correo',
  'Enviada',
  'Aperturas',
  'Última apertura',
  'Notas',
  'Link',
];

const ATTENDEE_HEADERS = [
  'Código',
  'Invitación',
  'N.º',
  'Nombre',
  'DNI',
  'Tipo',
  'Edad',
  'Menú',
  'Restricciones',
];

const SIDES = { bride: 'Novia', groom: 'Novio', both: 'Ambos' };
const STATUS = { yes: 'Sí', no: 'No', pending: 'Pendiente' };
const DATE_FORMAT = 'dd/mm/yyyy hh:mm';
const SYNC_CELL = 'B1';

/** Runs every 10 minutes (trigger created by `setup`). */
function sync() {
  const lock = LockService.getScriptLock();
  // Another run is still going: this one is not needed.
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const config = readConfig_(props);
    const data = fetchExport_(config, props.getProperty('LAST_HASH'));
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    if (!data.unchanged) {
      writeTable_(
        spreadsheet,
        SHEET_NAMES.invitations,
        INVITATION_HEADERS,
        invitationRows(data.invitations, config.siteUrl),
      );
      writeTable_(
        spreadsheet,
        SHEET_NAMES.attendees,
        ATTENDEE_HEADERS,
        attendeeRows(data.attendees),
      );
      formatInvitations_(spreadsheet.getSheetByName(SHEET_NAMES.invitations));
      writeSummary_(spreadsheet);
      props.setProperty('LAST_HASH', data.hash);
    }
    sheet_(spreadsheet, SHEET_NAMES.summary)
      .getRange(SYNC_CELL)
      .setValue(toDate(data.syncedAt))
      .setNumberFormat(DATE_FORMAT);
  } finally {
    lock.releaseLock();
  }
}

/** The Sheet, run once by hand: Lima time zone, the 10-minute trigger and a first sync. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  readConfig_(props);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      'Este proyecto no está dentro de una hoja: para la hoja usa Extensiones → Apps Script ' +
        'desde la hoja; aquí ejecuta setupAlbum.',
    );
  }
  spreadsheet.setSpreadsheetTimeZone('America/Lima');
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(10).create();
  // Forget the last hash so everything is written again (e.g. after deleting a sheet).
  props.deleteProperty('LAST_HASH');
  sync();
}

/**
 * The album, run once by hand in the project of the account whose Drive keeps the photos:
 * checks the FOLDER_ID folder (and makes Google ask for the Drive permission). Then deploy
 * this project as a web app.
 */
function setupAlbum() {
  const folder = albumFolder_();
  console.log(`Las fotos se guardarán en «${folder.getName()}»: ${folder.getUrl()}`);
}

function readConfig_(props) {
  const config = {
    url: (props.getProperty('SUPABASE_URL') || '').replace(/\/+$/, ''),
    key: props.getProperty('SUPABASE_KEY') || '',
    secret: props.getProperty('SECRET') || '',
    siteUrl: (props.getProperty('SITE_URL') || '').replace(/\/+$/, ''),
  };
  const missing = ['url', 'key', 'secret'].filter((name) => !config[name]);
  if (missing.length) {
    throw new Error(
      'Faltan propiedades del script: SUPABASE_URL, SUPABASE_KEY y SECRET (ver README).',
    );
  }
  return config;
}

function fetchExport_(config, lastHash) {
  const response = UrlFetchApp.fetch(`${config.url}/rest/v1/rpc/export_for_sheet`, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: config.key },
    payload: JSON.stringify({ p_secret: config.secret, p_hash: lastHash || null }),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status !== 200) {
    const message = /forbidden/.test(body)
      ? 'El SECRET no es válido (¿se cambió en el admin?).'
      : `Supabase respondió ${status}: ${body.slice(0, 300)}`;
    throw new Error(message);
  }
  return JSON.parse(body);
}

// ---------------------------------------------------------------------------------------
// Album: the guests' photos, to a Google Drive folder
// ---------------------------------------------------------------------------------------

/** The slower way (the photo through this script, as text) cannot carry more than this. */
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
/** Straight to Drive: original photos (2–10 MB from a phone) and videos (~100 MB a minute). */
const MAX_SESSION_BYTES = { image: 50 * 1024 * 1024, video: 1024 * 1024 * 1024 };

/**
 * Two uses:
 * - `?action=session&name=…&type=…&size=…&origin=…`: a Drive upload session for one photo or
 *   video.
 *   The guest's browser then sends the photo straight to Drive (fast, with real progress);
 *   the account's permission never leaves this script, the session only takes that one file.
 * - Without parameters: the admin's "Probar conexión" (where the photos go).
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    if (params.action === 'session') return reply_(uploadSession_(params));
    const folder = albumFolder_();
    return reply_({
      ok: true,
      service: 'album',
      sessions: true,
      folderName: folder.getName(),
      folderUrl: folder.getUrl(),
    });
  } catch (error) {
    console.error(`Álbum: ${String((error && error.message) || error)}`);
    return reply_({ ok: false, error: 'unknown' });
  }
}

/**
 * Creates the resumable upload session in the folder. Google only lets the browser of
 * `origin` use it (CORS), and only for exactly `size` bytes of `type`. The browser sends the
 * file in parts and can resume after a dropped connection.
 */
function uploadSession_(params) {
  const type = String(params.type || '');
  const size = Number(params.size);
  const origin = String(params.origin || '');
  const kind = (/^(image|video)\/[\w.+-]+$/.exec(type) || [])[1];
  if (!kind || !/^https?:\/\/[\w.-]+(:\d+)?$/.test(origin) || !(size > 0)) {
    return { ok: false, error: 'invalid_payload' };
  }
  if (size > MAX_SESSION_BYTES[kind]) return { ok: false, error: 'too_large' };

  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
    {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
        'X-Upload-Content-Type': type,
        'X-Upload-Content-Length': String(size),
        Origin: origin,
      },
      payload: JSON.stringify({
        name: photoName(params.name, type),
        parents: [albumFolder_().getId()],
      }),
      muteHttpExceptions: true,
    },
  );
  const headers = response.getHeaders();
  const session = headers.Location || headers.location;
  if (response.getResponseCode() !== 200 || !session) {
    throw new Error(
      `Drive ${response.getResponseCode()}: ${response.getContentText().slice(0, 200)}`,
    );
  }
  return { ok: true, session };
}

/**
 * The slower way, kept for pages loaded before sessions existed: a guest's photo as
 * { name, type, data (base64) }, sent as text/plain (no CORS preflight), saved as it is in
 * the folder. Answers { ok: true } or { ok: false, error }.
 */
function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const type = String(request.type || '');
    if (!/^image\/[\w.+-]+$/.test(type) || typeof request.data !== 'string') {
      return reply_({ ok: false, error: 'invalid_payload' });
    }
    if (request.data.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) {
      return reply_({ ok: false, error: 'too_large' });
    }
    const bytes = Utilities.base64Decode(request.data);
    albumFolder_().createFile(Utilities.newBlob(bytes, type, photoName(request.name, type)));
    return reply_({ ok: true });
  } catch (error) {
    console.error(`Subida de foto: ${String((error && error.message) || error)}`);
    return reply_({ ok: false, error: 'unknown' });
  }
}

/** The guest's file name, made safe for Drive ("IMG_2041.HEIC" stays as it is). */
function photoName(name, type) {
  const clean = String(name || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .trim()
    .slice(0, 120);
  if (clean) return clean;
  const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return `foto-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
}

/** The folder in the FOLDER_ID property: its id or its whole link (…/folders/<id>). */
function albumFolder_() {
  const raw = (PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '').trim();
  const id = (/folders\/([\w-]+)/.exec(raw) || [])[1] || raw;
  if (!id) {
    throw new Error('Falta la propiedad FOLDER_ID: el enlace de tu carpeta de Drive (ver README).');
  }
  return DriveApp.getFolderById(id);
}

function reply_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** One row per invitation, in INVITATION_HEADERS order. */
function invitationRows(invitations, siteUrl) {
  return invitations.map((i) => [
    i.code,
    i.displayName,
    i.seats,
    SIDES[i.side] || i.side || '',
    i.group || '',
    i.attending === true ? STATUS.yes : i.attending === false ? STATUS.no : STATUS.pending,
    i.attending ? i.people : 0,
    yesNo(i.attendsCeremony),
    yesNo(i.attendsReception),
    yesNo(i.needsTransport),
    yesNo(i.needsLodging),
    i.songRequest || '',
    i.message || '',
    toDate(i.respondedAt),
    asText(i.phone),
    asText(i.contactPhone),
    i.email || '',
    toDate(i.sentAt),
    i.openCount || 0,
    toDate(i.lastOpenedAt),
    i.notes || '',
    siteUrl ? `${siteUrl}/?${i.code}` : '',
  ]);
}

/** One row per confirmed person, in ATTENDEE_HEADERS order. */
function attendeeRows(attendees) {
  return attendees.map((a) => [
    a.code,
    a.invitation,
    a.position,
    a.fullName,
    asText(a.dni),
    a.kind === 'child' ? 'Niño' : 'Adulto',
    a.age === null || a.age === undefined ? '' : a.age,
    a.menu || '',
    a.dietary || '',
  ]);
}

function yesNo(value) {
  return value === true ? 'Sí' : value === false ? 'No' : '';
}

/** Dates as real dates (the sheet formats and sorts them); empty when missing. */
function toDate(iso) {
  return iso ? new Date(iso) : '';
}

/** Phone numbers stay text: "987654321" must not become a number, "+51…" not a formula. */
function asText(value) {
  return value ? `'${value}` : '';
}

/** Spreadsheet column letter for a header ("Estado" → "F"). */
function column(headers, name) {
  let index = headers.indexOf(name) + 1;
  if (index < 1) throw new Error(`Columna desconocida: ${name}`);
  let letters = '';
  while (index > 0) {
    const rest = (index - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    index = Math.floor((index - 1) / 26);
  }
  return letters;
}

/** The "Resumen" rows: [label, formula]. Formulas use English names and commas. */
function summaryRows() {
  const inv = (name) =>
    `${SHEET_NAMES.invitations}!${column(INVITATION_HEADERS, name)}2:${column(INVITATION_HEADERS, name)}`;
  const att = (name) =>
    `${SHEET_NAMES.attendees}!${column(ATTENDEE_HEADERS, name)}2:${column(ATTENDEE_HEADERS, name)}`;
  return [
    ['Invitaciones', `=COUNTA(${inv('Código')})`],
    ['Pases reservados', `=SUM(${inv('Pases')})`],
    [
      'Respondieron',
      `=COUNTIF(${inv('Estado')},"${STATUS.yes}")+COUNTIF(${inv('Estado')},"${STATUS.no}")`,
    ],
    ['Asisten (invitaciones)', `=COUNTIF(${inv('Estado')},"${STATUS.yes}")`],
    ['No asisten (invitaciones)', `=COUNTIF(${inv('Estado')},"${STATUS.no}")`],
    ['Pendientes', `=COUNTIF(${inv('Estado')},"${STATUS.pending}")`],
    ['Personas confirmadas', `=SUM(${inv('Personas')})`],
    ['Adultos', `=COUNTIF(${att('Tipo')},"Adulto")`],
    ['Niños', `=COUNTIF(${att('Tipo')},"Niño")`],
    ['Transporte (personas)', `=SUMIF(${inv('Transporte')},"Sí",${inv('Personas')})`],
    ['Hospedaje (personas)', `=SUMIF(${inv('Hospedaje')},"Sí",${inv('Personas')})`],
    ['Enviadas', `=COUNTA(${inv('Enviada')})`],
    ['Abiertas', `=COUNTIF(${inv('Aperturas')},">0")`],
  ];
}

function sheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

/** Replaces a sheet's contents with a header row and the rows, in one write. */
function writeTable_(spreadsheet, name, headers, rows) {
  const sheet = sheet_(spreadsheet, name);
  sheet.clearContents();
  const values = [headers, ...rows];
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/** Date columns and the Sí / No / Pendiente colours (rules replaced on every write). */
function formatInvitations_(sheet) {
  for (const name of ['Respondió', 'Enviada', 'Última apertura']) {
    sheet
      .getRange(`${column(INVITATION_HEADERS, name)}2:${column(INVITATION_HEADERS, name)}`)
      .setNumberFormat(DATE_FORMAT);
  }
  const status = sheet.getRange(
    `${column(INVITATION_HEADERS, 'Estado')}2:${column(INVITATION_HEADERS, 'Estado')}`,
  );
  const rule = (text, background) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(text)
      .setBackground(background)
      .setRanges([status])
      .build();
  sheet.setConditionalFormatRules([
    rule(STATUS.yes, '#d9ead3'),
    rule(STATUS.no, '#f4cccc'),
    rule(STATUS.pending, '#fff2cc'),
  ]);
}

function writeSummary_(spreadsheet) {
  const sheet = sheet_(spreadsheet, SHEET_NAMES.summary);
  const rows = summaryRows();
  sheet.getRange('A1').setValue('Última sincronización').setFontWeight('bold');
  sheet.getRange(3, 1, rows.length, 2).setValues(rows);
  // Menus: counted from the attendees (one row per menu option in use). The {braces} make
  // the range an array, whose columns QUERY calls Col1, Col2…
  const menu = `${SHEET_NAMES.attendees}!${column(ATTENDEE_HEADERS, 'Menú')}2:${column(ATTENDEE_HEADERS, 'Menú')}`;
  sheet.getRange('D3').setValue('Menú').setFontWeight('bold');
  sheet.getRange('E3').setValue('Personas').setFontWeight('bold');
  sheet
    .getRange('D4')
    .setFormula(
      `=IFERROR(QUERY({${menu}},"select Col1, count(Col1) where Col1 <> '' group by Col1 label count(Col1) ''",0),"")`,
    );
  sheet.setColumnWidth(1, 200);
}

// For the unit tests (Node). Apps Script ignores it: `module` does not exist there.
if (typeof module !== 'undefined') {
  module.exports = {
    sync,
    setup,
    setupAlbum,
    doGet,
    doPost,
    photoName,
    invitationRows,
    attendeeRows,
    summaryRows,
    column,
    SHEET_NAMES,
  };
}

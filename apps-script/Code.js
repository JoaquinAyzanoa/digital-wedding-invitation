/**
 * Supabase → Google Sheet mirror for the wedding invitation (read only: edit in the admin).
 *
 * Every 5 minutes `sync` asks Supabase for the invitations and attendees and rewrites the
 * "Invitaciones" and "Asistentes" sheets; "Resumen" holds formulas over them. When nothing
 * changed since the last run, Supabase answers with a few bytes and nothing is rewritten.
 * These calls also keep the free Supabase project from pausing for inactivity.
 *
 * Deployed as a web app, the same script receives the guests' album photos (`doPost`) and
 * saves them, at their original quality, in the "Fotos de la boda" folder of this Google
 * Drive, in a subfolder per invitation. Supabase says whether the code exists and the album
 * is open, and keeps the count.
 *
 * Setup (see README.md in this folder): paste this file into Extensions → Apps Script of a
 * new Google Sheet, fill the script properties, run `setup` once and deploy it as a web app.
 *
 * Script properties:
 *   SUPABASE_URL  https://<project>.supabase.co
 *   SUPABASE_KEY  publishable key (sb_publishable_…)
 *   SECRET        shown in the admin, Ajustes → Google Sheet
 *   SITE_URL      https://your-domain (for the personal links)
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
  'Tipo',
  'Edad',
  'Menú',
  'Restricciones',
];

const SIDES = { bride: 'Novia', groom: 'Novio', both: 'Ambos' };
const STATUS = { yes: 'Sí', no: 'No', pending: 'Pendiente' };
const DATE_FORMAT = 'dd/mm/yyyy hh:mm';
const SYNC_CELL = 'B1';

/** Runs every 5 minutes (trigger created by `setup`). */
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

/**
 * Run once by hand: Lima time zone, the 5-minute trigger, the album folder (its link goes to
 * the admin) and a first sync.
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const config = readConfig_(props);
  rpc_(config, 'google_register_folder', { p_folder_url: albumFolder_(props).getUrl() });

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.setSpreadsheetTimeZone('America/Lima');
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(5).create();
  // Forget the last hash so everything is written again (e.g. after deleting a sheet).
  props.deleteProperty('LAST_HASH');
  sync();
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
// Album: the guests' photos, to Google Drive
// ---------------------------------------------------------------------------------------

const ALBUM_FOLDER_NAME = 'Fotos de la boda';
/** Original photos from phones weigh 2–10 MB; this leaves room and stays within the limits. */
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const UPLOAD_ERRORS = [
  'invitation_not_found',
  'album_closed',
  'album_full',
  'invalid_payload',
  'too_large',
  'forbidden',
];

/** The admin's "Probar conexión": the web app answers. */
function doGet() {
  return reply_({ ok: true, service: 'album' });
}

/**
 * A guest's photo: { code, name, type, data (base64) }, sent as text/plain (no CORS
 * preflight). Answers { ok: true } or { ok: false, error }.
 */
function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const code = String(request.code || '')
      .trim()
      .toLowerCase();
    const type = String(request.type || '');
    if (
      !/^[a-z2-9]{4,8}$/.test(code) ||
      !/^image\/[\w.+-]+$/.test(type) ||
      typeof request.data !== 'string'
    ) {
      return reply_({ ok: false, error: 'invalid_payload' });
    }
    if (request.data.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) {
      return reply_({ ok: false, error: 'too_large' });
    }

    const props = PropertiesService.getScriptProperties();
    const config = readConfig_(props);
    const guest = rpc_(config, 'album_drive_check', { p_code: code });
    const bytes = Utilities.base64Decode(request.data);
    const name = photoName(request.name, type);
    const file = guestFolder_(props, guest).createFile(Utilities.newBlob(bytes, type, name));
    rpc_(config, 'register_drive_photo', {
      p_code: code,
      p_file_id: file.getId(),
      p_name: name,
      p_bytes: bytes.length,
    });
    return reply_({ ok: true });
  } catch (error) {
    const message = String((error && error.message) || error);
    if (!UPLOAD_ERRORS.includes(message)) console.error(`Subida de foto: ${message}`);
    return reply_({ ok: false, error: UPLOAD_ERRORS.includes(message) ? message : 'unknown' });
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

/** Calls a Supabase RPC with the secret; the database's error code becomes the message. */
function rpc_(config, name, params) {
  const response = UrlFetchApp.fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: config.key },
    payload: JSON.stringify(Object.assign({ p_secret: config.secret }, params)),
    muteHttpExceptions: true,
  });
  const body = response.getContentText();
  if (response.getResponseCode() !== 200) {
    let message = body.slice(0, 300);
    try {
      message = JSON.parse(body).message || message;
    } catch {
      // not JSON: keep the text
    }
    throw new Error(message);
  }
  return body ? JSON.parse(body) : null;
}

/** "Fotos de la boda" in My Drive, created once (its id is kept in the properties). */
function albumFolder_(props) {
  const id = props.getProperty('ALBUM_FOLDER_ID');
  if (id) {
    try {
      const folder = DriveApp.getFolderById(id);
      if (!folder.isTrashed()) return folder;
    } catch {
      // deleted: create it again
    }
  }
  const folder = DriveApp.createFolder(ALBUM_FOLDER_NAME);
  props.setProperty('ALBUM_FOLDER_ID', folder.getId());
  return folder;
}

/** "Familia López (abc234)" inside the album folder. Locked: two photos at once, one folder. */
function guestFolder_(props, guest) {
  const key = `FOLDER_${guest.code}`;
  const find = () => {
    const id = props.getProperty(key);
    if (!id) return null;
    try {
      const folder = DriveApp.getFolderById(id);
      return folder.isTrashed() ? null : folder;
    } catch {
      return null;
    }
  };
  const existing = find();
  if (existing) return existing;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const again = find();
    if (again) return again;
    const folder = albumFolder_(props).createFolder(`${guest.displayName} (${guest.code})`);
    props.setProperty(key, folder.getId());
    return folder;
  } finally {
    lock.releaseLock();
  }
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
    siteUrl ? `${siteUrl}/?i=${i.code}` : '',
  ]);
}

/** One row per confirmed person, in ATTENDEE_HEADERS order. */
function attendeeRows(attendees) {
  return attendees.map((a) => [
    a.code,
    a.invitation,
    a.position,
    a.fullName,
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

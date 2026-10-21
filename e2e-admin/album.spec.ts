import { expect, test, type Page, type Route } from '@playwright/test';
import { PNG } from 'pngjs';

const ADMIN = { email: 'admin@example.com', password: 'admin123456' };
const WEB_APP = 'https://script.google.com/macros/s/TEST_album-1/exec';
const FOLDER = 'https://drive.google.com/drive/folders/1PhotosFolder_abc';
const DRIVE = 'https://www.googleapis.com/upload/drive/v3/files';

/** A 1600×1200 photo-like PNG (a gradient that differs per photo). */
function photo(index: number) {
  const png = new PNG({ width: 1600, height: 1200 });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2;
      png.data[i] = (x / 7 + index * 12) % 256;
      png.data[i + 1] = (y / 5 + index * 30) % 256;
      png.data[i + 2] = ((x + y) / 11) % 256;
      png.data[i + 3] = 255;
    }
  }
  return { name: `IMG_${1000 + index}.PNG`, mimeType: 'image/png', buffer: PNG.sync.write(png) };
}

async function login(page: Page) {
  await page.goto('/login/');
  await page.getByLabel('Correo').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
}

const cors = { 'Access-Control-Allow-Origin': '*' };

type Received = Array<{ name: string; type: string; bytes: Buffer }>;

/**
 * Stands in for the Apps Script web app and Drive: the script hands out an upload session
 * and Drive's session takes the file in parts (308 with what it has, 200 at the end).
 */
async function fakeWebApp(page: Page, received: Received) {
  const sessions = new Map<string, { name: string; type: string; size: number; parts: Buffer[] }>();
  await page.route(`${WEB_APP}*`, (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') !== 'session') {
      return route.fulfill({
        headers: cors,
        json: {
          ok: true,
          service: 'album',
          sessions: true,
          folderName: 'Photos',
          folderUrl: FOLDER,
        },
      });
    }
    const id = String(sessions.size + 1);
    sessions.set(id, {
      name: url.searchParams.get('name')!,
      type: url.searchParams.get('type')!,
      size: Number(url.searchParams.get('size')),
      parts: [],
    });
    expect(url.searchParams.get('origin')).toBe(new URL(page.url()).origin);
    return route.fulfill({
      headers: cors,
      json: { ok: true, session: `${DRIVE}?upload_id=${id}` },
    });
  });
  await page.route(`${DRIVE}*`, (route) => {
    const request = route.request();
    const session = sessions.get(new URL(request.url()).searchParams.get('upload_id')!)!;
    const body = request.postDataBuffer();
    if (body) session.parts.push(body);
    const have = session.parts.reduce((n, part) => n + part.length, 0);
    if (have < session.size) {
      return route.fulfill({
        status: 308,
        headers: {
          ...cors,
          'Access-Control-Expose-Headers': 'Range',
          Range: `bytes=0-${have - 1}`,
        },
      });
    }
    received.push({ name: session.name, type: session.type, bytes: Buffer.concat(session.parts) });
    return route.fulfill({ status: 200, headers: cors, json: { id: `file${received.length}` } });
  });
}

/** An Apps Script web app from before sessions: photos come through it, as base64. */
function oldWebApp(received: Received) {
  return async (route: Route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({
        headers: cors,
        json: { ok: true, service: 'album', folderUrl: FOLDER },
      });
    }
    expect(request.headers()['content-type']).toContain('text/plain');
    const body = JSON.parse(request.postData()!) as Record<string, string>;
    received.push({ name: body.name!, type: body.type!, bytes: Buffer.from(body.data!, 'base64') });
    return route.fulfill({ headers: cors, json: { ok: true } });
  };
}

test.describe.configure({ mode: 'serial' });

test('the admin connects the album and gets the QR for the tables', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Álbum' }).click();
  await expect(page.getByText(/El álbum aún no está conectado/)).toBeVisible();

  await page.getByRole('link', { name: 'Contenido', exact: true }).click();
  await page.getByText('Álbum y despedida').click();
  await page.getByLabel('URL de la aplicación web (Google Drive)').fill('https://example.com/exec');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(/La URL de la aplicación web: https/)).toBeVisible();

  await fakeWebApp(page, []);
  await page.getByLabel('URL de la aplicación web (Google Drive)').fill(WEB_APP);
  await page.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.getByText(/Conexión correcta: el script responde/)).toBeVisible();
  await expect(page.getByLabel('Enlace de la carpeta de Drive')).toHaveValue(FOLDER);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Todo guardado')).toBeVisible();

  await page.getByRole('link', { name: 'Álbum' }).click();
  await expect(page.getByText(/El álbum aún no está conectado/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir en Google Drive' })).toHaveAttribute(
    'href',
    FOLDER,
  );
  const qr = page.getByRole('img', { name: /Código QR de .*\/fotos\/$/ });
  await expect(qr).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar QR (PNG)' }).click();
  expect((await downloading).suggestedFilename()).toBe('qr-fotos-boda.png');

  await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByText(/^Álbum conectado/)).toBeVisible();
});

test('anyone uploads from /fotos/ (the QR), at original quality', async ({ page }) => {
  test.setTimeout(120_000);
  const received: Received = [];
  await fakeWebApp(page, received);
  await page.goto('/fotos/');
  await expect(page.getByRole('heading', { name: 'Comparte tus fotos y videos' })).toBeVisible();

  const photos = Array.from({ length: 20 }, (_, i) => photo(i));
  await page.locator('input[type="file"]').setInputFiles(photos);
  await expect(page.getByText('¡Gracias! Subiste 20 fotos.')).toBeVisible({ timeout: 90_000 });

  // Byte for byte what the guest picked: nothing recompressed, no code, no name.
  expect(received).toHaveLength(20);
  for (const original of photos) {
    const got = received.find((r) => r.name === original.name)!;
    expect(got.type).toBe('image/png');
    expect(got.bytes.equals(original.buffer)).toBe(true);
  }
});

test('guests can also upload from their invitation', async ({ page }) => {
  const received: Received = [];
  await fakeWebApp(page, received);
  await page.goto('/?abc234');
  await page.getByRole('button', { name: 'Abrir la invitación' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 });
  await page
    .getByRole('button', { name: 'Clic para subir fotos y videos' })
    .scrollIntoViewIfNeeded();
  await page.locator('input[type="file"]').setInputFiles([photo(50)]);
  await expect(page.getByText('¡Gracias! Subiste 1 foto.')).toBeVisible({ timeout: 30_000 });
  expect(received).toHaveLength(1);
});

test('a video goes up in parts, straight to Drive', async ({ page }) => {
  test.setTimeout(120_000);
  const received: Received = [];
  await fakeWebApp(page, received);
  await page.goto('/fotos/');
  // 20 MB: three parts of 8 MB.
  const video = Buffer.alloc(20 * 1024 * 1024 + 99, 7);
  await page
    .locator('input[type="file"]')
    .setInputFiles([{ name: 'VID_0001.MP4', mimeType: 'video/mp4', buffer: video }]);
  await expect(page.getByText('¡Gracias! Subiste 1 video.')).toBeVisible({ timeout: 60_000 });
  expect(received).toHaveLength(1);
  expect(received[0]!.type).toBe('video/mp4');
  expect(received[0]!.bytes.equals(video)).toBe(true);
});

test('with a script from before sessions, photos still go up (the older way)', async ({ page }) => {
  const received: Received = [];
  await page.route(`${WEB_APP}*`, oldWebApp(received));
  await page.goto('/fotos/');
  await page.locator('input[type="file"]').setInputFiles([photo(7)]);
  await expect(page.getByText('¡Gracias! Subiste 1 foto.')).toBeVisible({ timeout: 30_000 });
  expect(received[0]!.bytes.equals(photo(7).buffer)).toBe(true);
});

test('a refused photo is reported and not retried', async ({ page }) => {
  await page.route(`${WEB_APP}*`, (route) =>
    route.fulfill({ headers: cors, json: { ok: false, error: 'too_large' } }),
  );
  await page.goto('/fotos/');
  await page.locator('input[type="file"]').setInputFiles([photo(99)]);
  await expect(page.getByText('Pesa demasiado para el álbum.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
});

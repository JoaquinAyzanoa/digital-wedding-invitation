import { expect, test, type Page, type Route } from '@playwright/test';
import { PNG } from 'pngjs';

const ADMIN = { email: 'admin@example.com', password: 'admin123456' };
const WEB_APP = 'https://script.google.com/macros/s/TEST_album-1/exec';
const FOLDER = 'https://drive.google.com/drive/folders/1PhotosFolder_abc';

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

/** Stands in for the Apps Script web app: no Supabase, just "saves" what arrives. */
function fakeWebApp(received: Array<{ name: string; type: string; bytes: Buffer }>) {
  return async (route: Route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({
        headers: cors,
        json: { ok: true, service: 'album', folderName: 'Photos', folderUrl: FOLDER },
      });
    }
    expect(request.headers()['content-type']).toContain('text/plain');
    const body = JSON.parse(request.postData()!) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(['data', 'name', 'type']);
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

  await page.route(WEB_APP, fakeWebApp([]));
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
  const qr = page.getByRole('img', { name: /Código QR de .*\/photos\/$/ });
  await expect(qr).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar QR (PNG)' }).click();
  expect((await downloading).suggestedFilename()).toBe('qr-fotos-boda.png');

  await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByText(/^Álbum conectado/)).toBeVisible();
});

test('anyone uploads from /photos/ (the QR), at original quality', async ({ page }) => {
  test.setTimeout(120_000);
  const received: Array<{ name: string; type: string; bytes: Buffer }> = [];
  await page.route(WEB_APP, fakeWebApp(received));
  await page.goto('/photos/');
  await expect(page.getByRole('heading', { name: 'Comparte tus fotos' })).toBeVisible();

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
  const received: Array<{ name: string; type: string; bytes: Buffer }> = [];
  await page.route(WEB_APP, fakeWebApp(received));
  await page.goto('/?abc234');
  await page.getByRole('button', { name: 'Abrir la invitación' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 });
  await page.getByRole('button', { name: 'Clic para subir fotos' }).scrollIntoViewIfNeeded();
  await page.locator('input[type="file"]').setInputFiles([photo(50)]);
  await expect(page.getByText('¡Gracias! Subiste 1 foto.')).toBeVisible({ timeout: 30_000 });
  expect(received).toHaveLength(1);
});

test('a refused photo is reported and not retried', async ({ page }) => {
  await page.route(WEB_APP, (route) =>
    route.fulfill({ headers: cors, json: { ok: false, error: 'too_large' } }),
  );
  await page.goto('/photos/');
  await page.locator('input[type="file"]').setInputFiles([photo(99)]);
  await expect(page.getByText('Pesa más de 25 MB.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
});

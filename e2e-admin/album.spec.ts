import { expect, test, type Page, type Route } from '@playwright/test';
import { PNG } from 'pngjs';

const ADMIN = { email: 'admin@example.com', password: 'admin123456' };
// Seeded invitation not used by the other specs.
const GUEST = { code: 'pqr678', name: 'Diego Salas' };
const WEB_APP = 'https://script.google.com/macros/s/TEST_album-1/exec';
const FOLDER = 'https://drive.google.com/drive/folders/1TestFolder_abc';

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

/** What the Apps Script calls in Supabase (with the secret from Ajustes). */
async function rpc(name: string, params: Record<string, unknown>) {
  const response = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: process.env.E2E_SUPABASE_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: secret, ...params }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error((JSON.parse(text) as { message: string }).message);
  return text ? JSON.parse(text) : null;
}

const cors = { 'Access-Control-Allow-Origin': '*' };

/** Stands in for the Apps Script web app: checks, "saves" and records each photo. */
function fakeWebApp(received: Array<{ name: string; type: string; bytes: Buffer }>) {
  return async (route: Route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({ headers: cors, json: { ok: true, service: 'album' } });
    }
    const body = JSON.parse(request.postData()!) as Record<string, string>;
    expect(request.headers()['content-type']).toContain('text/plain');
    try {
      await rpc('album_drive_check', { p_code: body.code });
      const id = `drive_${received.length}_${body.name.replace(/\W/g, '')}`;
      received.push({ name: body.name, type: body.type, bytes: Buffer.from(body.data!, 'base64') });
      await rpc('register_drive_photo', {
        p_code: body.code,
        p_file_id: id,
        p_name: body.name,
        p_bytes: Buffer.from(body.data!, 'base64').length,
      });
      return route.fulfill({ headers: cors, json: { ok: true } });
    } catch (error) {
      return route.fulfill({ headers: cors, json: { ok: false, error: (error as Error).message } });
    }
  };
}

let secret = '';

test.describe.configure({ mode: 'serial' });

test('the admin connects the album web app', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Álbum' }).click();
  await expect(page.getByText(/El álbum aún no está conectado/)).toBeVisible();

  await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByText(/^Álbum sin conectar/)).toBeVisible();
  const secretBox = page.locator('div', { has: page.getByText('SECRET', { exact: true }) }).last();
  await secretBox.getByRole('button', { name: 'Mostrar' }).click();
  secret = (await secretBox.locator('code').textContent())!;

  const url = page.getByLabel('URL de la aplicación web');
  await url.fill('https://example.com/exec');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(/Pega la URL de la aplicación web/)).toBeVisible();
  await url.fill(WEB_APP);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Álbum conectado', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Álbum conectado: las fotos van a tu Google Drive/)).toBeVisible();

  await page.route(WEB_APP, fakeWebApp([]));
  await page.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.getByText('Conexión correcta: el script responde')).toBeVisible();
});

test('a guest uploads 20 photos at their original quality', async ({ page }) => {
  test.setTimeout(120_000);
  const received: Array<{ name: string; type: string; bytes: Buffer }> = [];
  await page.route(WEB_APP, fakeWebApp(received));
  await page.goto(`/?i=${GUEST.code}`);
  await page.getByRole('button', { name: 'Abrir la invitación' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 });

  await page.getByRole('button', { name: 'Clic para subir fotos' }).scrollIntoViewIfNeeded();
  const photos = Array.from({ length: 20 }, (_, i) => photo(i));
  await page.locator('input[type="file"]').setInputFiles(photos);
  await expect(page.getByText(/Subiendo fotos: \d+ de 20 listas/)).toBeVisible();
  await expect(page.getByText('¡Gracias! Subiste 20 fotos.')).toBeVisible({ timeout: 90_000 });

  // Byte for byte what the guest picked: nothing recompressed.
  expect(received).toHaveLength(20);
  for (const original of photos) {
    const got = received.find((r) => r.name === original.name)!;
    expect(got.type).toBe('image/png');
    expect(got.bytes.equals(original.buffer)).toBe(true);
  }
});

test('the admin sees what arrived and opens the Drive folder', async ({ page }) => {
  await rpc('google_register_folder', { p_folder_url: FOLDER });
  await login(page);
  await page.getByRole('link', { name: 'Álbum' }).click();
  await expect(page.getByRole('heading', { name: 'Álbum (20)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /20 fotos de 1 invitado/ })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${GUEST.name} 20`) })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir en Google Drive' })).toHaveAttribute(
    'href',
    FOLDER,
  );
  await expect(page.getByText(/El álbum aún no está conectado/)).toHaveCount(0);
});

test('a closed album tells the guest and does not retry', async ({ page }) => {
  await page.route(WEB_APP, (route) =>
    route.fulfill({ headers: cors, json: { ok: false, error: 'album_closed' } }),
  );
  await page.goto('/?i=abc234');
  await page.getByRole('button', { name: 'Abrir la invitación' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 });
  await page.getByRole('button', { name: 'Clic para subir fotos' }).scrollIntoViewIfNeeded();
  await page.locator('input[type="file"]').setInputFiles([photo(99)]);
  await expect(page.getByText('El álbum ya no recibe fotos.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
});

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { PNG } from 'pngjs';

const ADMIN = { email: 'admin@example.com', password: 'admin123456' };
// Seeded invitation not used by the other specs.
const GUEST = { code: 'pqr678', name: 'Diego Salas', folder: 'Diego-Salas' };

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
  return { name: `IMG_${1000 + index}.png`, mimeType: 'image/png', buffer: PNG.sync.write(png) };
}

async function login(page: Page) {
  await page.goto('/login/');
  await page.getByLabel('Correo').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
}

/** Files left in the guest's album folder (with the service key, like the admin can). */
async function storageFiles(prefix: string) {
  const response = await fetch(`${process.env.E2E_SUPABASE_URL}/storage/v1/object/list/album`, {
    method: 'POST',
    headers: {
      apikey: process.env.E2E_SUPABASE_SECRET!,
      Authorization: `Bearer ${process.env.E2E_SUPABASE_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  return ((await response.json()) as Array<{ name: string }>).map((f) => f.name);
}

test.describe.configure({ mode: 'serial' });

test('a guest uploads 20 photos from the phone', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/?i=${GUEST.code}`);
  await page.getByRole('button', { name: 'Abrir la invitación' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 });

  const button = page.getByRole('button', { name: 'Clic para subir fotos' });
  await button.scrollIntoViewIfNeeded();
  await page
    .locator('input[type="file"]')
    .setInputFiles(Array.from({ length: 20 }, (_, i) => photo(i)));
  await expect(page.getByText(/Subiendo fotos: \d+ de 20 listas/)).toBeVisible();
  await expect(page.getByText('¡Gracias! Subiste 20 fotos.')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('button', { name: 'Subir más fotos' })).toBeVisible();

  // Photo and thumbnail, compressed in the browser.
  const files = await storageFiles(`${GUEST.code}/`);
  expect(files).toHaveLength(40);
  expect(files.filter((f) => f.includes('.thumb.'))).toHaveLength(20);
});

test('the admin reviews, hides, deletes and downloads the photos', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.getByRole('link', { name: 'Álbum' }).click();
  await expect(page.getByRole('heading', { name: 'Álbum (20)' })).toBeVisible();
  await expect(page.getByText('20 fotos de 1 invitado')).toBeVisible();
  await expect(page.getByText(/^Espacio usado/)).toBeVisible();

  const thumbs = page.getByRole('button', { name: `Ver foto de ${GUEST.name}` });
  await expect(thumbs).toHaveCount(20);
  // Thumbnails load from signed URLs of the private bucket.
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'Fotos del álbum' })
        .locator('img')
        .evaluateAll(
          (imgs) => imgs.filter((img) => (img as HTMLImageElement).naturalWidth > 0).length,
        ),
    )
    .toBe(20);

  // Hide the first photo: it stays, out of the downloads.
  await thumbs.first().click();
  const viewer = page.getByRole('dialog', { name: new RegExp(GUEST.name) });
  await expect(viewer.getByRole('img')).toBeVisible();
  await expect
    .poll(() => viewer.getByRole('img').evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(1000);
  await viewer.getByRole('button', { name: 'Ocultar' }).click();
  await expect(page.getByText('Foto oculta')).toBeVisible();

  // Delete the second one.
  await viewer.getByRole('button', { name: 'Siguiente ›' }).click();
  await expect(viewer.getByText('2 de 20')).toBeVisible();
  await viewer.getByRole('button', { name: 'Eliminar' }).click();
  await page
    .getByRole('dialog', { name: '¿Eliminar esta foto?' })
    .getByRole('button', { name: 'Eliminar' })
    .click();
  await expect(page.getByText('Foto eliminada')).toBeVisible();
  await viewer.getByRole('button', { name: 'Cerrar' }).click();

  await expect(page.getByRole('heading', { name: 'Álbum (19)' })).toBeVisible();
  await page.getByLabel('Mostrar').selectOption('hidden');
  await expect(
    page.getByRole('button', { name: `Ver foto de ${GUEST.name} (oculta)` }),
  ).toHaveCount(1);
  await page.getByLabel('Mostrar').selectOption('all');

  // The ZIP has every photo except the hidden one, in a folder per guest.
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar 18 (ZIP)' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^album-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(page.getByText('Listo: 18 fotos en el ZIP.')).toBeVisible();
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  const names = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir);
  expect(names).toHaveLength(18);
  expect(
    names.every((n) =>
      new RegExp(`^${GUEST.folder}/\\d{4}-\\d{2}-\\d{2}_\\d{4}_[0-9a-f]{6}\\.(webp|jpg)$`).test(n),
    ),
  ).toBe(true);
  expect(await storageFiles(`${GUEST.code}/`)).toHaveLength(38);
});

test('deleting the invitation deletes its photos too', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Invitados' }).click();
  await page.getByRole('button', { name: `Editar ${GUEST.name}` }).click();
  await page
    .getByRole('dialog', { name: GUEST.name })
    .getByRole('button', { name: 'Eliminar' })
    .click();
  await page
    .getByRole('dialog', { name: /¿Eliminar/ })
    .getByRole('button', { name: 'Eliminar' })
    .click();
  await expect(page.getByText('Invitación eliminada')).toBeVisible();

  await page.getByRole('link', { name: 'Álbum' }).click();
  await expect(page.getByText('Todavía no hay fotos.', { exact: false })).toBeVisible();
  expect(await storageFiles(`${GUEST.code}/`)).toHaveLength(0);
});

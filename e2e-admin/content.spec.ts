import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@example.com', password: 'admin123456' };
// 1×1 PNG: enough to go through compression and upload.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function login(page: Page) {
  await page.goto('/login/');
  await page.getByLabel('Correo').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
}

async function openContent(page: Page) {
  await page.getByRole('link', { name: 'Contenido' }).click();
  await expect(page.getByRole('heading', { name: 'Contenido' })).toBeVisible();
}

/** The editor's collapsible sections (their names also appear inside dropdowns). */
function group(page: Page, name: string) {
  return page.locator('summary', { hasText: name });
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Cambios guardados');
  await expect(page.getByText('Todo guardado')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('edits texts and a photo, and the invitation shows them', async ({ page, browser }) => {
  await login(page);
  await openContent(page);
  await expect(page.getByText('Todo guardado')).toBeVisible();

  await page.getByLabel('Novia', { exact: true }).fill('Camila');
  await page.getByLabel('Novio', { exact: true }).fill('Joaquín');
  await expect(page.getByText('Cambios sin guardar')).toBeVisible();

  await group(page, 'Secciones y títulos').click();
  await page.getByLabel('Título: Itinerario').fill('Nuestro día');

  await group(page, 'Fotos y flores').click();
  await page
    .getByLabel(/^Principal \(después de la bienvenida\): subir archivo$/)
    .setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('img[src*="/photos/"]')).toHaveCount(1, { timeout: 20_000 });
  await save(page);

  const guest = await browser.newPage();
  await guest.goto('/?i=abc234');
  await expect(guest).toHaveTitle('Camila & Joaquín · Nuestra boda');
  await guest.getByRole('button', { name: 'Abrir la invitación' }).click();
  await expect(guest.getByRole('heading', { name: 'Nuestro día' })).toBeAttached();
  await expect(guest.locator('main img[srcset*="-1000.webp"]')).toBeAttached();
  await guest.close();
});

test('the pre-wedding video plays behind the envelope', async ({ page, browser }) => {
  await login(page);
  await openContent(page);
  await group(page, 'Fotos y flores').click();
  // Not a real video: the poster frame is skipped and the video still goes up.
  await page
    .getByLabel('Video de fondo del sobre: subir archivo')
    .setInputFiles({ name: 'preboda.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(2048, 1) });
  await expect(page.getByLabel('Vista previa del video')).toHaveAttribute(
    'src',
    /\/videos\/[\w-]+\.mp4$/,
    { timeout: 20_000 },
  );
  await save(page);

  const guest = await browser.newPage();
  await guest.goto('/?abc234');
  const envelope = guest.getByRole('dialog');
  const video = envelope.locator('video');
  await expect(video).toHaveAttribute('src', /\/videos\/[\w-]+\.mp4$/);
  await expect(video).toHaveAttribute('poster', /\/videos\/[\w-]+-poster\.jpg$/);
  await expect(envelope.getByText('Te invitamos a nuestra boda')).toBeVisible();
  await expect(envelope.getByText('Segundos')).toBeVisible();
  await guest.close();

  // Without it, the envelope is back to its flowers.
  await page
    .getByLabel('Vista previa del video')
    .locator('xpath=..')
    .getByRole('button', { name: 'Quitar' })
    .click();
  await save(page);
  const again = await browser.newPage();
  await again.goto('/?abc234');
  await expect(again.getByRole('dialog').getByText('¡Nos casamos!')).toBeVisible();
  await expect(again.locator('video')).toHaveCount(0);
  await again.close();
});

test('an invalid field opens its section and is focused', async ({ page }) => {
  await login(page);
  await openContent(page);
  await group(page, 'Ceremonia y recepción').click();
  await page.getByLabel('Lugar').first().fill('');
  // Close the section again: saving must reopen it.
  await group(page, 'Ceremonia y recepción').click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Revisa los campos marcados');
  await expect(page.getByLabel('Lugar').first()).toBeFocused();
});

test('two editors at once: the second save is told to reload', async ({ page, browser }) => {
  await login(page);
  await openContent(page);
  const other = await browser.newPage({ viewport: page.viewportSize()! });
  await login(other);
  await openContent(other);

  await page.getByLabel('Monograma').fill('C · J');
  await save(page);

  await other.getByLabel('Monograma').fill('CJ');
  await other.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(other.getByRole('alert')).toContainText('Alguien guardó cambios');
  await other.getByRole('button', { name: /Recargar/ }).click();
  await expect(other.getByLabel('Monograma')).toHaveValue('C · J');
  await other.close();
});

test('changes the theme, previews it and restores the defaults', async ({ page, browser }) => {
  await login(page);
  await page.getByRole('link', { name: 'Diseño' }).click();
  await expect(page.getByRole('heading', { name: 'Diseño' })).toBeVisible();

  await page.getByLabel('Principal', { exact: true }).fill('#8A3B5C');
  // Each calligraphy is a card written in its own font.
  await expect(page.getByRole('radio', { name: 'Mea Culpa' })).toBeChecked();
  await page.getByText('Great Vibes', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Great Vibes' })).toBeChecked();
  // On phones the preview opens in a panel.
  await page.getByRole('button', { name: 'Vista previa' }).click();
  const preview = page.frameLocator('iframe[title="Vista previa de la invitación"]').last();
  await expect
    .poll(async () =>
      preview
        .locator('html')
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--color-primary')),
    )
    .toBe('#8A3B5C');
  await expect
    .poll(async () =>
      preview
        .locator('html')
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--font-script')),
    )
    .toContain('Great Vibes');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await save(page);

  const guest = await browser.newPage();
  await guest.goto('/?i=abc234');
  await expect
    .poll(() =>
      guest.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-primary'),
      ),
    )
    .toBe('#8A3B5C');
  await guest.close();

  await page.getByRole('button', { name: 'Restaurar valores por defecto' }).click();
  await expect(page.getByLabel('Principal', { exact: true })).toHaveValue('#4F6496');
  await expect(page.getByRole('radio', { name: 'Mea Culpa' })).toBeChecked();
  await save(page);
});

test('leaving with unsaved changes asks first', async ({ page }) => {
  await login(page);
  await openContent(page);
  await page.getByLabel('Monograma').fill('X&Y');
  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('link', { name: 'Invitados' }).click();
  await expect(page.getByRole('heading', { name: 'Contenido' })).toBeVisible();
});

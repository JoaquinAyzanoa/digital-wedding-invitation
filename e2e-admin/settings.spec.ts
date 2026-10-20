import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@example.com', password: 'admin123456' };

async function login(page: Page) {
  await page.goto('/login/');
  await page.getByLabel('Correo').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
}

/** What the Apps Script does every 10 minutes. */
function exportForSheet(secret: string) {
  return fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/rpc/export_for_sheet`, {
    method: 'POST',
    headers: { apikey: process.env.E2E_SUPABASE_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: secret }),
  });
}

test('connects the Google Sheet: values to paste, status and a new secret', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page);
  await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Google: hoja y álbum/ })).toBeVisible();
  await expect(page.getByText('Hoja: aún no se sincroniza.', { exact: false })).toBeVisible();

  // The script's code, copied for pasting into Apps Script.
  await page.getByRole('button', { name: 'Copiar código del script' }).first().click();
  await expect(page.getByText('Código del script copiado')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('function sync()');

  // The secret is hidden until asked for.
  const secretBox = page.locator('div', { has: page.getByText('SECRET', { exact: true }) }).last();
  await expect(secretBox.getByText('•'.repeat(12))).toBeVisible();
  await secretBox.getByRole('button', { name: 'Mostrar' }).click();
  const secret = (await secretBox.locator('code').textContent())!;
  expect(secret).toMatch(/^[0-9a-f]{64}$/);

  // A sync makes the status green.
  expect((await exportForSheet(secret)).status).toBe(200);
  await page.reload();
  await expect(page.getByText(/^Hoja funcionando/)).toBeVisible();

  // A new secret: the old one stops working.
  await page.getByRole('button', { name: 'Cambiar secreto' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cambiar' }).click();
  await expect(page.getByText('Secreto cambiado: actualiza SECRET en los scripts')).toBeVisible();
  await secretBox.getByRole('button', { name: 'Mostrar' }).click();
  await expect(secretBox.locator('code')).not.toHaveText(secret);
  expect((await exportForSheet(secret)).status).not.toBe(200);
});

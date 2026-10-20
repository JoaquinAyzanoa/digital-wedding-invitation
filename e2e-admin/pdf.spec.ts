import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';
import JSZip from 'jszip';

const ADMIN = { email: 'admin@example.com', password: 'admin123456' };

async function login(page: Page) {
  await page.goto('/login/');
  await page.getByLabel('Correo').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
}

async function goToInvitations(page: Page) {
  await page.getByRole('link', { name: 'Invitados' }).click();
  await expect(page.getByRole('heading', { name: /Invitados/ })).toBeVisible();
}

async function bytes(download: Download) {
  return readFile((await download.path())!);
}

test.describe.configure({ mode: 'serial' });

test('downloads an invitation PDF from its row and from its panel', async ({ page }) => {
  await login(page);
  await goToInvitations(page);
  await page.getByLabel('Buscar invitaciones').fill('Familia López');

  let downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PDF de Familia López' }).click();
  let download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^Invitacion-.+-Familia-Lopez\.pdf$/);
  expect((await bytes(download)).subarray(0, 5).toString()).toBe('%PDF-');

  await page.getByRole('button', { name: 'Editar Familia López' }).click();
  const panel = page.getByRole('dialog', { name: 'Familia López' });
  downloading = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Descargar PDF' }).click();
  download = await downloading;
  expect(download.suggestedFilename()).toMatch(/-Familia-Lopez\.pdf$/);
});

test('the admin marks an invitation as sent (sending happens outside the web)', async ({
  page,
}) => {
  await login(page);
  await goToInvitations(page);
  await page.getByLabel('Buscar invitaciones').fill('Familia López');
  await page.getByRole('button', { name: 'Editar Familia López' }).click();
  const panel = page.getByRole('dialog', { name: 'Familia López' });

  await expect(panel.getByText('Aún no se envía.')).toBeVisible();
  await panel.getByRole('button', { name: 'Marcar como enviada' }).click();
  await expect(panel.getByText(/^Enviada el/)).toBeVisible();
  await panel.getByRole('button', { name: 'Marcar como no enviada' }).click();
  await expect(panel.getByText('Aún no se envía.')).toBeVisible();
});

test('downloads the PDFs of the selected invitations as a ZIP', async ({ page }) => {
  await login(page);
  await goToInvitations(page);
  await page.getByLabel('Buscar invitaciones').fill('Familia');
  await page.getByLabel('Seleccionar Familia López').check();
  await page.getByLabel('Seleccionar Familia Rojas').check();

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDFs (ZIP)' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^invitaciones-pdf-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(page.getByText('Listo: 2 PDFs en el ZIP.')).toBeVisible();

  const zip = await JSZip.loadAsync(await bytes(download));
  const names = Object.keys(zip.files).sort();
  expect(names).toHaveLength(2);
  expect(names[0]).toMatch(/-Familia-Lopez\.pdf$/);
  expect(names[1]).toMatch(/-Familia-Rojas\.pdf$/);
  for (const name of names) {
    const pdf = await zip.file(name)!.async('uint8array');
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
  }
});

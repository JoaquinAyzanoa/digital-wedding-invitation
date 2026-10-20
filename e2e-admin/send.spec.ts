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

test('sends an invitation by WhatsApp with its PDF and marks it sent', async ({ page }) => {
  await login(page);
  await goToInvitations(page);
  await page.getByLabel('Buscar invitaciones').fill('Familia López');
  await page.getByRole('button', { name: 'Enviar por WhatsApp a Familia López' }).click();

  const dialog = page.getByRole('dialog', { name: 'Enviar a Familia López' });
  // Peruvian mobile without the country code: 51 is added; the message carries the link.
  const href = await dialog.getByRole('link', { name: 'Abrir WhatsApp' }).getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/51900000001\?text=/);
  expect(decodeURIComponent(href!.split('text=')[1])).toContain('/?i=abc234');

  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Descargar PDF' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^Invitacion-.+-Familia-Lopez\.pdf$/);
  expect((await bytes(download)).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(dialog.getByRole('button', { name: 'Descargado ✓' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Ya la envié' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Marcada como enviada')).toBeVisible();
  const row = page.getByRole('button', { name: 'Editar Familia López' });
  // Sent and still unanswered: the row now offers a reminder.
  await expect(
    page.getByRole('button', { name: 'Recordatorio por WhatsApp a Familia López' }),
  ).toBeVisible();

  // An accidental "sent" can be undone from the panel.
  await row.click();
  const panel = page.getByRole('dialog', { name: 'Familia López' });
  await expect(panel.getByText(/^Enviada el/)).toBeVisible();
  await panel.getByRole('button', { name: 'Marcar como no enviada' }).click();
  await expect(panel.getByText('Aún no se envía.')).toBeVisible();
});

test('sends a reminder from the pending list', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Recordatorio para Diego Salas' }).click();
  const dialog = page.getByRole('dialog', { name: 'Recordatorio para Diego Salas' });
  const href = await dialog.getByRole('link', { name: 'Abrir WhatsApp' }).getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/51900000005\?text=/);
  expect(decodeURIComponent(href!.split('text=')[1])).toContain('/?i=pqr678');
  // A reminder is only the message: no PDF step, nothing to mark.
  await expect(dialog.getByRole('button', { name: 'Descargar PDF' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialog).toBeHidden();
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

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function openEnvelope(page: Page) {
  await page.getByRole('button', { name: 'Abrir la invitación' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 });
}

test.describe('invitation (demo)', () => {
  test('opens the envelope and shows every section', async ({ page }) => {
    await page.goto('/?i=demo');
    const envelope = page.getByRole('dialog');
    await expect(envelope.getByText('Familia Demo')).toBeVisible();
    await expect(envelope.getByText('lugares en su honor')).toBeVisible();

    await openEnvelope(page);
    await expect(page).toHaveTitle('Valeria & Mateo · Nuestra boda');

    for (const heading of [
      'Ceremonia',
      'Recepción',
      'Itinerario de actividades',
      'Gracias',
      'Dress code',
      'Álbum de recuerdos',
      'Confirmar asistencia',
    ]) {
      const element = page.getByRole('heading', { name: heading });
      await element.scrollIntoViewIfNeeded();
      await expect(element).toBeVisible();
    }
  });

  test('downloads the guest PDF', async ({ page }) => {
    await page.goto('/?i=demo');
    await openEnvelope(page);
    const button = page.getByRole('button', { name: 'Descargar mi invitación (PDF)' }).last();
    await button.scrollIntoViewIfNeeded();
    const downloading = page.waitForEvent('download');
    await button.click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('Invitacion-Valeria-y-Mateo-Familia-Demo.pdf');
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('copies a payment method', async ({ page }) => {
    await page.goto('/?i=demo');
    await openEnvelope(page);
    const copy = page.getByRole('button', { name: 'Copiar Yape / Plin' });
    await copy.scrollIntoViewIfNeeded();
    await copy.click();
    await expect(page.getByRole('status')).toHaveText('Copiado');
  });

  test('adds the ceremony to Google Calendar at the right time', async ({ page }) => {
    await page.goto('/?i=demo');
    await openEnvelope(page);
    await page.getByRole('button', { name: 'Agregar al calendario' }).first().click();
    const href = await page
      .getByRole('link', { name: 'Google Calendar' })
      .first()
      .getAttribute('href');
    // 15:00 in Lima is 20:00 UTC.
    expect(new URL(href!).searchParams.get('dates')).toBe('20270515T200000Z/20270515T210000Z');
  });

  test('without a code: generic invitation that asks for the code', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Hemos reservado')).toHaveCount(0);
    await openEnvelope(page);
    await expect(page.getByRole('button', { name: /^Copiar/ })).toHaveCount(0);

    const code = page.getByLabel(/Ingresa el código de tu invitación/);
    await code.scrollIntoViewIfNeeded();
    await code.fill('DEMO');
    await page.getByRole('button', { name: 'Ver mi invitación' }).click();
    await expect(page).toHaveURL(/\?i=demo/);
    await expect(page.getByRole('dialog').getByText('Familia Demo')).toBeVisible();
  });

  test('unknown code: says so inside the envelope', async ({ page }) => {
    await page.goto('/?i=zzzzzz');
    const envelope = page.getByRole('dialog');
    await expect(envelope.getByText('No encontramos tu invitación.')).toBeVisible();
    await envelope.getByRole('textbox').fill('ab');
    await envelope.getByRole('button', { name: 'Ver mi invitación' }).click();
    await expect(envelope.getByRole('alert')).toContainText('6 letras y números');
  });

  test('reduced motion: the envelope simply fades', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/?i=demo');
    const start = Date.now();
    await openEnvelope(page);
    expect(Date.now() - start).toBeLessThan(2000);
    await context.close();
  });

  test('second visit offers to skip the envelope', async ({ page }) => {
    await page.goto('/?i=demo');
    await openEnvelope(page);
    await page.reload();
    await page.getByRole('button', { name: 'Saltar' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

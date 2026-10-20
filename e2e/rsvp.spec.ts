import { expect, test, type Page } from '@playwright/test';

async function openRsvp(page: Page) {
  await page.goto('/?i=demo');
  await page.getByRole('button', { name: 'Abrir la invitación' }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 });
  const start = page.getByRole('button', { name: 'Confirma aquí' });
  await start.scrollIntoViewIfNeeded();
  await start.click();
}

test.describe('RSVP (demo)', () => {
  test('confirms two people, one of them a child, then changes to not attending', async ({
    page,
  }) => {
    await openRsvp(page);

    await page.getByText('Sí, asistiremos').click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Validation: nothing filled in yet.
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('Nombre completo')).toBeFocused();

    await page.getByLabel('Nombre completo').fill('Ana Torres');
    await page.getByLabel('Menú').selectOption('Pescado');
    await page.getByRole('button', { name: /Agregar persona/ }).click();
    const second = page.getByRole('group', { name: 'Persona 2' });
    await second.getByLabel('Nombre completo').fill('Mateo Torres');
    await second.getByText('Niño o niña').click();
    await second.getByLabel('Edad').selectOption('6');
    await second.getByLabel('Menú').selectOption('Infantil');
    await second.getByLabel(/Alergias/).fill('Maní');
    await expect(page.getByRole('button', { name: /Agregar persona/ })).toBeDisabled();

    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel(/Tu mensaje/).fill('¡Felicidades!');
    await page.getByRole('button', { name: 'Enviar respuesta' }).click();

    await expect(page.getByRole('heading', { name: '¡Gracias por confirmar!' })).toBeFocused();
    await expect(page.getByText('Ana Torres · Pescado')).toBeVisible();
    await expect(page.getByText('Mateo Torres (6 años) · Infantil')).toBeVisible();

    await page.getByRole('button', { name: 'Cambiar mi respuesta' }).click();
    await expect(page.getByLabel('Sí, asistiremos')).toBeChecked();
    await page.getByText('No podremos asistir').click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Enviar respuesta' }).click();
    await expect(page.getByRole('heading', { name: 'Gracias por avisarnos' })).toBeVisible();
  });

  test('Enter moves to the next step instead of sending', async ({ page }) => {
    await openRsvp(page);
    await page.getByText('No podremos asistir').click();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Paso 2 de 2')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gracias por avisarnos' })).toHaveCount(0);
  });
});

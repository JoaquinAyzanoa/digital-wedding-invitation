import { expect, test, type Page } from '@playwright/test';

// Seeded local admin (supabase/seed.sql).
const ADMIN = { email: 'admin@example.com', password: 'admin123456' };

async function login(page: Page, { email, password } = ADMIN) {
  await page.goto('/login/');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function goToInvitations(page: Page) {
  await page.getByRole('link', { name: 'Invitados' }).click();
  await expect(page.getByRole('heading', { name: /Invitados/ })).toBeVisible();
}

function csvWith150Rows() {
  const lines = ['nombre;pases;lado;grupo;telefono'];
  for (let i = 1; i <= 150; i++) {
    const side = ['novia', 'novio', 'ambos'][i % 3];
    lines.push(
      `Invitado CSV ${String(i).padStart(3, '0')};${(i % 4) + 1};${side};Grupo ${i % 5};9${String(i).padStart(8, '0')}`,
    );
  }
  lines.push('Fila con error;99;primos;;');
  return lines.join('\n');
}

test.describe.configure({ mode: 'serial' });

test('a non-admin account is turned away', async ({ page }) => {
  // A confirmed user without the admin role, via the local Auth admin API.
  const user = { email: `guest-${Date.now()}@example.com`, password: 'guest123456' };
  const response = await fetch(`${process.env.E2E_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: process.env.E2E_SUPABASE_SECRET!,
      Authorization: `Bearer ${process.env.E2E_SUPABASE_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...user, email_confirm: true }),
  });
  expect(response.ok, await response.clone().text()).toBe(true);

  await login(page, user);
  await expect(page.getByRole('alert')).toHaveText('Esta cuenta no tiene acceso.');
  await expect(page.getByRole('heading', { name: 'Resumen' })).toHaveCount(0);
});

test('wrong password', async ({ page }) => {
  await login(page, { ...ADMIN, password: 'nope-nope' });
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
});

test('imports 150 invitations by CSV and manages them from the phone', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await goToInvitations(page);
  await expect(page.getByText('5 invitaciones')).toBeVisible();

  // Import: the invalid row is reported and skipped.
  await page.getByRole('button', { name: 'Importar CSV' }).click();
  await page.getByLabel('Archivo').setInputFiles({
    name: 'invitados.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvWith150Rows(), 'utf8'),
  });
  await expect(page.getByText('151 filas')).toBeVisible();
  await expect(page.getByText('1 con errores')).toBeVisible();
  await expect(page.getByText('Fila 152')).toBeVisible();
  await page.getByRole('button', { name: 'Importar 150 invitaciones' }).click();
  await expect(page.getByRole('status')).toHaveText('150 invitaciones importadas');
  await expect(page.getByText('155 invitaciones')).toBeVisible();

  // Search and filters.
  await page.getByLabel('Buscar invitaciones').fill('csv 042');
  await expect(page.getByRole('button', { name: /^Editar / })).toHaveCount(1);
  await page.getByLabel('Buscar invitaciones').fill('');
  await page.getByRole('button', { name: 'Filtros' }).click();
  await page.getByLabel('Grupo').selectOption('Grupo 3');
  await expect(page.getByText('30 de 155')).toBeVisible();
  await page.getByRole('button', { name: 'Quitar filtros' }).click();

  // Bulk delete with confirmation.
  await page.getByLabel('Buscar invitaciones').fill('Invitado CSV 15');
  await page.getByLabel('Seleccionar todas las visibles').check();
  await expect(page.getByText('3 seleccionadas')).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByRole('status')).toHaveText('3 eliminadas');
  await page.getByLabel('Buscar invitaciones').fill('');
  await expect(page.getByText('152 invitaciones')).toBeVisible();
});

test('creates an invitation, records the RSVP for the guest and resets it', async ({ page }) => {
  await login(page);
  await goToInvitations(page);

  await page.getByRole('button', { name: 'Nueva invitación' }).click();
  const panel = page.getByRole('dialog');
  // Validation.
  await panel.getByRole('button', { name: 'Crear invitación' }).click();
  await expect(panel.getByText('Escribe el nombre')).toBeVisible();

  await panel.getByLabel('Nombre en la invitación').fill('Familia E2E');
  await panel.getByLabel('Pases').fill('3');
  await panel.getByLabel('Lado').selectOption('groom');
  await panel.getByRole('button', { name: 'Crear invitación' }).click();
  await expect(page.getByRole('status')).toContainText('Invitación creada');
  // The panel switches to the new invitation, with its link.
  await expect(panel.getByRole('heading', { name: 'Familia E2E' })).toBeVisible();
  await expect(panel.getByText(/\?i=[a-z2-9]{6}$/)).toBeVisible();

  // RSVP on the guest's behalf (they answered by phone).
  await panel.getByRole('tab', { name: 'Respuesta' }).click();
  await panel.getByText('Asiste', { exact: true }).click();
  await panel.getByLabel('Nombre completo').fill('Pedro E2E');
  await panel.getByLabel('Menú').selectOption('Carne');
  await panel.getByRole('button', { name: /Agregar persona/ }).click();
  await panel.getByLabel('Nombre completo').nth(1).fill('Lucía E2E');
  await panel.getByLabel('Tipo').nth(1).selectOption('child');
  await panel.getByLabel('Edad').selectOption('5');
  await panel.getByLabel('Menú').nth(1).selectOption('Infantil');
  await panel.getByRole('button', { name: 'Guardar respuesta' }).click();
  await expect(page.getByRole('status')).toHaveText('Respuesta guardada');

  await panel.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByLabel('Buscar invitaciones').fill('lucia');
  await expect(page.getByRole('button', { name: 'Editar Familia E2E' })).toContainText(
    'Asiste · 2',
  );

  // Reset to pending.
  await page.getByRole('button', { name: 'Editar Familia E2E' }).click();
  await panel.getByRole('tab', { name: 'Respuesta' }).click();
  await panel.getByText('Pendiente', { exact: true }).click();
  await panel.getByRole('button', { name: 'Guardar respuesta' }).click();
  await page
    .getByRole('dialog', { name: /pendiente/ })
    .getByRole('button', { name: 'Reiniciar respuesta' })
    .click();
  await expect(page.getByRole('status')).toHaveText('Respuesta reiniciada: queda pendiente');
  await panel.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByLabel('Buscar invitaciones').fill('familia e2e');
  await expect(page.getByRole('button', { name: 'Editar Familia E2E' })).toContainText('Pendiente');
});

test('passes cannot go below the people already confirmed', async ({ page }) => {
  await login(page);
  await goToInvitations(page);
  await page.getByRole('button', { name: 'Editar Familia Rojas' }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Pases').fill('2');
  await panel.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(panel.getByText(/Hay 3 personas confirmadas/)).toBeVisible();
});

test('signing out returns to the login', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

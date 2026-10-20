// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { demoContent, demoInvitation } from '@/demo/content';
import { RsvpContext } from '@/invitation/rsvpContext';
import { RsvpSection } from '@/invitation/sections/RsvpSection';
import { ApiError, type PublicApi } from '@/shared/api';
import type { InvitationView } from '@/shared/schemas/invitation';

const entry = { id: 'rsvp' as const, visible: true };

function setup(invitation: InvitationView, submitRsvp?: PublicApi['submitRsvp']) {
  let current = invitation;
  const api: PublicApi = {
    getContent: vi.fn(),
    getInvitation: vi.fn(),
    uploadAlbumPhoto: vi.fn(),
    submitRsvp: vi.fn(
      submitRsvp ??
        (async (_code, rsvp) => ({
          ...current,
          response: {
            attending: rsvp.attending,
            parts: { ceremony: true, reception: true },
            needsTransport: null,
            needsLodging: null,
            contactPhone: null,
            songRequest: rsvp.songRequest ?? null,
            message: rsvp.message ?? null,
            respondedAt: '2026-10-20T15:00:00Z',
            attendees: rsvp.attendees,
          },
        })),
    ),
  };
  function Harness() {
    return (
      <RsvpContext value={{ api, onInvitationChange: (v) => (current = v) }}>
        <RsvpSection content={demoContent} invitation={current} entry={entry} />
      </RsvpContext>
    );
  }
  const view = render(<Harness />);
  // The section reads the invitation from props: re-render after each change.
  const refresh = () => view.rerender(<Harness />);
  return { api, refresh, user: userEvent.setup() };
}

const continueButton = () => screen.getByRole('button', { name: 'Continuar' });

// Taps are ignored while one step animates out and the next in: wait for it to settle.
async function stepReady() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /^(Continuar|Enviar respuesta)$/ })).toBeEnabled(),
  );
}

/** "Confirma aquí" loads the form lazily: wait for its first question. */
async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Confirma aquí' }));
  await screen.findByText(/¿Nos acompañ/);
}

async function next(user: ReturnType<typeof userEvent.setup>) {
  await user.click(continueButton());
  await stepReady();
}

describe('RSVP form', () => {
  it('uses singular wording and prefills the name of an individual invitation', async () => {
    const { user } = setup({ ...demoInvitation, seats: 1, displayName: 'Ana Pérez' });
    await openForm(user);
    expect(screen.getByText('¿Nos acompañas?')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Sí, asistiré'));
    await next(user);
    expect(await screen.findByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
    expect(screen.queryByRole('button', { name: /Agregar persona/ })).not.toBeInTheDocument();
  });

  it('validates each step and focuses the first error', async () => {
    const { user } = setup(demoInvitation);
    await openForm(user);
    await next(user);
    expect(await screen.findByText('Elige una opción')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Sí, asistiremos'));
    expect(screen.queryByText('Elige una opción')).not.toBeInTheDocument();
    await next(user);
    await screen.findByText('¿Quiénes vienen?');
    await next(user);

    const name = screen.getByLabelText('Nombre completo');
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Escribe el nombre completo')).toBeInTheDocument();
    expect(screen.getByText('Elige un menú', { selector: 'p' })).toBeInTheDocument();

    // Errors clear as soon as they are fixed (no waiting for blur).
    await user.type(name, 'Ana');
    expect(screen.queryByText('Escribe el nombre completo')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Menú'), 'Carne');
    expect(screen.queryByText('Elige un menú', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('limits attendees to the reserved seats and asks a child’s age', async () => {
    const { user } = setup(demoInvitation);
    await openForm(user);
    await user.click(screen.getByLabelText('Sí, asistiremos'));
    await next(user);

    const add = await screen.findByRole('button', { name: 'Agregar persona (1 de 2)' });
    await user.click(add);
    expect(screen.getByRole('button', { name: 'Agregar persona (2 de 2)' })).toBeDisabled();

    const second = within(screen.getByRole('group', { name: 'Persona 2' }));
    expect(second.queryByLabelText('Edad')).not.toBeInTheDocument();
    await user.click(second.getByLabelText('Niño o niña'));
    expect(second.getByLabelText('Edad')).toBeInTheDocument();

    await user.click(second.getByRole('button', { name: /Quitar/ }));
    expect(screen.queryByRole('group', { name: 'Persona 2' })).not.toBeInTheDocument();
  });

  it('confirms attendance and shows the summary', async () => {
    const { api, user, refresh } = setup(demoInvitation);
    await openForm(user);
    await user.click(screen.getByLabelText('Sí, asistiremos'));
    await next(user);
    await user.type(await screen.findByLabelText('Nombre completo'), 'Ana Torres');
    await user.selectOptions(screen.getByLabelText('Menú'), 'Pescado');
    await user.type(screen.getByLabelText(/canción/), 'Vivir mi vida');
    // The DNI is required: without it the step does not move on.
    await next(user);
    expect(await screen.findByText('Escribe el DNI')).toBeInTheDocument();
    await user.type(screen.getByLabelText('DNI'), '07654321');
    await next(user);
    await user.type(await screen.findByLabelText(/Tu mensaje/), '¡Felicidades!');
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }));

    await waitFor(() => expect(api.submitRsvp).toHaveBeenCalledTimes(1));
    expect(api.submitRsvp).toHaveBeenCalledWith('demo', {
      attending: true,
      attendees: [
        {
          fullName: 'Ana Torres',
          kind: 'adult',
          age: null,
          menu: 'Pescado',
          dietary: null,
          dni: '07654321',
        },
      ],
      needsTransport: null,
      needsLodging: null,
      songRequest: 'Vivir mi vida',
      contactPhone: null,
      message: '¡Felicidades!',
    });
    refresh();
    expect(await screen.findByText('¡Gracias por confirmar!')).toBeInTheDocument();
    expect(screen.getByText('Ana Torres · Pescado')).toBeInTheDocument();
  });

  it('declining takes two steps', async () => {
    const { api, user, refresh } = setup(demoInvitation);
    await openForm(user);
    await user.click(screen.getByLabelText('No podremos asistir'));
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    await next(user);
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    await waitFor(() =>
      expect(api.submitRsvp).toHaveBeenCalledWith('demo', {
        attending: false,
        attendees: [],
        contactPhone: null,
        message: null,
      }),
    );
    refresh();
    expect(await screen.findByText('Gracias por avisarnos')).toBeInTheDocument();
  });

  it('switching to "no" is not blocked by an invalid field left on a hidden step', async () => {
    const { api, user } = setup(demoInvitation);
    await openForm(user);
    await user.click(screen.getByLabelText('Sí, asistiremos'));
    await next(user);
    await user.type(screen.getByLabelText(/Teléfono/), 'abc');
    await user.click(screen.getByRole('button', { name: 'Atrás' }));
    await stepReady();
    await user.click(screen.getByLabelText('No podremos asistir'));
    await next(user);
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    await waitFor(() =>
      expect(api.submitRsvp).toHaveBeenCalledWith('demo', {
        attending: false,
        attendees: [],
        contactPhone: null,
        message: null,
      }),
    );
  });

  it('focuses the first question when the form opens', async () => {
    const { user } = setup(demoInvitation);
    await openForm(user);
    await waitFor(() => expect(screen.getByText('¿Nos acompañan?')).toHaveFocus());
  });

  it('a second submit while sending is ignored', async () => {
    let finish: () => void = () => {};
    const { api, user } = setup(
      demoInvitation,
      () =>
        new Promise((resolve) => {
          finish = () => resolve(demoInvitation);
        }),
    );
    await openForm(user);
    await user.click(screen.getByLabelText('No podremos asistir'));
    await next(user);
    // Two submit events in a row: what Enter in a field or a fast double tap produces.
    const form = screen.getByRole('button', { name: 'Enviar respuesta' }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled());
    fireEvent.submit(form);
    // Validation is async: give a second submission time to reach the API.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(api.submitRsvp).toHaveBeenCalledTimes(1);
    finish();
  });

  it('shows the closed message when the server says the RSVP closed', async () => {
    const { user, refresh } = setup(demoInvitation, async () => {
      throw new ApiError('rsvp_closed');
    });
    await openForm(user);
    await user.click(screen.getByLabelText('No podremos asistir'));
    await next(user);
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    await waitFor(() => {
      refresh();
      expect(screen.getByText(/La confirmación ya cerró/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Confirma aquí' })).not.toBeInTheDocument();
  });

  it('keeps the answers and explains a network error', async () => {
    const { user } = setup(demoInvitation, async () => {
      throw new ApiError('network');
    });
    await openForm(user);
    await user.click(screen.getByLabelText('No podremos asistir'));
    await next(user);
    await user.type(await screen.findByLabelText(/Tu mensaje/), 'Lo siento');
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu conexión');
    expect(screen.getByLabelText(/Tu mensaje/)).toHaveValue('Lo siento');
  });

  it('changing an answer starts from the previous one and can be cancelled', async () => {
    const { user } = setup({
      ...demoInvitation,
      response: {
        attending: true,
        parts: { ceremony: true, reception: true },
        needsTransport: null,
        needsLodging: null,
        contactPhone: null,
        songRequest: null,
        message: null,
        respondedAt: '2026-10-20T15:00:00Z',
        attendees: [
          { fullName: 'Ana Torres', kind: 'adult', age: null, menu: 'Carne', dietary: null },
        ],
      },
    });
    await user.click(screen.getByRole('button', { name: 'Cambiar mi respuesta' }));
    await screen.findByText(/¿Nos acompañ/);
    expect(screen.getByLabelText('Sí, asistiremos')).toBeChecked();
    await next(user);
    expect(await screen.findByLabelText('Nombre completo')).toHaveValue('Ana Torres');
    await user.click(screen.getByRole('button', { name: 'Atrás' }));
    await stepReady();
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('¡Gracias por confirmar!')).toHaveFocus();
  });

  it('after the deadline the summary is read-only', () => {
    setup({
      ...demoInvitation,
      rsvpOpen: false,
      response: {
        attending: false,
        parts: { ceremony: null, reception: null },
        needsTransport: null,
        needsLodging: null,
        contactPhone: null,
        songRequest: null,
        message: null,
        respondedAt: '2026-10-20T15:00:00Z',
        attendees: [],
      },
    });
    expect(screen.queryByRole('button', { name: 'Cambiar mi respuesta' })).not.toBeInTheDocument();
    expect(screen.getByText(/La confirmación ya cerró/)).toBeInTheDocument();
  });
});

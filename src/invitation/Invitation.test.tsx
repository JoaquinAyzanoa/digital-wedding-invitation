// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { demoContent, demoInvitation } from '@/demo/content';
import type { PublicContent } from '@/shared/schemas/content';
import { Invitation } from './Invitation';
import type { CodeStatus } from './useInvitationData';

function renderInvitation({
  content = demoContent,
  codeStatus = 'valid',
}: { content?: PublicContent; codeStatus?: CodeStatus } = {}) {
  return render(
    <Invitation
      content={content}
      invitation={codeStatus === 'valid' ? demoInvitation : null}
      codeStatus={codeStatus}
      showDesignPanel={false}
    />,
  );
}

// While the envelope covers it, <main> is aria-hidden: query it with `hidden: true`.
const page = () => within(document.querySelector('main')!);

describe('Invitation states', () => {
  it('valid code: the envelope shows the guest and their seats; gifts can be copied', () => {
    renderInvitation();
    const envelope = screen.getByRole('dialog');
    expect(within(envelope).getByText('Familia Demo')).toBeInTheDocument();
    expect(within(envelope).getByText('2')).toBeInTheDocument();
    expect(within(envelope).getByText('lugares en su honor')).toBeInTheDocument();
    expect(page().getAllByRole('button', { name: /^Copiar/, hidden: true })).toHaveLength(2);
  });

  it('no code: generic envelope, no bank details, RSVP asks for the code', () => {
    renderInvitation({ codeStatus: 'none' });
    expect(screen.queryByText('Hemos reservado')).not.toBeInTheDocument();
    expect(page().queryByRole('button', { name: /^Copiar/, hidden: true })).toBeNull();
    expect(page().getByLabelText(/Ingresa el código de tu invitación/)).toBeInTheDocument();
  });

  it('unknown code: the envelope says so and offers to type it again', () => {
    renderInvitation({ codeStatus: 'not_found' });
    const envelope = screen.getByRole('dialog');
    expect(within(envelope).getByText('No encontramos tu invitación.')).toBeInTheDocument();
    expect(within(envelope).getByRole('button', { name: 'Ver mi invitación' })).toBeInTheDocument();
  });

  // jsdom runs the full ~3.5 s sequence (motion does not see reduced motion there).
  it('opening the envelope reveals the page', { timeout: 10_000 }, async () => {
    renderInvitation();
    expect(document.querySelector('main')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir la invitación' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 7000,
    });
    expect(document.querySelector('main')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Valeria y Mateo');
  });

  it('follows the order and visibility in content.sections', () => {
    const content = structuredClone(demoContent);
    content.sections = [
      { id: 'dressCode', visible: true },
      { id: 'gifts', visible: false },
      { id: 'itinerary', visible: true },
    ];
    renderInvitation({ content });
    const headings = page()
      .getAllByRole('heading', { level: 2, hidden: true })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Dress code', 'Itinerario de actividades']);
  });

  it('without the envelope section the page is visible right away', () => {
    const content = structuredClone(demoContent);
    content.sections = content.sections.filter((s) => s.id !== 'envelope');
    renderInvitation({ content });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('main')).toHaveAttribute('aria-hidden', 'false');
  });
});

describe('Code entry', () => {
  it('rejects a malformed code without navigating', async () => {
    renderInvitation({ codeStatus: 'not_found' });
    const envelope = within(screen.getByRole('dialog'));
    await userEvent.type(envelope.getByRole('textbox'), 'ab');
    await userEvent.click(envelope.getByRole('button', { name: 'Ver mi invitación' }));
    expect(envelope.getByRole('alert')).toHaveTextContent('6 letras y números');
  });
});

describe('Music', () => {
  it(
    'starts on the envelope tap and shows the mute button afterwards',
    { timeout: 10_000 },
    async () => {
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
      const content = structuredClone(demoContent);
      content.music = { url: 'https://example.com/song.mp3' };
      renderInvitation({ content });

      expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Abrir la invitación' }));
      // Called inside the tap itself, which is what unlocks audio on phones.
      expect(play).toHaveBeenCalledTimes(1);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
        timeout: 7000,
      });
      expect(screen.getByRole('button', { name: /música/ })).toBeInTheDocument();
      expect(screen.getByText('Dale play a nuestra canción')).toBeInTheDocument();
      play.mockRestore();
    },
  );
});

// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { demoContent, demoInvitation } from '@/demo/content';
import { createDemoApi } from '@/shared/api/demoApi';
import type { PublicContent } from '@/shared/schemas/content';
import { Invitation } from './Invitation';
import type { CodeStatus } from './useInvitationData';

function renderInvitation({
  content = demoContent,
  codeStatus = 'valid',
  autoplayMusic = false,
}: { content?: PublicContent; codeStatus?: CodeStatus; autoplayMusic?: boolean } = {}) {
  return render(
    <Invitation
      api={createDemoApi()}
      content={content}
      invitation={codeStatus === 'valid' ? demoInvitation : null}
      codeStatus={codeStatus}
      showDesignPanel={false}
      autoplayMusic={autoplayMusic}
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
  it('opening the envelope reveals the page', { timeout: 15_000 }, async () => {
    renderInvitation();
    expect(document.querySelector('main')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir la invitación' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 9000,
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

  it('with a pre-wedding video: it plays muted behind the envelope, with the countdown', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const content = structuredClone(demoContent);
    content.coverVideo = 'https://example.com/storage/videos/abc.mp4';
    renderInvitation({ content });
    const envelope = screen.getByRole('dialog');
    const video = envelope.querySelector('video')!;
    expect(video).toHaveAttribute('src', content.coverVideo);
    expect(video).toHaveAttribute('poster', 'https://example.com/storage/videos/abc-poster.jpg');
    expect(video.muted).toBe(true);
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(within(envelope).getByText('Te invitamos a nuestra boda')).toBeInTheDocument();
    expect(within(envelope).getByText('Familia Demo')).toBeInTheDocument();
    expect(within(envelope).getByText(/lugares en su honor/)).toBeInTheDocument();
    expect(within(envelope).getByText('Faltan:')).toBeInTheDocument();
    expect(within(envelope).getByText('Segundos')).toBeInTheDocument();
    play.mockRestore();
  });

  it('without a video the envelope keeps its flowers and no countdown', () => {
    renderInvitation();
    const envelope = screen.getByRole('dialog');
    expect(envelope.querySelector('video')).toBeNull();
    expect(within(envelope).getByText('¡Nos casamos!')).toBeInTheDocument();
    expect(within(envelope).queryByText('Segundos')).not.toBeInTheDocument();
  });

  it('stationery: the monogram crest and the colors to avoid, named for screen readers', () => {
    renderInvitation();
    expect(page().getByRole('img', { name: 'Valeria y Mateo', hidden: true })).toBeInTheDocument();
    const colors = page().getByRole('list', { name: 'Colores a evitar', hidden: true });
    expect(
      within(colors)
        .getAllByRole('listitem', { hidden: true })
        .map((item) => item.textContent),
    ).toEqual(['blanco', 'crema', 'vino']);
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
    expect(envelope.getByRole('alert')).toHaveTextContent('4 letras o números');
  });
});

describe('Music', () => {
  it(
    'starts on the envelope tap and shows the mute button afterwards',
    { timeout: 20_000 },
    async () => {
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
      // jsdom cannot buffer media: the early preload is a no-op here.
      const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
      const content = structuredClone(demoContent);
      content.music = { url: 'https://example.com/song.mp3' };
      renderInvitation({ content });

      expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Abrir la invitación' }));
      // Called inside the tap itself, which is what unlocks audio on phones.
      expect(play).toHaveBeenCalledTimes(1);
      const song = play.mock.contexts[0] as HTMLMediaElement;
      // It starts silent and rises once the sound really starts, while the envelope opens.
      expect(song.volume).toBe(0);
      song.dispatchEvent(new Event('playing'));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
        timeout: 9000,
      });
      expect(screen.getByRole('button', { name: /música/ })).toBeInTheDocument();
      expect(screen.getByText('Dale play a nuestra canción')).toBeInTheDocument();
      // Three seconds of fade, on a busy test machine: allow it time.
      await waitFor(() => expect(song.volume).toBe(1), { timeout: 5000 });
      play.mockRestore();
      load.mockRestore();
    },
  );

  it('starts as the page opens when the browser allows it, with a mute button', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const paused = vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(true);
    const content = structuredClone(demoContent);
    content.music = { url: 'https://example.com/song.mp3' };
    renderInvitation({ content, autoplayMusic: true });

    // No tap yet: the envelope is still closed.
    expect(play).toHaveBeenCalledTimes(1);
    const song = play.mock.contexts[0] as HTMLMediaElement;
    paused.mockReturnValue(false);
    song.dispatchEvent(new Event('play'));
    expect(await screen.findByRole('button', { name: 'Silenciar la música' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Opening the envelope does not restart it.
    await userEvent.click(screen.getByRole('button', { name: 'Abrir la invitación' }));
    expect(play).toHaveBeenCalledTimes(1);
    play.mockRestore();
    paused.mockRestore();
  });

  it('when the browser refuses, it starts on the first touch anywhere', async () => {
    let playing = false;
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      .mockImplementation(() => {
        playing = true;
        return Promise.resolve();
      });
    const paused = vi
      .spyOn(HTMLMediaElement.prototype, 'paused', 'get')
      .mockImplementation(() => !playing);
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const content = structuredClone(demoContent);
    content.music = { url: 'https://example.com/song.mp3' };
    renderInvitation({ content, autoplayMusic: true });
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    // Refused: no mute button over the envelope.
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();

    await userEvent.click(within(screen.getByRole('dialog')).getByText('Familia Demo'));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    // Playing now: later touches (the envelope's too) do not start it again.
    await userEvent.click(screen.getByRole('button', { name: 'Abrir la invitación' }));
    expect(play).toHaveBeenCalledTimes(2);
    play.mockRestore();
    paused.mockRestore();
    load.mockRestore();
  });
});

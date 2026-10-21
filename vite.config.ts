import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Link-preview tags for the invitation page. WhatsApp reads the static HTML (no JS), so they
 * are injected at build time from VITE_OG_* / VITE_SITE_URL instead of from the database.
 */
function invitationMeta(env: Record<string, string>): Plugin {
  const title = env.VITE_OG_TITLE || 'Nuestra boda';
  const description =
    env.VITE_OG_DESCRIPTION || 'Te invitamos a celebrar con nosotros. Abre tu invitación personal.';
  const tags = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="es_PE" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    env.VITE_SITE_URL && `<meta property="og:url" content="${escapeHtml(env.VITE_SITE_URL)}" />`,
    env.VITE_OG_IMAGE_URL &&
      `<meta property="og:image" content="${escapeHtml(env.VITE_OG_IMAGE_URL)}" />`,
    `<meta name="twitter:card" content="${env.VITE_OG_IMAGE_URL ? 'summary_large_image' : 'summary'}" />`,
  ].filter(Boolean);

  return {
    name: 'invitation-meta',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.path !== '/index.html') return html;
        return html
          .replace('<title>Invitación de boda</title>', `<title>${escapeHtml(title)}</title>`)
          .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
      },
    },
  };
}

// Two separate entries so the admin code is never downloaded with the invitation. The admin
// lives at /login/: nothing on the invitation links to it.
export default defineConfig(({ mode }) => ({
  plugins: [react(), invitationMeta(loadEnv(mode, process.cwd(), 'VITE_'))],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        invitation: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./login/index.html', import.meta.url)),
        // /fotos/: the album page the QR on the tables opens.
        fotos: fileURLToPath(new URL('./fotos/index.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'apps-script/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
}));

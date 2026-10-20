import { MotionConfig } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { demoContent, demoInvitation } from '@/demo/content';
import type { FontRef } from '@/shared/schemas/content';
import { applyTheme } from '@/shared/theme/theme';
import styles from './App.module.css';
import { DesignPanel } from './components/DesignPanel/DesignPanel';
import { Envelope } from './components/Envelope/Envelope';
import { DateSection } from './sections/DateSection/DateSection';

// Phase 2 mockup: demo content only. Phase 3 adds the API layer (Supabase or demo).
const params = new URLSearchParams(window.location.search);
const invitation = params.get('i') === 'demo' ? demoInvitation : null;
const showDesignPanel = params.has('design');

export default function App() {
  const content = demoContent;
  const [scriptFont, setScriptFont] = useState<FontRef>(content.theme.fonts.script);
  const [fontsReady, setFontsReady] = useState(false);
  const [envelopeOpen, setEnvelopeOpen] = useState(false);

  const theme = useMemo(
    () => ({ ...content.theme, fonts: { ...content.theme.fonts, script: scriptFont } }),
    [content.theme, scriptFont],
  );

  useEffect(() => {
    let active = true;
    void applyTheme(theme, content.customFonts).then(() => {
      if (active) setFontsReady(true);
    });
    return () => {
      active = false;
    };
  }, [theme, content.customFonts]);

  return (
    <MotionConfig reducedMotion="user">
      <main className={styles.page} aria-hidden={!envelopeOpen}>
        <DateSection content={content} />
      </main>

      {!envelopeOpen && (
        <Envelope
          content={content}
          invitation={invitation}
          ready={fontsReady}
          onOpened={() => setEnvelopeOpen(true)}
        />
      )}

      {showDesignPanel && (
        <DesignPanel
          sample={`${content.couple.bride} & ${content.couple.groom}`}
          value={scriptFont}
          onChange={setScriptFont}
        />
      )}
    </MotionConfig>
  );
}

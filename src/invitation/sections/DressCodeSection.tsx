import { Reveal } from '@/invitation/components/Reveal';
import { Icon } from '@/shared/icons/Icon';
import { ButtonLink } from '@/shared/ui/Button';
import { colorName } from '@/shared/utils/colorName';
import styles from './DressCodeSection.module.css';
import { Section } from './Section';
import text from './text.module.css';
import { sectionTitle, type SectionProps } from './types';

/**
 * Two cards of pearl paper side by side, like the reference: the dress code (straight top,
 * a little higher) and «Evento solo para adultos» (arched, a little lower, over its edge).
 * Without the adults' text the dress code card stands alone.
 */
export function DressCodeSection({ content, entry }: SectionProps) {
  const { title, notes, avoidColors, avoidColorsTitle, inspirationUrl } = content.dressCode;
  const adults = content.adultsOnly?.text ? content.adultsOnly : undefined;
  return (
    <Section content={content} entry={entry} labelledBy="dresscode-title">
      <div className={styles.cards} data-pair={adults ? 'true' : undefined}>
        <Reveal from="left" className={styles.slot}>
          <div className={styles.card}>
            <h2 id="dresscode-title" className={styles.title}>
              {sectionTitle(content, 'dressCode')}
            </h2>
            <div className={styles.icons}>
              <Icon name="dress" size={44} className={text.goldIcon} />
              <Icon name="suit" size={44} className={text.goldIcon} />
            </div>
            {title && <p className={styles.code}>{title}</p>}
            {notes.map((note) => (
              <p key={note} className={styles.text}>
                {note}
              </p>
            ))}
            {avoidColors.length > 0 && (
              <div className={styles.avoid}>
                <p id="avoid-colors" className={styles.avoidTitle}>
                  {avoidColorsTitle || 'Colores a evitar'}
                </p>
                <ul className={styles.swatches} aria-labelledby="avoid-colors">
                  {avoidColors.map((color, i) => (
                    <li
                      key={`${color}-${i}`}
                      className={styles.swatch}
                      style={{ background: color }}
                    >
                      <span className="visually-hidden">{colorName(color)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inspirationUrl && (
              <ButtonLink href={inspirationUrl} size="small" className={styles.button}>
                Ver inspiración
              </ButtonLink>
            )}
          </div>
        </Reveal>

        {adults && (
          <Reveal from="right" delay={0.15} className={styles.slot}>
            <div className={styles.card} data-arch="true">
              <h3 className={styles.title}>{adults.title || 'Evento solo para adultos'}</h3>
              {adults.image ? (
                <img className={styles.drawing} src={adults.image} alt="" loading="lazy" />
              ) : (
                <Icon name="glasses" size={48} className={text.goldIcon} />
              )}
              <p className={styles.text}>{adults.text}</p>
            </div>
          </Reveal>
        )}
      </div>
    </Section>
  );
}

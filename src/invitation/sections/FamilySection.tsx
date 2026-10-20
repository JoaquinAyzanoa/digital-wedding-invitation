import { Reveal } from '@/invitation/components/Reveal';
import { Section } from './Section';
import text from './text.module.css';
import type { SectionProps } from './types';

function pairs(names: string[]): string[][] {
  const result: string[][] = [];
  for (let i = 0; i < names.length; i += 2) result.push(names.slice(i, i + 2));
  return result;
}

export function FamilySection({ content, entry }: SectionProps) {
  const family = content.family;
  if (!family) return null;

  const parents = [family.parents.bride, family.parents.groom].filter((names) => names.length > 0);
  const godparents = pairs(family.godparents);

  return (
    <Section content={content} entry={entry}>
      <Reveal>
        <p className={text.body}>
          {family.intro || 'Con nuestro amor, la bendición de Dios y la de nuestros padres:'}
        </p>
      </Reveal>
      {parents.map((names, i) => (
        <Reveal key={`p${i}`} delay={i * 0.1}>
          <p className={text.names}>
            {names.map((name) => (
              <span key={name} style={{ display: 'block' }}>
                {name}
              </span>
            ))}
          </p>
        </Reveal>
      ))}

      {godparents.length > 0 && (
        <>
          <Reveal>
            <p className={text.body}>
              {family.godparentsIntro || 'Y en compañía de nuestros padrinos:'}
            </p>
          </Reveal>
          {godparents.map((names, i) => (
            <Reveal key={`g${i}`} delay={i * 0.1}>
              <p className={text.names}>
                {names.map((name) => (
                  <span key={name} style={{ display: 'block' }}>
                    {name}
                  </span>
                ))}
              </p>
            </Reveal>
          ))}
        </>
      )}
    </Section>
  );
}

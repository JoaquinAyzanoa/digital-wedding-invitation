import { useState, type ReactNode } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { ContentEditor } from '@/admin/content/ContentEditor';
import {
  DateField,
  ObjectListField,
  SelectField,
  StringListField,
  TextField,
  Toggle,
  UploadField,
  WeddingDateTimeField,
} from '@/admin/content/fields';
import { sectionOfPath, type ContentForm, type ContentSectionKey } from '@/admin/content/form';
import { uploadDecoration, uploadMusic, uploadPhoto } from '@/admin/data/storage';
import { Btn } from '@/admin/ui/Btn';
import ui from '@/admin/ui/ui.module.css';
import { ICON_KEYS, PHOTO_SLOTS, SECTION_IDS, type SectionId } from '@/shared/schemas/content';
import { useToast } from '@/shared/toast/toastContext';
import styles from './ContentPage.module.css';

const ICON_LABELS: Record<(typeof ICON_KEYS)[number], string> = {
  church: 'Iglesia',
  arch: 'Arco (recepción)',
  couple: 'Novios',
  rings: 'Anillos',
  glasses: 'Copas',
  plate: 'Plato',
  confetti: 'Confeti',
  gift: 'Regalo',
  album: 'Álbum',
  camera: 'Cámara',
  calendar: 'Calendario',
  dress: 'Vestido',
  suit: 'Terno',
  heart: 'Corazón',
  infinity: 'Infinito',
  location: 'Ubicación',
  music: 'Música',
};

const SECTION_LABELS: Record<SectionId, string> = {
  envelope: 'Sobre',
  welcome: 'Bienvenida',
  photo: 'Foto',
  family: 'Familia',
  date: 'Fecha y cuenta regresiva',
  events: 'Ceremonia y recepción',
  itinerary: 'Itinerario',
  closing: 'Cierre',
  gifts: 'Regalos',
  dressCode: 'Dress code',
  album: 'Álbum',
  rsvp: 'Confirmación',
  farewell: 'Despedida',
};

const PHOTO_LABELS: Record<(typeof PHOTO_SLOTS)[number], string> = {
  hero: 'Principal (después de la bienvenida)',
  divider1: 'Divisoria 1',
  divider2: 'Divisoria 2',
  divider3: 'Divisoria 3',
  closing: 'Cierre',
};

const TITLED_SECTIONS = ['itinerary', 'gifts', 'dressCode', 'album', 'rsvp'] as const;

function Group({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: ContentSectionKey;
  title: string;
  open: boolean;
  onToggle: (id: ContentSectionKey, open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className={styles.group}
      open={open}
      onToggle={(e) => onToggle(id, (e.target as HTMLDetailsElement).open)}
    >
      <summary className={styles.summary}>{title}</summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}

/** Payment method lines: one per line in a textarea, stored as an array. */
function LinesField({ index }: { index: number }) {
  const { control } = useFormContext<ContentForm>();
  return (
    <Controller
      control={control}
      name={`private.gifts.${index}.lines`}
      render={({ field, fieldState }) => (
        <div className={ui.field}>
          <label className={ui.label} htmlFor={`gift-lines-${index}`}>
            Datos (uno por línea)
          </label>
          <textarea
            id={`gift-lines-${index}`}
            className={ui.textarea}
            value={(field.value ?? []).join('\n')}
            onChange={(e) => field.onChange(e.target.value.split('\n'))}
            onBlur={() => field.onChange((field.value ?? []).map((l) => l.trim()).filter(Boolean))}
            aria-invalid={Boolean(fieldState.error)}
            placeholder={'Cuenta: 000 000 000\nCCI: 000 000 000 000\n(Titular)'}
          />
        </div>
      )}
    />
  );
}

function SectionEntryFields({ index }: { index: number }) {
  const { control } = useFormContext<ContentForm>();
  const id = useWatch({ control, name: `public.sections.${index}.id` });
  return (
    <>
      <div className={ui.row}>
        <SelectField
          name={`public.sections.${index}.id`}
          label="Sección"
          options={SECTION_IDS.map((s) => [s, SECTION_LABELS[s]] as const)}
        />
        {id === 'photo' && (
          <SelectField
            name={`public.sections.${index}.photo`}
            label="Foto"
            options={PHOTO_SLOTS.map((s) => [s, PHOTO_LABELS[s]] as const)}
          />
        )}
        <SelectField
          name={`public.sections.${index}.decor`}
          label="Flores"
          emptyLabel="Sin flores"
          options={[
            ['left', 'A la izquierda'],
            ['right', 'A la derecha'],
          ]}
        />
      </div>
      <Toggle name={`public.sections.${index}.visible`} label="Visible" />
    </>
  );
}

/**
 * Asks the album's web app whether it answers (doGet) and fills in the Drive folder's link
 * it reports.
 */
function AlbumConnectionTest() {
  const toast = useToast();
  const { control, setValue } = useFormContext<ContentForm>();
  const url = useWatch({ control, name: 'public.album.uploadUrl' });
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    try {
      const reply = (await (await fetch(url!)).json()) as { ok?: boolean; folderUrl?: string };
      if (!reply.ok) throw new Error('bad reply');
      if (reply.folderUrl) {
        setValue('public.album.folderUrl', reply.folderUrl, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      toast('Conexión correcta: el script responde. Recuerda guardar.');
    } catch {
      toast('No respondió. ¿Implementaste como aplicación web con acceso «Cualquier usuario»?');
    } finally {
      setTesting(false);
    }
  }

  return (
    <Btn
      size="sm"
      variant="secondary"
      className={styles.inlineButton}
      onClick={test}
      disabled={!url || testing}
    >
      {testing ? 'Probando…' : 'Probar conexión'}
    </Btn>
  );
}

export function ContentPage() {
  const [open, setOpen] = useState<Set<ContentSectionKey>>(new Set(['couple']));
  const toggle = (id: ContentSectionKey, isOpen: boolean) =>
    setOpen((current) => {
      const next = new Set(current);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  const group = (id: ContentSectionKey) => ({ id, open: open.has(id), onToggle: toggle });

  return (
    <ContentEditor
      title="Contenido"
      onInvalid={(path) => {
        const section = sectionOfPath(path);
        if (section) toggle(section, true);
      }}
    >
      {() => (
        <>
          <Group {...group('couple')} title="Pareja y fecha">
            <div className={ui.row}>
              <TextField name="public.couple.bride" label="Novia" />
              <TextField name="public.couple.groom" label="Novio" />
              <TextField
                name="public.couple.monogram"
                label="Monograma"
                hint="Va en el sello, p. ej. C&J"
              />
            </div>
            <WeddingDateTimeField name="public.date" label="Fecha y hora de la boda" />
            <TextField name="public.dateIntro" label="Texto antes de la fecha" multiline />
          </Group>

          <Group {...group('welcome')} title="Bienvenida y música">
            <TextField name="public.welcome.text" label="Texto de bienvenida" multiline />
            <TextField name="public.welcome.quote" label="Frase en cursiva" multiline />
            <UploadField
              name="public.music.url"
              label="Canción (MP3)"
              accept="audio/mpeg,.mp3"
              kind="audio"
              hint="Hasta 15 MB. Empieza a sonar al abrir el sobre."
              upload={uploadMusic}
            />
            <TextField
              name="public.music.title"
              label="Texto sobre el reproductor"
              placeholder="Dale play a nuestra canción"
              emptyAsUndefined
            />
          </Group>

          <Group {...group('photos')} title="Fotos y flores">
            <div className={styles.grid}>
              {PHOTO_SLOTS.map((slot) => (
                <UploadField
                  key={slot}
                  name={`public.photos.${slot}`}
                  label={PHOTO_LABELS[slot]}
                  accept="image/*"
                  kind="image"
                  clearTo={null}
                  upload={uploadPhoto}
                />
              ))}
            </div>
            <p className={ui.hint}>
              Las fotos se reducen en tu navegador (WebP de 2000 y 1000 px) antes de subirlas.
            </p>
            <div className={styles.grid}>
              <UploadField
                name="public.decorations.cornerTL"
                label="Flores del sobre (arriba)"
                accept="image/png,image/webp"
                kind="image"
                upload={uploadDecoration}
              />
              <UploadField
                name="public.decorations.cornerBR"
                label="Flores del sobre (abajo)"
                accept="image/png,image/webp"
                kind="image"
                upload={uploadDecoration}
              />
              <UploadField
                name="public.decorations.side"
                label="Flores de las secciones"
                accept="image/png,image/webp"
                kind="image"
                hint="PNG con fondo transparente. Dónde aparecen: en «Secciones»."
                upload={uploadDecoration}
              />
            </div>
          </Group>

          <Group {...group('family')} title="Familia">
            <TextField
              name="public.family.intro"
              label="Texto antes de los padres"
              placeholder="Con nuestro amor, la bendición de Dios y la de nuestros padres:"
              emptyAsUndefined
            />
            <StringListField
              name="public.family.parents.bride"
              label="Padres de la novia"
              addLabel="Agregar"
            />
            <StringListField
              name="public.family.parents.groom"
              label="Padres del novio"
              addLabel="Agregar"
            />
            <TextField
              name="public.family.godparentsIntro"
              label="Texto antes de los padrinos"
              placeholder="Y en compañía de nuestros padrinos:"
              emptyAsUndefined
            />
            <StringListField
              name="public.family.godparents"
              label="Padrinos"
              addLabel="Agregar padrino o madrina"
            />
          </Group>

          <Group {...group('events')} title="Ceremonia y recepción">
            <ObjectListField
              name="public.events"
              label="Eventos"
              itemLabel={(i) => `Evento ${i + 1}`}
              addLabel="Agregar evento"
              newItem={() => ({
                kind: 'reception',
                title: '',
                time: '18:00',
                venue: '',
                address: '',
              })}
              render={(i) => (
                <>
                  <div className={ui.row}>
                    <SelectField
                      name={`public.events.${i}.kind`}
                      label="Tipo"
                      options={[
                        ['ceremony', 'Ceremonia'],
                        ['reception', 'Recepción'],
                      ]}
                    />
                    <TextField name={`public.events.${i}.title`} label="Título" />
                    <TextField name={`public.events.${i}.time`} label="Hora" type="time" />
                  </div>
                  <TextField name={`public.events.${i}.venue`} label="Lugar" />
                  <TextField name={`public.events.${i}.address`} label="Dirección" />
                  <TextField
                    name={`public.events.${i}.mapsUrl`}
                    label="Enlace de Google Maps"
                    type="url"
                    emptyAsUndefined
                  />
                  <TextField
                    name={`public.events.${i}.intro`}
                    label="Texto de introducción (opcional)"
                    emptyAsUndefined
                  />
                </>
              )}
            />
          </Group>

          <Group {...group('itinerary')} title="Itinerario y cierre">
            <ObjectListField
              name="public.itinerary"
              label="Actividades"
              itemLabel={(i) => `Actividad ${i + 1}`}
              addLabel="Agregar actividad"
              newItem={() => ({ time: '20:00', label: '', icon: 'heart' })}
              render={(i) => (
                <div className={ui.row}>
                  <TextField name={`public.itinerary.${i}.time`} label="Hora" type="time" />
                  <TextField name={`public.itinerary.${i}.label`} label="Actividad" />
                  <SelectField
                    name={`public.itinerary.${i}.icon`}
                    label="Ícono"
                    options={ICON_KEYS.map((k) => [k, ICON_LABELS[k]] as const)}
                  />
                </div>
              )}
            />
            <TextField name="public.closingPhrase" label="Frase de cierre" />
          </Group>

          <Group {...group('gifts')} title="Regalos">
            <TextField name="public.gifts.text" label="Texto" multiline />
            <ObjectListField
              name="private.gifts"
              label="Medios de pago (solo los ven los invitados con su enlace)"
              itemLabel={(i) => `Medio ${i + 1}`}
              addLabel="Agregar medio de pago"
              newItem={() => ({ label: '', lines: [], copy: '' })}
              render={(i) => (
                <>
                  <TextField
                    name={`private.gifts.${i}.label`}
                    label="Nombre"
                    placeholder="BCP, Yape / Plin…"
                  />
                  <LinesField index={i} />
                  <TextField
                    name={`private.gifts.${i}.copy`}
                    label="Texto que copia el botón «Copiar»"
                    hint="Por ejemplo el número de cuenta sin espacios. Vacío = sin botón."
                    emptyAsUndefined
                  />
                </>
              )}
            />
          </Group>

          <Group {...group('dressCode')} title="Dress code">
            <TextField name="public.dressCode.title" label="Código" placeholder="Elegante" />
            <StringListField name="public.dressCode.notes" label="Notas" addLabel="Agregar nota" />
          </Group>

          <Group {...group('rsvp')} title="Confirmación de asistencia">
            <div className={ui.row}>
              <DateField
                name="public.rsvp.deadline"
                label="Fecha límite"
                hint="Se puede confirmar hasta el final de ese día."
              />
              <Toggle
                name="public.rsvp.closed"
                label="Cerrar la confirmación ahora"
                hint="Aunque no haya llegado la fecha límite."
              />
            </div>
            <TextField name="public.rsvp.intro" label="Texto de introducción" multiline />
            <TextField
              name="public.rsvp.closedText"
              label="Texto cuando ya cerró"
              placeholder="La confirmación ya cerró. Si necesitas cambiar algo, escríbenos."
              emptyAsUndefined
            />
            <StringListField
              name="public.rsvp.menuOptions"
              label="Opciones de menú (vacío = no se pregunta)"
              addLabel="Agregar opción"
            />
            <fieldset className={styles.fieldset}>
              <legend className={ui.label}>Preguntas</legend>
              <Toggle
                name="public.rsvp.questions.parts"
                label="¿A qué parte asistirán? (ceremonia / recepción)"
              />
              <Toggle name="public.rsvp.questions.transport" label="¿Necesitan transporte?" />
              <Toggle name="public.rsvp.questions.lodging" label="¿Necesitan hospedaje?" />
              <Toggle name="public.rsvp.questions.song" label="Canción que no puede faltar" />
              <Toggle
                name="public.rsvp.questions.dni"
                label="DNI de cada persona (obligatorio, 8 números)"
              />
            </fieldset>
          </Group>

          <Group {...group('album')} title="Álbum y despedida">
            <Toggle name="public.album.enabled" label="Álbum de fotos activo" />
            <div className={ui.row}>
              <DateField name="public.album.opensAt" label="Abre el" />
              <DateField name="public.album.closesAt" label="Cierra el" />
            </div>
            <TextField name="public.album.text" label="Texto del álbum" multiline />
            <TextField
              name="public.album.uploadUrl"
              label="URL de la aplicación web (Google Drive)"
              placeholder="https://script.google.com/macros/s/…/exec"
              hint="La del script del álbum: Implementar → Aplicación web (ver Ajustes). Sin ella no aparece el botón para subir fotos."
              emptyAsUndefined
            />
            <AlbumConnectionTest />
            <TextField
              name="public.album.folderUrl"
              label="Enlace de la carpeta de Drive"
              placeholder="https://drive.google.com/drive/folders/…"
              hint="Se llena solo al probar la conexión. Para abrir las fotos desde el panel."
              emptyAsUndefined
            />
            <TextField name="public.farewell" label="Despedida" />
          </Group>

          <Group {...group('sections')} title="Secciones y títulos">
            <p className={ui.hint}>
              El orden de esta lista es el orden de la invitación. «Foto» puede repetirse con
              distintas fotos.
            </p>
            <ObjectListField
              name="public.sections"
              label="Secciones"
              itemLabel={(i) => `Posición ${i + 1}`}
              addLabel="Agregar sección"
              newItem={() => ({ id: 'photo', visible: true, photo: 'divider1' })}
              render={(i) => <SectionEntryFields index={i} />}
            />
            <div className={ui.row}>
              {TITLED_SECTIONS.map((section) => (
                <TextField
                  key={section}
                  name={`public.titles.${section}`}
                  label={`Título: ${SECTION_LABELS[section]}`}
                  emptyAsUndefined
                />
              ))}
            </div>
          </Group>
        </>
      )}
    </ContentEditor>
  );
}

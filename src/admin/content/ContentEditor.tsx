import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, type ReactNode } from 'react';
import {
  FormProvider,
  useForm,
  type FieldErrors,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import {
  ContentConflictError,
  useSaveContent,
  useSiteContent,
  type SiteContent,
} from '@/admin/data/content';
import { adminErrorMessage } from '@/admin/data/queries';
import { useUnsavedChanges } from '@/admin/layout/unsavedChanges';
import { Btn } from '@/admin/ui/Btn';
import { Drawer } from '@/admin/ui/Drawer';
import ui from '@/admin/ui/ui.module.css';
import { useToast } from '@/shared/toast/toastContext';
import styles from './ContentEditor.module.css';
import { contentFormSchema, toFormValues, type ContentForm } from './form';
import { PreviewFrame } from './PreviewFrame';

/** First error path in react-hook-form's nested error object (e.g. `public.events.0.time`). */
function firstErrorPath(errors: FieldErrors, prefix = ''): string | null {
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if ('message' in value && typeof value.message === 'string') return path;
    const nested = firstErrorPath(value as FieldErrors, path);
    if (nested) return nested;
  }
  return null;
}

interface ContentEditorProps {
  title: string;
  /** Called with the first invalid field when saving fails validation (e.g. to open its section). */
  onInvalid?: (path: string) => void;
  children: (form: UseFormReturn<ContentForm>) => ReactNode;
}

export function ContentEditor(props: ContentEditorProps) {
  const content = useSiteContent();
  // Bumped after reloading a newer version (conflict): starts the form over from it.
  const [generation, setGeneration] = useState(0);

  if (content.isPending) return <p className={ui.empty}>Cargando…</p>;
  if (content.isError) {
    return (
      <div className={ui.empty} role="alert">
        <p>{adminErrorMessage(content.error)}</p>
        <Btn variant="secondary" onClick={() => content.refetch()}>
          Reintentar
        </Btn>
      </div>
    );
  }
  return (
    <LoadedEditor
      key={generation}
      data={content.data}
      {...props}
      reload={async () => {
        await content.refetch();
        setGeneration((n) => n + 1);
      }}
    />
  );
}

function LoadedEditor({
  title,
  data,
  onInvalid,
  children,
  reload,
}: ContentEditorProps & { data: SiteContent; reload: () => void }) {
  const toast = useToast();
  const save = useSaveContent();
  const [conflict, setConflict] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const form = useForm<ContentForm>({
    // The schema normalizes before validating (input type unknown): the form keeps its shape.
    resolver: zodResolver(contentFormSchema) as unknown as Resolver<ContentForm>,
    defaultValues: toFormValues(data.public, data.private),
  });
  // Unsaved changes = the values differ from what was last loaded or saved. Compared as JSON,
  // which drops keys that only hold `undefined`: react-hook-form's own isDirty/dirtyFields
  // reported changes right after loading (optional fields add such keys) and missed others.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(form.getValues()));
  const [isDirty, setIsDirty] = useState(false);
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: () => setIsDirty(JSON.stringify(form.getValues()) !== savedSnapshot),
      }),
    [form, savedSnapshot],
  );
  useUnsavedChanges(isDirty);

  const submit = form.handleSubmit(
    async (values) => {
      try {
        await save.mutateAsync({ content: values, version: data.version });
        // Back to the editing shape (the saved values were normalized), so nothing looks
        // changed right after saving.
        const saved = toFormValues(values.public, values.private);
        setSavedSnapshot(JSON.stringify(saved));
        form.reset(saved);
        setIsDirty(false);
        toast('Cambios guardados');
      } catch (error) {
        if (error instanceof ContentConflictError) setConflict(true);
        else toast(adminErrorMessage(error));
      }
    },
    (errors) => {
      toast('Revisa los campos marcados');
      const path = firstErrorPath(errors);
      if (path) onInvalid?.(path);
      // Let the section open before moving focus to the field.
      if (path) setTimeout(() => form.setFocus(path as never), 50);
    },
  );

  return (
    <FormProvider {...form}>
      <div className={styles.layout}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            <Btn
              variant="secondary"
              className={styles.previewButton}
              onClick={() => setShowPreview(true)}
            >
              Vista previa
            </Btn>
          </div>

          {data.isStarter && (
            <p className={styles.notice}>
              Aún no hay contenido guardado: esto es un ejemplo. Reemplázalo con tus datos y guarda.
            </p>
          )}
          {conflict && (
            <div className={ui.errorBox} role="alert">
              <p>{new ContentConflictError().message}</p>
              <Btn size="sm" variant="secondary" onClick={reload}>
                Recargar (se pierden tus cambios)
              </Btn>
            </div>
          )}

          {children(form)}

          <div className={styles.saveBar}>
            <span className={ui.hint}>{isDirty ? 'Cambios sin guardar' : 'Todo guardado'}</span>
            <Btn type="submit" disabled={save.isPending || (!isDirty && !data.isStarter)}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Btn>
          </div>
        </form>

        <aside className={styles.preview} aria-label="Vista previa">
          <PreviewFrame control={form.control} />
        </aside>
      </div>

      {showPreview && (
        <Drawer title="Vista previa" onClose={() => setShowPreview(false)}>
          <div className={styles.drawerPreview}>
            <PreviewFrame control={form.control} fit="fill" />
          </div>
        </Drawer>
      )}
    </FormProvider>
  );
}

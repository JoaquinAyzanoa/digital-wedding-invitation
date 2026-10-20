# Google: hoja y álbum de fotos

`Code.js` hace dos cosas:

1. Copia las invitaciones y los asistentes de Supabase a una hoja de Google cada 10 minutos.
   Supabase sigue siendo la fuente de verdad: los cambios se hacen en el panel (`/login/`),
   no en la hoja (la próxima sincronización los sobrescribe).
2. Publicado como **aplicación web**, recibe las fotos que suben los invitados y las guarda,
   en su calidad original (sin comprimir), en la carpeta **«Fotos de la boda»** de tu Google
   Drive, con una subcarpeta por invitación («Familia López (abc234)»).

La hoja tiene tres pestañas:

- **Invitaciones:** una fila por invitación, con estado (Sí / No / Pendiente, con colores),
  personas, respuestas del RSVP, aperturas, notas y el link personal.
- **Asistentes:** una fila por persona confirmada, con tipo, edad, menú y restricciones.
- **Resumen:** totales con fórmulas, conteo por menú y la hora de la última sincronización.

## Configuración (una sola vez)

La hoja y las fotos pueden estar en **cuentas de Google distintas**: el mismo `Code.js` va
en dos proyectos. El panel muestra estos pasos, con botones para copiar cada valor, en
**Ajustes**.

Propiedades del script (en los dos proyectos, **Configuración del proyecto → Propiedades
del script**):

| Propiedad      | Valor                                                              |
| -------------- | ------------------------------------------------------------------ |
| `SUPABASE_URL` | `https://<proyecto>.supabase.co`                                   |
| `SUPABASE_KEY` | la clave publicable (`sb_publishable_…`)                           |
| `SECRET`       | el secreto de Ajustes (no lo compartas)                            |
| `SITE_URL`     | el dominio de la invitación, para los links personales (solo hoja) |

### 1. La hoja (cuenta A)

1. Crea una hoja en [Google Sheets](https://sheets.new) y abre **Extensiones → Apps Script**.
2. Reemplaza el contenido de `Code.gs` por el de `Code.js` (botón «Copiar código del
   script» en Ajustes) y agrega las cuatro propiedades.
3. Elige la función `setup` y pulsa **Ejecutar**. Acepta los permisos. Pone la zona
   horaria de Lima, crea el activador cada 10 minutos y hace la primera sincronización.

### 2. El álbum (cuenta B, cuyo Drive guarda las fotos)

1. Con la cuenta B, crea un proyecto en [script.google.com](https://script.google.com/home/projects/create),
   pega el mismo código y agrega `SUPABASE_URL`, `SUPABASE_KEY` y `SECRET`.
2. Elige la función `setupAlbum` y pulsa **Ejecutar**. Acepta los permisos. Crea la
   carpeta «Fotos de la boda» en el Drive de la cuenta B y registra su enlace (aparece en
   el panel).
3. **Implementar → Nueva implementación**, tipo **Aplicación web**, «Ejecutar como»:
   **Yo**, «Quién tiene acceso»: **Cualquier usuario**. Copia la URL
   (`https://script.google.com/macros/s/…/exec`) y pégala en el panel, Ajustes, paso 8.
   «Probar conexión» confirma que responde.

¿Todo en una sola cuenta? Haz los pasos del álbum en el mismo proyecto de la hoja.

Si cambias el código del álbum más adelante: **Implementar → Gestionar implementaciones →
Editar → Versión nueva**. Así la URL de la aplicación web no cambia.

Si un script falla (por ejemplo, porque se cambió el secreto), Google le envía un correo con
el error a su cuenta. Para forzar una copia completa de la hoja, vuelve a ejecutar `setup`.
Si cambias el secreto en Ajustes, actualiza `SECRET` en los dos proyectos.

## Cómo funciona

### Álbum

- El invitado elige fotos en su invitación; cada una se envía tal cual (base64 en un
  `text/plain`, sin preflight de CORS) a `doPost`, con su código.
- `doPost` pregunta a Supabase (`album_drive_check`, con el secreto) si el código existe,
  si el álbum está abierto y si no pasó de 300 fotos; guarda el archivo en Drive y lo
  registra (`register_drive_photo`) para que el panel muestre cuántas llegaron.
- Hasta 25 MB por foto. La URL de la aplicación web solo se entrega a quien tiene un código
  válido, mientras el álbum está abierto.
- Espacio: el de la cuenta del álbum (15 GB gratis, compartidos con Gmail y Fotos).

### Hoja

- `sync` llama `rpc/export_for_sheet` con el secreto y el `hash` de lo último que escribió.
  Si nada cambió, Supabase responde unos pocos bytes y la hoja no se toca; si cambió,
  reescribe las pestañas en bloque (`setValues`). `LockService` evita dos ejecuciones a la
  vez.
- Estas llamadas cada 10 minutos también mantienen activo el proyecto gratuito de Supabase
  (se pausa tras una semana sin uso). El workflow `keepalive.yml` es el respaldo diario.
- Con el secreto se puede leer la lista de invitados: si se filtra, cámbialo en Ajustes
  («Cambiar secreto») y actualiza la propiedad `SECRET`.

## Pruebas

`Code.test.ts` ejecuta el script en Node con imitaciones de los servicios de Google (hoja,
Drive, red) (`npm test`).

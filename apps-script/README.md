# Google: hoja y álbum de fotos

`Code.js` hace dos cosas, que pueden estar en **cuentas de Google distintas** (el mismo
archivo va en dos proyectos):

1. **Hoja:** copia las invitaciones y los asistentes de Supabase a una hoja de Google cada
   10 minutos. Supabase sigue siendo la fuente de verdad: los cambios se hacen en el panel
   (`/login/`), no en la hoja (la próxima sincronización los sobrescribe).
2. **Álbum:** publicado como **aplicación web**, recibe las fotos que suben los invitados y
   las guarda, en su calidad original (sin comprimir), en una carpeta de Google Drive. No
   habla con Supabase: sin códigos, sin límites y sin registrar quién subió cada foto.

La hoja tiene tres pestañas:

- **Invitaciones:** una fila por invitación, con estado (Sí / No / Pendiente, con colores),
  personas, respuestas del RSVP, aperturas, notas y el link personal.
- **Asistentes:** una fila por persona confirmada, con tipo, edad, menú y restricciones.
- **Resumen:** totales con fórmulas, conteo por menú y la hora de la última sincronización.

## Configuración (una sola vez)

El panel muestra estos pasos, con botones para copiar cada valor, en **Ajustes**.

### 1. La hoja (cuenta A)

1. Crea una hoja en [Google Sheets](https://sheets.new) y abre **Extensiones → Apps Script**.
2. Reemplaza el contenido de `Code.gs` por el de `Code.js` (botón «Copiar código del
   script» en Ajustes).
3. En **Configuración del proyecto → Propiedades del script** agrega:

   | Propiedad      | Valor                                                  |
   | -------------- | ------------------------------------------------------ |
   | `SUPABASE_URL` | `https://<proyecto>.supabase.co`                       |
   | `SUPABASE_KEY` | la clave publicable (`sb_publishable_…`)               |
   | `SECRET`       | el secreto de Ajustes (no lo compartas)                |
   | `SITE_URL`     | el dominio de la invitación, para los links personales |

4. Elige la función `setup` y pulsa **Ejecutar**. Acepta los permisos. Pone la zona
   horaria de Lima, crea el activador cada 10 minutos y hace la primera sincronización.

Si el script falla (por ejemplo, porque se cambió el secreto), Google envía un correo con el
error. Para forzar una copia completa, vuelve a ejecutar `setup`.

### 2. El álbum (cuenta B, cuyo Drive guarda las fotos)

1. Crea la carpeta en Google Drive (por ejemplo «Photos») y copia su enlace
   (`https://drive.google.com/drive/folders/…`).
2. Con la cuenta B, crea un proyecto en
   [script.google.com](https://script.google.com/home/projects/create) y pega el mismo código.
3. En sus propiedades agrega solo una: `FOLDER_ID`, con el enlace de la carpeta (o solo su
   identificador). No necesita los datos de la hoja.
4. Elige la función `setupAlbum` y pulsa **Ejecutar**. Acepta los permisos de Drive. En el
   registro aparece el nombre de la carpeta.
5. **Implementar → Nueva implementación**, tipo **Aplicación web**, «Ejecutar como»:
   **Yo**, «Quién tiene acceso»: **Cualquier usuario**. Copia la URL
   (`https://script.google.com/macros/s/…/exec`) y pégala en el panel, **Contenido →
   Álbum y despedida**. «Probar conexión» confirma que responde y completa el enlace de la
   carpeta. Guarda.

¿Todo en una sola cuenta? Haz los pasos del álbum en el mismo proyecto de la hoja.

Si cambias el código del álbum más adelante: **Implementar → Gestionar implementaciones →
Editar → Versión nueva**. Así la URL de la aplicación web no cambia. Para dejar de recibir
fotos del todo (además de cerrar el álbum en el panel), archiva la implementación.

## Cómo funciona

### Álbum

- El invitado sube fotos desde su invitación o desde `/photos/` (el QR de las mesas, que se
  descarga en el panel → Álbum). El botón solo aparece mientras el álbum está abierto
  (Contenido: activo y fechas) y conectado (la URL de la aplicación web).
- **Directo a Drive** (fotos de hasta 50 MB y videos de hasta 1 GB): el navegador pide a
  `doGet?action=session` una sesión de subida de Drive para ese archivo (tipo, tamaño exacto
  y el origen de la página, sin el cual Drive no deja usarla desde el navegador) y envía el
  archivo tal cual a Drive, en partes de 8 MB, con avance real; si se corta la conexión,
  pregunta a Drive qué tiene y sigue desde ahí. El permiso de la cuenta nunca sale del
  script: la sesión solo sirve para ese archivo. Medido: una foto de 4 MB en ~4 s, un video
  de 20 MB en ~6 s.
- **La vía antigua** (scripts anteriores a las sesiones; solo fotos de hasta 25 MB): la foto
  en base64 dentro de un `text/plain` (sin preflight de CORS, que Apps Script no responde)
  a `doPost`, que la guarda. Unos 24 s por foto de 4 MB.
- `doGet` sin parámetros responde a «Probar conexión» con el nombre y el enlace de la carpeta.
- Al actualizar el código del álbum: pégalo, ejecuta `setupAlbum` (acepta los permisos
  nuevos: crear archivos en Drive y conectarse a servicios externos) y crea una versión nueva
  de la implementación (la URL no cambia).
- Espacio: el de la cuenta B (15 GB gratis, compartidos con Gmail y Fotos).

### Hoja

- `sync` llama `rpc/export_for_sheet` con el secreto y el `hash` de lo último que escribió.
  Si nada cambió, Supabase responde unos pocos bytes y la hoja no se toca; si cambió,
  reescribe las pestañas en bloque (`setValues`). `LockService` evita dos ejecuciones a la
  vez.
- Estas llamadas también mantienen activo el proyecto gratuito de Supabase (se pausa tras
  una semana sin uso). El workflow `keepalive.yml` es el respaldo diario.
- Con el secreto se puede leer la lista de invitados: si se filtra, cámbialo en Ajustes
  («Cambiar secreto») y actualiza la propiedad `SECRET` del script de la hoja.

## Pruebas

`Code.test.ts` ejecuta el script en Node con imitaciones de los servicios de Google (hoja,
Drive, red) (`npm test`).

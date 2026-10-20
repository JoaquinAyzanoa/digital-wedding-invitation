# Google Sheet (espejo de solo lectura)

`Code.js` copia las invitaciones y los asistentes de Supabase a una hoja de Google cada
5 minutos. Supabase sigue siendo la fuente de verdad: los cambios se hacen en el panel
(`/login/`), no en la hoja (la próxima sincronización los sobrescribe).

La hoja tiene tres pestañas:

- **Invitaciones:** una fila por invitación, con estado (Sí / No / Pendiente, con colores),
  personas, respuestas del RSVP, aperturas, notas y el link personal.
- **Asistentes:** una fila por persona confirmada, con tipo, edad, menú y restricciones.
- **Resumen:** totales con fórmulas, conteo por menú y la hora de la última sincronización.

## Configuración (una sola vez)

El panel muestra estos mismos pasos, con botones para copiar cada valor, en **Ajustes →
Google Sheet**.

1. Crea una hoja en [Google Sheets](https://sheets.new) y abre **Extensiones → Apps Script**.
2. Reemplaza el contenido de `Code.gs` por el de `Code.js` (botón «Copiar código del
   script» en Ajustes).
3. En **Configuración del proyecto → Propiedades del script**, agrega:

   | Propiedad      | Valor                                                  |
   | -------------- | ------------------------------------------------------ |
   | `SUPABASE_URL` | `https://<proyecto>.supabase.co`                       |
   | `SUPABASE_KEY` | la clave publicable (`sb_publishable_…`)               |
   | `SECRET`       | el secreto de Ajustes (no lo compartas)                |
   | `SITE_URL`     | el dominio de la invitación, para los links personales |

4. Elige la función `setup` y pulsa **Ejecutar**. Acepta los permisos (es tu propio
   script). `setup` pone la zona horaria de Lima, crea el activador cada 5 minutos y hace
   la primera sincronización.

Si el script falla (por ejemplo, porque se cambió el secreto), Google envía un correo con
el error. Para forzar una copia completa, vuelve a ejecutar `setup`.

## Cómo funciona

- `sync` llama `rpc/export_for_sheet` con el secreto y el `hash` de lo último que escribió.
  Si nada cambió, Supabase responde unos pocos bytes y la hoja no se toca; si cambió,
  reescribe las pestañas en bloque (`setValues`). `LockService` evita dos ejecuciones a la
  vez.
- Estas llamadas cada 5 minutos también mantienen activo el proyecto gratuito de Supabase
  (se pausa tras una semana sin uso). El workflow `keepalive.yml` es el respaldo diario.
- Con el secreto se puede leer la lista de invitados: si se filtra, cámbialo en Ajustes
  («Cambiar secreto») y actualiza la propiedad `SECRET`.

## Pruebas

`Code.test.ts` ejecuta el script en Node con imitaciones de los servicios de Google
(`npm test`).

# Puesta en producción — lo que se configura desde fuera del código

Todo esto son clics en paneles (Supabase, tu proveedor de DNS, un servicio de
monitorización), no archivos que yo pueda entregarte. Están ordenados por lo
que bloquea a lo demás.

---

## 1. Separar pruebas de producción

Si no lo has hecho ya: un segundo proyecto en Supabase, solo para pruebas.
`js/supabase-config.js` debería elegir la URL y la clave según el dominio
desde el que se sirve la app, para no arriesgarte a probar algo contra los
datos reales de un cliente. Si quieres, lo dejo hecho en el código la próxima
vez — dímelo.

## 2. Las cuatro tareas de limpieza automática, todas juntas

Están repartidas en las tres migraciones porque cada una trae la suya, pero
se activan todas del mismo modo y en el mismo sitio. Si tu proyecto tiene la
extensión `pg_cron` (Database → Extensions → búscala y actívala si no está),
ejecuta esto una vez en el SQL Editor:

```sql
select cron.schedule('limpiar-historial', '0 3 * * *',
       $$select public.limpiar_historial_versiones()$$);
select cron.schedule('limpiar-logs', '15 3 * * *',
       $$select public.limpiar_logs_errores()$$);
select cron.schedule('vaciar-papelera', '30 3 * * *',
       $$select public.vaciar_papelera_antigua()$$);
select cron.schedule('limpiar-notificaciones', '45 3 * * *',
       $$select public.limpiar_notificaciones()$$);
```

Sin esto, ninguna de las cuatro tablas se limpia sola: no falla nada, solo
crecen sin techo. El script de `sql/diagnostico/verificar-instalacion.sql`
comprueba si estas cuatro tareas están programadas, así que después de esto
puedes volver a ejecutarlo para confirmar que ha quedado bien.

## 3. Ajustes de autenticación

Supabase → **Authentication → Settings** (o **Providers → Email**, según la
versión del panel):

- **Activar "Confirm email"**. Sin esto, cualquiera se registra con un correo
  inventado. El código ya contempla los dos casos, así que es un interruptor,
  no un cambio de código.
- **Longitud mínima de contraseña**: súbela de 6 a al menos 10.
- **"Password strength" / comprobación contra contraseñas filtradas**: actívala
  si tu plan la ofrece.
- Revisa los límites de intentos de inicio de sesión (**Rate Limits**), para
  que no se puedan probar contraseñas a lo bruto.

## 4. Plantillas de correo en español

Supabase → **Authentication → Email Templates**. Las cuatro plantillas
(confirmar registro, recuperar contraseña, cambiar correo, invitación) vienen
en inglés y con el logo de Supabase por defecto — eso genera desconfianza en
quien se registra. Cámbialas por una versión en español con tu nombre. Si
quieres, te redacto el texto de las cuatro la próxima vez; aquí no las he
tocado porque es contenido que se pega directamente en ese panel, no un
archivo del proyecto.

## 5. Región del proyecto

Si tu proyecto de Supabase no está ya en una región europea (Project
Settings → General), créalo de nuevo en una si vas a manejar datos de
clientes europeos. No se puede cambiar la región de un proyecto que ya
existe — solo migrar a uno nuevo.

## 6. Copias de seguridad

El workflow de `.github/workflows/copia-de-seguridad.yml` ya hace un volcado
diario automático (instrucciones en el propio archivo: un secreto de GitHub
con la cadena de conexión). Si en algún momento pasas al plan Pro de
Supabase, tendrás además recuperación a un punto en el tiempo activada de
serie — las dos cosas se complementan, no hace falta elegir.

## 7. Vigilar que el servicio no se caiga

Un servicio de "uptime monitoring" que compruebe cada pocos minutos que
`Dashboard_v4.html` responde, y te avise por correo o Telegram si deja de
hacerlo. [UptimeRobot](https://uptimerobot.com) y
[Better Stack](https://betterstack.com/uptime) tienen plan gratuito de sobra
para esto. Es una cuenta y una URL, cinco minutos.

## 8. Contratos de encargado del tratamiento (DPA)

Tanto Supabase como Resend, al ser quienes procesan datos personales de tus
clientes por tu cuenta, tienen que estar cubiertos por un contrato de
encargado del tratamiento (DPA, por sus siglas en inglés) para cumplir el
RGPD. Los dos ofrecen el suyo ya redactado, sin que haga falta negociar nada:

- Supabase: Project Settings → tiene un DPA estándar aceptable desde el
  panel, o en su web bajo "Legal" / "Data Processing Agreement".
- Resend: igual, disponible desde su panel o su web.

No hace falta que yo redacte esto — son los propios proveedores quienes
tienen que firmarlo, con sus propios términos.

## 9. Página de mantenimiento

`mantenimiento.html` ya está en la raíz del proyecto, con el mismo estilo
visual del panel. Cómo activarla depende de dónde publiques la app:

- **Netlify**: un archivo `_redirects` con `/*  /mantenimiento.html  200`
  activado solo mientras dure la intervención (lo añades y lo quitas), o
  usar "Deploy previews" para no tocar producción mientras migras.
- **Vercel / Cloudflare Pages**: la forma más simple es renombrar
  temporalmente `index.html` y `Dashboard_v4.html` (o mover
  `mantenimiento.html` a `index.html` un rato) mientras dure la migración de
  base de datos, y deshacerlo al terminar.

No lo he automatizado más porque depende de tu proveedor concreto — dímelo
cuando sepas cuál es y dejo el mecanismo exacto listo.

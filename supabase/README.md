# Aviso por correo — despliegue

Esto es lo único de toda la fase 2 que no puedo dejarte hecho, porque exige
cuentas y paneles a los que yo no tengo acceso (Resend, y la CLI de Supabase
conectada a tu proyecto). Son quince minutos, en este orden.

## 0. Lo que ya funciona sin hacer nada de esto

La pantalla de errores y la campanita de notificaciones **dentro de la app**
funcionan en cuanto subas el código nuevo. Esto de aquí es solo para que,
además, llegue un correo.

## 1. Cuenta de correo transaccional

Crea una cuenta en [Resend](https://resend.com) (tiene plan gratuito de sobra
para empezar). Verifica tu dominio: Resend te da tres registros DNS (SPF, DKIM
y un registro de retorno) que añades donde tengas gestionado el dominio.
Sin esto, tus correos llegarán a la carpeta de spam de la mitad de tus
clientes, así que no te lo saltes.

Cuando el dominio esté verificado, apunta el correo de envío, por ejemplo
`avisos@tudominio.com`.

## 2. Instalar la CLI de Supabase (una vez)

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU-PROJECT-REF
```

El `project-ref` lo ves en la URL del panel de Supabase de tu proyecto.

## 3. Generar los dos secretos propios

No hace falta que signifiquen nada, solo que sean largos y aleatorios:

```bash
openssl rand -hex 32   # para UNSUB_SECRET
openssl rand -hex 32   # para WEBHOOK_SECRET
```

Guarda los dos valores; los necesitas en el paso siguiente y en el paso 5.

## 4. Configurar los secretos de las funciones

```bash
supabase secrets set \
  RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxx" \
  EMAIL_FROM="VIABLE <avisos@tudominio.com>" \
  APP_URL="https://tu-dominio-donde-vive-el-panel.com" \
  UNSUB_SECRET="el-primer-valor-del-paso-3" \
  WEBHOOK_SECRET="el-segundo-valor-del-paso-3"
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` no hace falta ponerlos: Supabase
los inyecta solo en toda Edge Function.

## 5. Desplegar las dos funciones

```bash
supabase functions deploy notificar-por-email --no-verify-jwt
supabase functions deploy baja-notificaciones --no-verify-jwt
```

`--no-verify-jwt` es necesario porque a estas dos las llama el propio servidor
de Supabase (una) y un clic desde un correo sin sesión (la otra) — ninguna de
las dos tiene un usuario de la app detrás con un token que verificar. La
protección de `notificar-por-email` está en el `WEBHOOK_SECRET` del paso
siguiente; la de `baja-notificaciones`, en la firma que lleva el propio enlace.

## 6. El Database Webhook

Esto es lo que conecta "se ha compartido un estudio" con "se llama a la
función". Panel de Supabase → **Database → Webhooks → Create a new webhook**:

| Campo | Valor |
|---|---|
| Name | `notificar_estudio_compartido` |
| Table | `estudios_compartidos` |
| Events | solo `Insert` |
| Type | `HTTP Request` |
| Method | `POST` |
| URL | `https://TU-PROJECT-REF.supabase.co/functions/v1/notificar-por-email` |
| HTTP Headers | añade una cabecera `x-webhook-secret` con el mismo valor de `WEBHOOK_SECRET` del paso 3 |

Guarda. A partir de aquí, cada vez que alguien comparta un estudio, Supabase
llama a la función sola.

## 7. Probarlo

Comparte un estudio de prueba contigo mismo con otra cuenta, o pide a alguien
del equipo que te lo comparta. Si no llega:

1. Panel de Supabase → **Edge Functions → notificar-por-email → Logs**. Ahí
   sale el motivo exacto (secreto incorrecto, dominio no verificado en Resend,
   preferencia en "nunca"…).
2. Comprueba en la tabla `preferencias_notificacion` que esa persona no tiene
   `modo = 'nunca'`.
3. Revisa la carpeta de spam del destinatario la primera vez: si los registros
   DNS de Resend son muy recientes, puede tardar un rato en propagarse la
   reputación del dominio.

## Lo que falta para el resumen diario

Ahora mismo, quien elige "Resumen diario" en sus preferencias **no recibe
correo**: la función lo detecta y se calla, en vez de mandarlo al momento. Lo
que falta es una tercera función con un disparador de tiempo (`pg_cron` o un
Scheduled Trigger de Supabase) que, una vez al día, agrupe lo pendiente de
cada persona en ese modo y mande un solo correo. No está construida todavía
porque antes hace falta decidir un detalle de producto: qué se considera
"pendiente" (¿todo lo no leído del día, o todo lo no leído desde el último
resumen?). Cuando quieras esta pieza, dímelo y la construyo.

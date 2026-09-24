<!-- BORRADOR — ver legal/LEEME-ANTES-DE-USAR.md antes de usar esto. -->

# Política de Privacidad

## 1. Responsable del tratamiento

- **Responsable:** [NOMBRE COMPLETO O RAZÓN SOCIAL]
- **NIF/CIF:** [NÚMERO]
- **Domicilio:** [DIRECCIÓN]
- **Correo de contacto para temas de privacidad:** [CORREO]
- **Delegado de Protección de Datos (si aplica):** [NOMBRE Y CONTACTO, o
  indicar que no es obligatorio a tu tamaño actual]

## 2. Qué datos se tratan

| Categoría | Ejemplos | De dónde sale |
|---|---|---|
| Datos de cuenta | Nombre, correo electrónico, contraseña (cifrada), empresa a la que perteneces, rol | Los que das al registrarte |
| Datos de uso de la plataforma | Estudios de viabilidad que creas (nombre del proyecto, ubicación, supuestos económicos, resultados), plantillas de supuestos, con quién compartes cada estudio | Tu actividad normal dentro de la app |
| Datos técnicos | Dirección IP y navegador en el momento de un error (solo si ocurre un fallo técnico), fecha y hora de acceso | Automático, para poder diagnosticar problemas |
| Comunicaciones | Preferencia de recibir avisos por correo, y el propio historial de esos avisos | Lo que configuras en "Preferencias de aviso" |

**Un matiz importante sobre los estudios:** un estudio de viabilidad puede
contener datos de un solar o de una promoción concreta (ubicación, precio de
compra, condiciones con un propietario del suelo). Si esos datos identifican
a una persona física (por ejemplo, el nombre de un propietario particular
del suelo, no de una empresa), esos datos también son datos personales de
esa tercera persona, y quien los introduce en la plataforma (tú o tu equipo)
actúa como responsable de ese tratamiento frente a esa persona — VIABLE, en
ese caso, actúa como encargado del tratamiento por cuenta tuya, no como
responsable. [Esto conviene revisarlo con detalle si vais a introducir datos
de propietarios particulares con frecuencia.]

## 3. Con qué finalidad y con qué base legal

| Finalidad | Base legal (art. 6 RGPD) |
|---|---|
| Prestar el servicio: crear tu cuenta, guardar tus estudios, mostrarte el panel | Ejecución del contrato (6.1.b) |
| Enviarte avisos cuando alguien te comparte un estudio | Ejecución del contrato, y siempre puedes desactivarlo desde "Preferencias de aviso" |
| Diagnosticar errores técnicos | Interés legítimo (6.1.f) en mantener el servicio funcionando |
| Facturación [cuando esté activa] | Ejecución del contrato y obligación legal (6.1.b y 6.1.c) |
| Comunicaciones comerciales sobre el propio producto | Consentimiento (6.1.a), separado y revocable en cualquier momento |

## 4. Cuánto tiempo se conservan los datos

Estos plazos no son una promesa genérica: son los que de verdad ejecuta la
base de datos de la plataforma, de forma automática:

- **Historial de versiones de un estudio:** se conservan las 15 versiones
  más recientes, más una copia por día de las anteriores. El resto se borra.
- **Registro de errores técnicos:** 90 días.
- **Estudios eliminados (papelera):** 30 días, tras los cuales se borran de
  forma definitiva junto con su historial.
- **Notificaciones dentro de la app:** las leídas, 30 días; las no leídas,
  180 días.
- **Datos de cuenta y estudios activos:** mientras la cuenta permanezca
  activa, y [PLAZO A DEFINIR] tras solicitar su baja, salvo obligación legal
  de conservarlos más tiempo (por ejemplo, facturación).

## 5. Con quién se comparten los datos

No se venden datos a nadie. Se comparten con estos encargados del
tratamiento, estrictamente para poder prestar el servicio:

| Proveedor | Para qué | Dónde |
|---|---|---|
| Supabase | Base de datos, autenticación y almacenamiento | [Región del proyecto — indícalo cuando lo confirmes] |
| Resend | Envío de los correos de aviso | [Consultar su documentación de ubicación de procesamiento] |
| [Tu proveedor de hosting: Netlify / Vercel / Cloudflare] | Servir la propia página web | [Su ubicación] |

Con cada uno de ellos debe existir un contrato de encargado del tratamiento
vigente — ver `herramientas/produccion.md`, punto 8.

Además, si compartes un estudio con una persona de otra organización (un
bróker, otra promotora), esa persona ve el contenido del estudio que le
compartas, de forma explícita y solo porque tú has decidido compartirlo.

## 6. Transferencias internacionales

[A rellenar según dónde estén alojados Supabase y Resend en tu configuración
concreta: si es dentro del Espacio Económico Europeo, basta con decirlo; si
no, hace falta detallar la garantía aplicable — cláusulas contractuales
tipo, adecuación, etc. Esto lo tiene que confirmar quien revise el
documento, mirando la configuración real de cada proveedor.]

## 7. Tus derechos

Como persona cuyos datos se tratan, puedes ejercer en cualquier momento:

- **Acceso:** saber qué datos tuyos se tratan.
- **Rectificación:** corregir datos inexactos.
- **Supresión:** pedir que se borren (con las excepciones legales que
  correspondan, como obligaciones de facturación).
- **Limitación y oposición:** restringir o rechazar ciertos tratamientos.
- **Portabilidad:** recibir tus datos en un formato reutilizable — la
  propia app ya te lo permite en gran parte a través de la exportación a
  JSON de cada estudio.

Para ejercerlos: [CORREO DE CONTACTO]. Si no quedas satisfecho con la
respuesta, puedes reclamar ante la Agencia Española de Protección de Datos
(www.aepd.es).

## 8. Seguridad

Los datos se protegen mediante control de acceso por roles y políticas de
seguridad a nivel de fila en la base de datos (cada empresa solo ve sus
propios datos, salvo lo que decida compartir explícitamente), cifrado en
tránsito (HTTPS) y registro de errores para detectar incidencias. [Añade
aquí cualquier medida adicional real que implementes: 2FA, auditorías, etc.]

## 9. Cambios en esta política

Se avisará de cualquier cambio sustancial [a través de — define el canal:
correo, aviso dentro de la app] con antelación razonable.

---
*Última revisión: [FECHA] — pendiente de validación legal, ver
`LEEME-ANTES-DE-USAR.md`.*

# Textos legales — léelo antes de usar nada de esta carpeta

**No soy abogado, y esto no es asesoramiento legal.** Lo que hay en esta
carpeta son borradores de partida: la estructura habitual de estos tres
documentos para un SaaS español que trata datos personales, con huecos
marcados `[ENTRE CORCHETES]` donde va información tuya que yo no puedo
rellenar sin inventarla.

**No los publiques tal cual.** Antes de que sean visibles para un solo
cliente, que los revise un abogado familiarizado con protección de datos
(RGPD/LOPDGDD) y comercio electrónico (LSSI-CE) en España — más aún tratando
información financiera de terceros, con clientes que van desde promotoras
hasta captadores freelance, y en un producto donde algún día habrá pagos de
por medio.

Cosas concretas donde un borrador genérico se queda corto y un abogado sí
puede evaluarlas con tu caso real:

- Si vas a facturar a empresas de otros países de la UE (o fuera), hay
  matices de IVA y de ley aplicable que esto no cubre.
- Qué pasa exactamente con los datos de un estudio cuando una cuenta se da
  de baja, sobre todo si ese estudio se compartió con gente de otra empresa
  (un bróker, un family office) — el reparto de responsabilidad entre
  "quién es el dueño de ese dato" no es automático en un SaaS multiempresa.
- Si vas a construir con los estudios de tus clientes una base de precios de
  mercado agregada (lo comenté en la hoja de ruta original, sección de
  Configuración maestra) hace falta decirlo aquí explícitamente y de forma
  que sea válido — no se puede añadir después sin pedir permiso otra vez.
- Las condiciones de pago, reembolsos y cancelación, en cuanto actives la
  fase de facturación.

## Qué SÍ he podido dejar preciso

Las partes que describen CÓMO funciona la app por dentro (qué se guarda,
cuánto tiempo, con qué proveedores) las he escrito a partir del código real
que hemos construido juntos, no de plantilla genérica: los plazos de
retención son los que de verdad implementan las funciones de limpieza de
`sql/00-esquema-completo.sql` y `sql/01-notificaciones.sql`, y los
proveedores listados (Supabase, Resend) son los que la app usa de verdad. Esa
parte, un abogado la revisa más rápido porque ya está pegada a la realidad.

## Los tres archivos

- `aviso-legal.md` — identificación del titular, obligatorio en España para
  cualquier sitio con actividad comercial (LSSI-CE).
- `politica-privacidad.md` — RGPD: qué datos se tratan, con qué base legal,
  cuánto tiempo, y los derechos de quien los ha dado.
- `condiciones-de-uso.md` — el contrato con quien usa la app: qué puede
  hacer, qué no, y los límites de responsabilidad del propio cálculo (esto
  último enlaza con el aviso legal fijo que ya lleva cada PDF que genera la
  app, en `js/engine.js` — no hay que repetirlo, sí ser coherente con él).

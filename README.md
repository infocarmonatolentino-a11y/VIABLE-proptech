# VIABLE — versión 1.3.1

Estudio de viabilidad de promociones inmobiliarias, con panel de gestión..

**Esta carpeta sustituye entera a la que tenías.** No hay que mover archivos
sueltos ni copiar nada a mano: descomprime, y esta pasa a ser tu carpeta de
trabajo. Lo único que hay que hacer aparte es ejecutar un script SQL, que se
explica abajo.

---

## Qué hay aquí

### Las dos páginas

| Archivo | Qué es |
|---|---|
| `Dashboard_v4.html` | El panel, la Torre de Control. Es por donde se entra. Login, lista de estudios, compartición, Vista de equipo y Configuración maestra. |
| `index.html` | La app de viabilidad: las once secciones de datos, las hojas de cálculo y las herramientas de negociación. Funciona sola sin internet, y también conectada al panel. |

Las dos comparten sesión porque están en la misma carpeta: `supabase-js` guarda
la sesión en el navegador y la pestaña nueva la recoge.

### El motor y la app de viabilidad (`js/`)

| Archivo | Qué hace |
|---|---|
| `engine.js` | **El cálculo.** TIR, MIRR, VAN, payback, cash-flow mensual, cascada de IVA e ITP con varios propietarios, permutas, VPO, LTC y LTV, condicionante de preventas, escenarios y puntos de equilibrio. Todo lo demás es interfaz alrededor de este archivo. |
| `state.js` | Los datos del estudio en memoria, el autoguardado, la biblioteca local de estudios y las migraciones que hacen que un estudio de hace meses siga abriéndose hoy. |
| `config.js` | Los umbrales que fija Dirección (margen mínimo, tipo de interés…). El panel los inyecta aquí al abrir un estudio. |
| `ui-inputs.js` | Las once secciones de entrada de datos. |
| `ui-outputs.js` | Ingresos, costes, financiación, cash-flow, resumen, sensibilidad y el valorador de suelo. |
| `express.js` | El cálculo rápido sin anteproyecto, y la subida del logo para el PDF. |
| `ofertas.js` | El comparador de ofertas de compra del suelo. |
| `format.js` | Formato de euros, porcentajes y números. |
| `bridge.js` | El puente con el panel: carga el estudio, controla los permisos, guarda, detecta que otra persona ha guardado encima. |
| `supabase-config.js` | La dirección del proyecto Supabase y su clave pública. |

### Lo nuevo de esta versión (`js/`)

| Archivo | Qué hace |
|---|---|
| `dialogo.js` | **Todos los avisos de la app.** Sustituye a las 44 llamadas a los cuadros del navegador. Da `toast()`, `confirmar()`, `pedirTexto()`, `pedirCampos()`, `avisar()` y `confirmarEscribiendo()`. Lo usan las dos páginas. |
| `reportar.js` | **El registro de errores.** Sustituye al antiguo `error-logger.js` y a la copia que estaba dentro del panel. Captura los fallos automáticos y, sobre todo, da `reportar(contexto, error)` para registrar los errores de base de datos que antes solo iban a la consola. |

`js/error-logger.js` ya no existe: hacía lo mismo que `reportar.js` pero peor y
por duplicado.

### Base de datos (`sql/`)

| Archivo | Qué es |
|---|---|
| `00-esquema-completo.sql` | **El esquema entero.** Levanta la base de datos desde un proyecto vacío y también se puede ejecutar sobre el tuyo actual sin romper nada. Se puede lanzar las veces que haga falta. |
| `01-notificaciones.sql` | Notificaciones dentro de la app, preferencias de aviso por correo, y las funciones que agrupan `logs_errores` por huella. |
| `02-configuracion-por-municipio.sql` | El catálogo de municipios, el catálogo de parámetros de referencia (precio de venta, coste de obra, ITP…) y la cascada municipio → empresa. |
| `diagnostico/verificar-instalacion.sql` | **Nuevo.** Un solo script de solo lectura que comprueba que las tres migraciones han quedado bien: tablas, RLS, funciones, disparadores y datos de arranque. Cómodo de volver a lanzar cuando quieras confirmar el estado. |
| `demo/seed-demo.sql` | **Nuevo.** Cuatro estudios de ejemplo, variados, para enseñar el producto sin abrir los datos de un cliente real. Instrucciones dentro del propio archivo. |
| `historico/` | Los cuatro scripts antiguos de antes de la v1.0.0. Ya no hacen falta: están aquí solo como registro de lo que se ejecutó en su día. |

### Importar el catálogo completo de municipios (`herramientas/`)

| Archivo | Qué es |
|---|---|
| `herramientas/importar-municipios-ine/` | **Nuevo.** Dos scripts de Node.js que descargan de la API del INE los 8.100 municipios de España y los dejan en un CSV listo para importar. Léelo antes de ejecutarlo: no he podido probarlo contra la API real. |
| `herramientas/produccion.md` | **Nuevo.** Todo lo de la fase 4 que se configura en paneles externos (Supabase, DNS, monitorización), no con código: autenticación, plantillas de correo, región, DPA, mantenimiento. |

### Publicar la app (`hosting/`, `mantenimiento.html`, `.github/`)

| Archivo | Qué es |
|---|---|
| `hosting/_headers` | **Nuevo.** Cabeceras de seguridad para Netlify y Cloudflare Pages. |
| `hosting/vercel.json` | **Nuevo.** Las mismas cabeceras, en formato Vercel. |
| `hosting/README.md` | **Nuevo.** El porqué de cada cabecera, y el compromiso que asume la CSP con el código de hoy — léelo. |
| `mantenimiento.html` | **Nuevo.** Página para servir mientras se hace una migración de base de datos. |
| `.github/workflows/copia-de-seguridad.yml` | **Nuevo.** Copia de seguridad diaria automática de la base de datos, sin depender del plan de pago de Supabase. |

### Textos legales (`legal/`)

| Archivo | Qué es |
|---|---|
| `legal/LEEME-ANTES-DE-USAR.md` | **Léelo primero.** Son borradores, no documentos listos para publicar — no soy abogado. |
| `legal/aviso-legal.md`, `politica-privacidad.md`, `condiciones-de-uso.md` | **Nuevos.** Estructura habitual de los tres, con los plazos de retención y proveedores reales de la app ya rellenados, y huecos marcados para lo que solo puedes rellenar tú (o tu abogado). |

### El correo (`supabase/`)

| Archivo | Qué es |
|---|---|
| `supabase/functions/notificar-por-email/` | Edge Function que manda el correo cuando se comparte un estudio, si la persona no lo ha desactivado. |
| `supabase/functions/baja-notificaciones/` | Edge Function del enlace "dejar de recibir avisos" de cada correo. Funciona sin sesión iniciada. |
| `supabase/README.md` | **Léelo antes de tocar nada de esto.** Son los únicos pasos de toda la fase 2 que no puedo dejarte hechos: cuenta de Resend, verificación del dominio y el Database Webhook que conecta una cosa con la otra. |

### Pruebas (`test/`)

| Archivo | Qué es |
|---|---|
| `motor.test.js` | 131 comprobaciones sobre el motor de cálculo. Se ejecuta con `node test/motor.test.js`. Antes de publicar cualquier cambio que toque `engine.js`, ejecútalo. |

---

## Qué hacer ahora, por orden

**1. Ejecuta el SQL.** Supabase → SQL Editor → pega `sql/00-esquema-completo.sql`
entero → Run. Es la parte que no puedo hacer yo.

**2. Date de alta como dueño de la plataforma.** En el mismo editor SQL, con tu
correo:

```sql
insert into public.plataforma_admins (perfil_id, nota)
select id, 'Dueño del producto' from auth.users
where email = 'tu-correo@ejemplo.com'
on conflict (perfil_id) do nothing;
```

Esto es distinto de ser Dirección de tu empresa. Dirección manda en **su**
organización; esto te deja ver lo que pasa en **todas** las empresas clientes.
Hace falta para la pantalla de errores de la fase 2.

**3. Sube la carpeta** donde la tengas publicada y entra.

**4. Comprueba que el registro de errores funciona.** Usa la app un rato y
luego, en el editor SQL:

```sql
select app, contexto, count(*), max(created_at)
from public.logs_errores group by app, contexto order by 4 desc;
```

Si después de usarla un rato la tabla sigue vacía, avísame: querría decir que
el registro sigue fallando en silencio, que es justo lo que pasaba antes.

---

## Qué ha cambiado en la 1.3.1 (dos fallos reales, encontrados en producción)

Dos correcciones, encontradas gracias a que ya estás usando la app de
verdad — esto es exactamente para lo que sirve tener el registro de errores
y el diagnóstico funcionando.

### Un estudio compartido de otra empresa se podía editar, y al guardar fallaba

Lo reportaste tú: al abrir un estudio que te había compartido otra empresa,
los campos no salían bloqueados, y al guardar saltaba un error de "0 filas".
La causa: `js/bridge.js` decidía si el estudio era editable mirando solo si
tú lo habías creado, o si eras Dirección — pero "Dirección" de qué empresa no
se comprobaba. Si eras Dirección de LA TUYA, la pantalla se desbloqueaba
igualmente para un estudio de una empresa ajena. La base de datos sí lo
comprobaba bien (por eso el guardado fallaba), pero la pantalla no reflejaba
ese límite, así que parecía roto en vez de simplemente no permitido.

Arreglado en una línea, comprobando también que el estudio sea de tu propia
empresa — ahora es un espejo exacto de la política de seguridad de la base
de datos. Con esto, un estudio ajeno sale bloqueado desde el primer momento,
con el aviso "Solo lectura" en la barra, tal como ya estaba pensado que
pasara.

### Cuatro empresas se quedaron sin ningún parámetro de referencia seguido

Tu diagnóstico lo señaló ("Empresas sin ningún parámetro seguido: AVISO").
La causa estaba en el propio `sql/02-configuracion-por-municipio.sql`: la
sección que siembra automáticamente dos parámetros a cada empresa ya
existente se ejecutaba ANTES de que el catálogo de esos parámetros tuviera
ninguna fila todavía — así que esa siembra no encontraba nada que copiar.

El archivo ya está reordenado para que esto no le pase a nadie que instale
desde cero a partir de ahora. Para tu base de datos, que ya está en marcha,
hay un parche de una sola sentencia:
`sql/diagnostico/parche-parametros-seguidos.sql` — ejecútalo una vez, y
`verificar-instalacion.sql` debería mostrar ese aviso en 0.

### Además

- `hosting/vercel.json` ahora redirige la raíz del dominio (`/`) a
  `Dashboard_v4.html`, para que quien entre por el dominio vea el panel de
  acceso en vez de la calculadora suelta. `index.html` sigue funcionando
  igual en su propia ruta — Dashboard lo abre así, con `#id=...`.

## Qué ha cambiado en la 1.3.0 (fase 4)

Esta fase es distinta de las tres anteriores: la mayor parte no es código que
yo pueda dejarte funcionando, porque exige cuentas y paneles a los que no
tengo acceso (tu proveedor de hosting, Resend, el propio Supabase). Lo que
he podido, lo he dejado hecho; el resto, documentado paso a paso en
`herramientas/produccion.md`.

### Verificación de un vistazo

`sql/diagnostico/verificar-instalacion.sql` es un script nuevo, de solo
lectura: pégalo en el SQL Editor y en una sola tabla te dice si las tres
migraciones han quedado bien — tablas, seguridad a nivel de fila, funciones,
disparadores, y si el catálogo de arranque (municipios y parámetros) está
completo. Se puede lanzar las veces que haga falta, no cambia nada.

### El catálogo completo de municipios, con la API que encontraste

`herramientas/importar-municipios-ine/` trae dos scripts de Node.js que usan
la API del INE (Tempus3) para descargar los 8.100 municipios de España y
dejarlos en un CSV listo para importar. Aviso honesto: no he podido probarlo
contra la API real — mi entorno de trabajo no tiene salida a `ine.es` — así
que el segundo script está escrito para avisar con claridad si el formato de
respuesta no es el esperado, en vez de generar un CSV con columnas vacías
sin decirlo. El camino manual (descargar el Excel oficial del INE) sigue
disponible y documentado, por si el de la API da guerra.

### Seguridad al publicar

`hosting/_headers` (Netlify, Cloudflare Pages) y `hosting/vercel.json`
(Vercel) traen la Content-Security-Policy y el resto de cabeceras. Con un
matiz importante que está explicado en `hosting/README.md`: la CSP lleva
`'unsafe-inline'` porque el JavaScript del panel vive hoy en un único bloque
dentro del propio HTML, no en un archivo aparte. Sigue mereciendo la pena,
pero no es una CSP "fuerte" del todo — y ahí queda explicado por qué, y qué
haría falta para cerrarla.

### Copias de seguridad, sin depender de un plan de pago

`.github/workflows/copia-de-seguridad.yml` hace un volcado completo de la
base de datos cada noche y lo guarda como adjunto del propio workflow, con
un secreto de GitHub como única configuración. Incluye también un segundo
trabajo, manual, que restaura ese volcado sobre un Postgres limpio dentro
del propio runner para comprobar que la copia sirve de verdad — una copia
que nunca se ha intentado restaurar no es una copia de seguridad, es una
promesa.

### Página de mantenimiento y entorno de demostración

`mantenimiento.html`, con el mismo estilo visual del panel, para servir
mientras se hace una migración de base de datos. Y `sql/demo/seed-demo.sql`,
que mete cuatro estudios de ejemplo variados (uno con permuta, uno con VPO,
uno con riesgo alto) en una cuenta que tú creas normalmente — con un límite
a propósito: los cuatro abren por dentro el mismo caso de ejemplo de fábrica,
lo que varía es cómo se organizan y se listan en el panel. Está explicado en
el propio script por qué no fui más allá esta vez.

### Textos legales — borradores, no documentos listos

`legal/` trae la estructura habitual de aviso legal, política de privacidad
y condiciones de uso para un SaaS español que trata datos personales, con
los plazos de retención y los proveedores (Supabase, Resend) ya rellenados a
partir del código real — y huecos marcados con corchetes donde va
información que solo tú tienes, o que debe fijar un abogado. **No los
publiques sin que los revise uno**, sobre todo en las partes que dependen de
cómo factures y de qué pasa con los datos de un estudio compartido entre
empresas distintas. Todo esto, con más detalle, en
`legal/LEEME-ANTES-DE-USAR.md`.

### Lo que falta de esta fase, y por qué

Los ajustes de autenticación de Supabase (confirmación de correo, mínimo de
contraseña, plantillas en español), la región del proyecto, los DPA de
Supabase y Resend, y la vigilancia de caídas: todo eso son clics en paneles
externos, no algo que pueda dejarte en un archivo. Está cada uno explicado
paso a paso en `herramientas/produccion.md`, en el orden en que tiene
sentido hacerlos.

## Qué ha cambiado en la 1.2.0 (fase 3)

### Configuración maestra ya no tiene cuatro campos fijos para toda España

Hay una sección nueva dentro de "Configuración maestra": **Referencias de
mercado por municipio**. En vez de los cuatro campos de siempre, hay un
catálogo de parámetros (precio de venta, coste de obra, repercusión de suelo,
ITP, ICIO, tasa de licencia, plazo de licencia, alquiler) del que Dirección
elige cuáles quiere gestionar, y una rejilla municipio × parámetro donde cada
ciudad puede tener su propio valor. Lo que no se sobrescribe en un municipio
hereda el valor de empresa — en cursiva gris, para que se vea de un vistazo
qué es propio y qué es heredado.

Si el catálogo de ocho no basta, hay un enlace para crear un parámetro
propio, con su nombre y su unidad. Y si falta un municipio, se añade
escribiéndolo, sin esperar a nadie.

Trae un arranque de las 59 ciudades más grandes de España para que la
pantalla no aparezca vacía el primer día, sin código INE — es un dato oficial
y hay que importarlo del catálogo real, no inventarlo. Las instrucciones para
importarlo están al final de `sql/02-configuracion-por-municipio.sql`.

### El estudio sabe de qué municipio es

Al crear un estudio hay un selector de municipio, y si ese municipio tiene
referencias configuradas, se enseñan nada más crearlo. También se puede fijar
o cambiar desde la ficha de cualquier estudio ya existente, donde aparece el
mismo resumen de referencias.

**Con un límite, a propósito:** esas referencias son para *consultar*, no se
trasladan solas a los campos del motor de cálculo. Decidir a qué campo exacto
de la sección 4 corresponde cada uno de los ocho parámetros — y con qué
unidades — es la pieza natural siguiente, pero hacerlo deprisa y mal sería
peor que dejarlo para cuando se pueda revisar con calma. Dímelo cuando quieras
que la construya.

### Lo que NO ha cambiado

Los cuatro campos de siempre (margen mínimo, tipo de interés, régimen fiscal,
y los dos umbrales de coste y precio) siguen exactamente igual, con el mismo
significado: reglas de empresa, iguales para todos los municipios. Esto de
aquí es un sistema nuevo y adicional, no una migración de esos datos.

## Qué ha cambiado en la 1.1.0 (fase 2)

### Hay una pantalla de errores, agrupada de verdad

Nueva vista **Errores**, solo visible si estás dado de alta como dueño de la
plataforma (instrucciones en `sql/00-esquema-completo.sql`, sección final).
Enseña los errores de **todas** las empresas, agrupados por huella: cuántas
veces ha pasado, a cuántas personas y a cuántas empresas, cuándo fue la
primera y la última vez. Se puede filtrar por app, por estado y por periodo,
marcar cada grupo como resuelto o ignorado, y ver el detalle de los últimos
veinte casos de cualquier grupo (con su URL, su versión y su traza).

Esto sustituye a la consulta SQL manual con la que vigilabas los errores hasta
ahora. Sigue funcionando si la quieres usar, pero ya no hace falta.

### Hay notificaciones dentro de la app

La campanita de la topbar. Se enciende sola cuando alguien te comparte un
estudio, y también cuando alguien abre por primera vez uno que tú compartiste
— así sabes no solo que lo enviaste, sino que lo han mirado. Se actualiza en
vivo, sin recargar la página.

### Hay aviso por correo, con una parte que depende de ti

Cuando alguien recibe un estudio, además del aviso dentro de la app, le puede
llegar un correo. Cada persona elige si lo quiere al momento, en un resumen
diario (la agrupación en sí todavía no está construida, ver
`supabase/README.md`) o nunca, desde el botón "Preferencias" de la campanita.
El correo lleva su enlace de baja de un clic, que funciona sin iniciar sesión,
como exige la normativa europea.

**Esta parte no viene activada.** Levantar el esquema no es suficiente:
necesita una cuenta de Resend con el dominio verificado y dos Edge Functions
desplegadas. Todo el detalle, paso a paso, en `supabase/README.md`. Sin ese
paso, todo lo demás de la app funciona igual — solo que nadie recibe el
correo.

## Qué cambió en la 1.0.0 (fase 1)

### Se ha cerrado una fuga de datos entre empresas

El canal de presencia (el contador de «en línea» del panel) usaba un nombre
literal, el mismo para todos los usuarios del proyecto. La presencia de
Supabase no pasa por las políticas de seguridad, así que cada persona veía el
nombre y las iniciales de quien estuviera conectado **en cualquier otra empresa
cliente**. Ahora el canal es por organización.

### La tabla de errores existe

`logs_errores` no se creaba en ningún script, aunque el código escribiera en
ella desde dos sitios. Los dos registros tragaban cualquier fallo en silencio,
a propósito, así que no había forma de saber si estaba funcionando. Ahora está
creada, con sus políticas y con una columna de huella que agrupa el mismo error
repetido.

Y lo más importante: los **43** errores de base de datos que antes solo iban a
la consola del navegador ahora se registran con su contexto. Eran la mayoría de
lo que falla de verdad (permisos, red, políticas de seguridad) y ninguno llegaba
a ninguna parte.

### Ya no hay cuadros de diálogo del navegador

Las 44 llamadas a `alert`, `confirm` y `prompt` han desaparecido. Además de que
quedaban mal, tenían un problema serio: cuando alguien marca la casilla de
«impedir que esta página cree cuadros de diálogo» que ofrece el navegador tras
el segundo o tercero seguido, `confirm()` pasa a devolver «no» siempre. Para esa
persona, la app dejaba de poder crear estudios o borrar filas, sin ningún error
visible.

Crear un estudio ya no son dos cuadros encadenados, sino uno solo con los dos
campos: se ve lo que se está creando y se puede corregir sin volver a empezar.

### Eliminar un estudio ya no es irreversible

Hay papelera. Un estudio eliminado se queda 30 días en la Vista de equipo antes
de borrarse de verdad, y se puede restaurar. Antes, un delegado que se
equivocaba de fila perdía semanas de trabajo sin vuelta atrás.

### La Vista de equipo enseña lo que pidas

Sale el nombre de quien creó cada estudio, y hay un selector de columnas con
catorce datos para elegir: viviendas, densidad frente al máximo, superficie del
solar, techo sobre rasante, precio de venta por m², coste de obra por m²,
repercusión del suelo por vivienda, porcentaje de VPO, VAN, riesgo… Cada persona
elige las suyas y se le recuerdan.

Esto funciona porque la app de viabilidad ahora guarda un resumen de métricas
al guardar el estudio. **Los estudios antiguos no lo tienen todavía**: sus
columnas nuevas saldrán con un guion hasta que alguien los abra y los vuelva a
guardar una vez. Es normal y se arregla solo con el uso.

### Se puede dar de baja a alguien

Antes solo se podía ascender o bajar de rol. Ahora se le puede retirar el
acceso, y antes de hacerlo la app ofrece **pasar sus estudios a otra persona**,
porque si no quedan a nombre de alguien que ya no entra y nadie sabe quién se
ocupa de ellos.

No se borra a nadie, se desactiva. Borrar de verdad exige una clave que no
puede estar en el navegador, y rompería la autoría de los estudios: años de
histórico desaparecerían porque alguien cambió de empresa. Un perfil dado de
baja no entra, no aparece en «Compartir con» y sale en gris en la lista del
equipo, pero sus estudios siguen ahí con su nombre y se le puede devolver el
acceso cuando quieras. La base de datos, además, impide dejar la empresa sin
ninguna Dirección activa.

### El motor tiene pruebas

131 comprobaciones. Congelan los resultados del escenario de ejemplo y verifican
invariantes en seis escenarios distintos (permuta, VPO, LTV mandando sobre LTC,
condicionante de preventas, suelo financiado). Incluyen la que más importa:
aplicar el factor de equilibrio tiene que dar beneficio cero, así que si alguna
vez se sustituye la búsqueda por bisección por una fórmula aproximada, salta.

### Detalles menores

- Los archivos llevan `?v=1.0.0`. Sin eso, los navegadores se quedan con la
  versión vieja en la memoria y acabas depurando código que ya no existe. Súbelo
  en cada publicación, y también `VERSION_APP` dentro de `js/reportar.js`.
- Los finales de línea de los dos HTML están unificados. Estaban mezclados, y
  eso ensucia cualquier comparación de cambios en git.
- Los cuatro SQL antiguos se han movido a `sql/historico/`.

---

## Una decisión pendiente, tuya

Al escribir las pruebas apareció un error de cálculo que **no he tocado**,
porque cambia una cifra que tus usuarios ya ven y esa decisión no es mía.

`js/engine.js`, línea 648:

```js
const equity = costeTotalCash - principal;
```

`principal` es el préstamo **concedido**. `dispuestoMax` es lo que de verdad se
llega a disponer. Todo lo que el banco concede y no se dispone lo pone el
promotor, así que el capital propio real es mayor que el que declara la app.

En el escenario de ejemplo: se conceden 3.296.924 € y se disponen 3.035.074 €.
El KPI «ROE anual (equity total)» de la barra superior sale un **12,6% por
encima** de lo real.

Con el condicionante de preventas al 95% se dispara: se conceden 3.296.924 € y
se disponen 1.349.552 €. La app muestra un ROE del 64,9% cuando el real es del
32,6%. **Casi el doble.**

El arreglo es una línea, pero hay que moverla después del bucle de cash-flow,
donde `dispuestoMax` ya existe:

```js
const equity = costeTotalCash - dispuestoMax;
```

Si lo cambias, ejecuta `node test/motor.test.js` y actualiza los valores
congelados del grupo 1 mirando cada uno. Para eso está la suite.

**Relacionado:** el semáforo «Coherencia financ.» de la barra superior no puede
fallar nunca. Comprueba `|principal + equity − costeTotalCash| < 1` y, como
`equity` se define exactamente como esa resta, el residuo es cero siempre.
Ocupa sitio y transmite una seguridad que no existe.

---

## Qué viene después

| Fase | Qué incluye | Estado |
|---|---|---|
| 0 | Esquema reproducible, tabla de errores, canal de presencia, pruebas del motor | Hecho |
| 1 | Diálogos, Vista de equipo, papelera, baja de personas | Hecho |
| 2 | Pantalla de errores agrupada, notificaciones dentro de la app y aviso por correo | Hecho (el correo necesita tu parte, ver arriba) |
| 3 | Configuración maestra por municipio | Hecho (el auto-relleno en el motor queda para la siguiente) |
| 4 | Dominio, cabeceras de seguridad, copias de seguridad, textos legales | Hecho lo que es código; lo de paneles externos en `herramientas/produccion.md` |
| 5 | Pagos y facturación (SaaS) | Siguiente, cuando lo pidas — lo dejaste para el final a propósito |

Falta git, que sigue siendo lo primero de la lista y es lo único de la fase 0
que no puedo hacer por ti: un repositorio privado, y esta carpeta dentro.

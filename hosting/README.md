# Cabeceras de seguridad

Dos archivos, uno para cada tipo de hosting — usa el que corresponda a donde
publiques la app, el otro no hace nada si no lo lee nadie:

| Archivo | Para |
|---|---|
| `_headers` | Netlify (cópialo a la raíz del sitio publicado) y Cloudflare Pages (mismo formato, mismo sitio) |
| `vercel.json` | Vercel |

## Cómo se instala

**Netlify o Cloudflare Pages:** copia `_headers` a la raíz de lo que
publiques — al mismo nivel que `index.html` y `Dashboard_v4.html`. Ambos lo
leen solos, sin configurar nada más.

**Vercel:** copia `vercel.json` a la raíz del proyecto. Si alguna vez añades
algo que Vercel también gestione con su propio `vercel.json` (funciones,
redirecciones), hay que fusionar los dos archivos en uno, no tener dos.

## Un compromiso que hay que conocer, no solo copiar

La `Content-Security-Policy` lleva `'unsafe-inline'` en `script-src` y en
`style-src`. Normalmente eso es lo primero que se evita en una CSP seria,
porque es lo que le quita a la cabecera buena parte de su capacidad real de
frenar una inyección de script. Aquí hace falta porque el código de hoy lo
pide:

- `Dashboard_v4.html` tiene todo su JavaScript en un único bloque `<script>`
  dentro del propio HTML, no en un archivo aparte.
- Las dos páginas usan atributos `style="…"` sueltos por el HTML (81 en el
  panel, 15 en la app de viabilidad).

Sin `'unsafe-inline'`, el panel dejaría de funcionar directamente: el
navegador bloquearía su propio script. La cabecera sigue mereciendo la pena
tal como está — cierra `frame-ancestors`, `object-src`, `base-uri` y limita
de dónde puede venir cualquier recurso externo — pero que quede claro que no
es una CSP "fuerte" del todo, y por qué.

**Para cerrarla del todo más adelante:** sacar el `<script>` de
`Dashboard_v4.html` a un `js/dashboard.js` propio (index.html ya lo hace
así, por cierto: su JS entero vive en archivos, cero bloques inline) y pasar
los `style="…"` sueltos a clases CSS. Es un cambio real pero mecánico, no
urgente — dímelo cuando quieras que lo haga y actualizo la cabecera para
quitarle el `'unsafe-inline'` a la vez.

## Si cambias de proyecto de Supabase

`connect-src` lleva escrita la URL exacta de tu proyecto
(`jfnptvpvwgdtdworjhhk.supabase.co`, la que hay hoy en
`js/supabase-config.js`), en sus dos variantes: `https://` para las
llamadas normales y `wss://` para el tiempo real (la campanita, la
presencia). Si alguna vez separas un proyecto de pruebas de uno de
producción (te lo recomendé en la fase 0), cada uno necesita su propia
cabecera con su propia URL — o una que incluya las dos si el mismo sitio
publicado apunta a distinto proyecto según el entorno.

## Qué hace cada cabecera, en una línea

- **Content-Security-Policy** — de dónde puede venir cada tipo de recurso; lo
  explicado arriba.
- **X-Content-Type-Options: nosniff** — impide que el navegador intente
  adivinar el tipo de un archivo y lo ejecute como si fuera otra cosa.
- **X-Frame-Options: DENY** + **frame-ancestors 'none'** (dentro de la CSP)
  — nadie puede meter tu panel dentro de un `<iframe>` de su propia página.
  Las dos hacen lo mismo; se dejan las dos porque la segunda es la que
  entienden los navegadores modernos y la primera cubre a los que no leen
  CSP.
- **Referrer-Policy** — no manda la URL completa (con posibles datos) a
  otros sitios cuando alguien sigue un enlace fuera de la app.
- **Strict-Transport-Security** — obliga al navegador a hablar siempre por
  HTTPS con tu dominio durante dos años, incluidos subdominios. No lleva
  `preload`: eso exige enviar el dominio a la lista precargada de los
  navegadores (hstspreload.org), un paso aparte y permanente — añádelo tú
  cuando el dominio esté asentado, si quieres.
- **Permissions-Policy** — la app no necesita cámara, micrófono ni
  geolocalización, así que se los quita a todas las páginas que sirvas
  desde aquí, aunque algún día un script de terceros los pidiera.

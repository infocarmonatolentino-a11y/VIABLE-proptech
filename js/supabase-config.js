/* =========================================================================
   CONFIGURACIÓN COMPARTIDA DE SUPABASE
   -------------------------------------------------------------------------
   Único sitio donde viven la URL y la clave anónima del proyecto. Lo cargan
   LAS DOS páginas (Dashboard_V4.html e index.html), así que no hay forma de
   que se desincronicen ni de que la app de viabilidad apunte a otro proyecto
   distinto del dashboard.

   Importante: al estar las dos páginas en el MISMO origen (mismo dominio,
   misma carpeta), supabase-js guarda la sesión en localStorage y la comparte
   automáticamente entre pestañas. Por eso NO hace falta pasar el token por
   la URL ni por sessionStorage: la pestaña nueva de viabilidad hace
   sb.auth.getSession() y ya está dentro con el mismo usuario.

   La clave "anon" es pública por diseño (va en el HTML de cualquier app
   Supabase); lo que protege los datos son las políticas RLS de la base de
   datos, no esta clave. Ver PENDIENTES-Y-SQL.md.
   ========================================================================= */
const SUPABASE_URL = 'https://jfnptvpvwgdtdworjhhk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmbnB0dnB2d2dkdGR3b3JqaGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTQwNTAsImV4cCI6MjEwNDk5MDA1MH0.PLJo-dyg4vmK55-8Ls6Z04r6PqpHwmqcp4Wxr7PWAjI';
const ORGANIZACION_UNICA_ID = '00000000-0000-0000-0000-000000000001';
// Ya no es "la única" organización — desde que existen varias empresas
// (ver SQL-MULTI-EMPRESA.sql), esto solo identifica la empresa original
// (Grupo Promotor Costa Llevant). El alta ya no la usa por defecto: cada
// quien crea la suya propia o se une con un código. Se deja esta constante
// solo por si algún script de migración necesita referenciar esa empresa
// concreta.

// Ruta de la app de viabilidad vista desde el dashboard. Las dos están en la
// raíz del proyecto, así que es simplemente "index.html".
const VIABILIDAD_URL = 'index.html';

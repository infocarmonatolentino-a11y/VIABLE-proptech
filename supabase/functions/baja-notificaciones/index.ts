// =============================================================================
// baja-notificaciones
// -----------------------------------------------------------------------------
// El enlace "dejar de recibir estos avisos" que va al final de cada correo.
// Tiene que funcionar SIN sesión iniciada — quien lo pulsa lo hace desde su
// cliente de correo, no desde el panel — así que la seguridad no viene de
// estar identificado, sino de que el enlace lleva una firma que solo el
// servidor pudo generar (ver la función firmar() en notificar-por-email).
//
// Es el requisito legal de baja de un clic para correos comerciales en la UE;
// sin él, cada correo de aviso sería una infracción.
//
// DESPLIEGUE
//   supabase functions deploy baja-notificaciones --no-verify-jwt
//
// VARIABLES DE ENTORNO
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — las pone Supabase sola.
//   UNSUB_SECRET — la MISMA cadena que en notificar-por-email. Si no coincide,
//                  todos los enlaces de baja darán "no válido".
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UNSUB_SECRET = Deno.env.get("UNSUB_SECRET")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function firmar(texto: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(UNSUB_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(firma)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pagina(mensaje: string, ok = true): Response {
  return new Response(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1"></head>
     <body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:440px;
                  margin:90px auto;padding:0 20px;text-align:center;color:#16233A;">
       <div style="font-size:13px;letter-spacing:.04em;color:#6B7480;margin-bottom:18px;">VIABLE</div>
       <p style="font-size:15.5px;line-height:1.6;color:${ok ? "#16233A" : "#A34E2C"};">${mensaje}</p>
     </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const perfil = url.searchParams.get("perfil");
  const tipo = url.searchParams.get("tipo");
  const firmaRecibida = url.searchParams.get("firma");

  if (!perfil || !tipo || !firmaRecibida) {
    return pagina("Este enlace está incompleto.", false);
  }

  const firmaEsperada = await firmar(perfil + "|" + tipo);
  if (firmaEsperada !== firmaRecibida) {
    return pagina("Este enlace no es válido.", false);
  }

  const { error } = await admin
    .from("preferencias_notificacion")
    .upsert({ perfil_id: perfil, tipo, modo: "nunca" }, { onConflict: "perfil_id,tipo" });

  if (error) {
    console.error("baja-notificaciones:", error);
    return pagina("No se ha podido actualizar tu preferencia. Pruébalo desde el panel, en Preferencias de aviso.", false);
  }

  return pagina(
    "Hecho. No volverás a recibir avisos por correo de este tipo. " +
    "Puedes reactivarlos cuando quieras desde el panel, en Preferencias de aviso."
  );
});

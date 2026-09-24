// =============================================================================
// notificar-por-email
// -----------------------------------------------------------------------------
// Se dispara mediante un Database Webhook de Supabase sobre INSERT en
// estudios_compartidos. El aviso DENTRO de la app ya lo crea el disparador SQL
// notificar_estudio_compartido() (ver sql/01-notificaciones.sql); esta función
// solo se encarga del correo, y solo si la persona no ha pedido dejar de
// recibirlos.
//
// DESPLIEGUE
//   supabase functions deploy notificar-por-email --no-verify-jwt
//
//   El Database Webhook llama a esta función sin la sesión de ningún usuario
//   (es el servidor de Supabase quien la invoca, no un navegador), así que
//   necesita desplegarse con --no-verify-jwt. La protección contra que
//   cualquiera pueda invocarla desde fuera y hacer mandar correos falsos la
//   da el secreto compartido que se comprueba más abajo.
//
// VARIABLES DE ENTORNO (supabase secrets set …)
//   SUPABASE_URL               — la pone Supabase sola.
//   SUPABASE_SERVICE_ROLE_KEY  — la pone Supabase sola.
//   RESEND_API_KEY             — de tu cuenta de Resend.
//   EMAIL_FROM                 — p.ej. "VIABLE <avisos@tudominio.com>". El
//                                 dominio tiene que estar verificado en Resend
//                                 (SPF, DKIM, DMARC) o el correo llega a spam.
//   APP_URL                    — la URL pública donde vive el panel, sin barra
//                                 final. p.ej. "https://app.viable-proptech.com".
//   UNSUB_SECRET                — una cadena aleatoria larga, la misma que use
//                                 baja-notificaciones. Sirve para firmar el
//                                 enlace de baja sin que haga falta iniciar
//                                 sesión para darse de baja.
//   WEBHOOK_SECRET              — otra cadena aleatoria. Tiene que coincidir
//                                 con la cabecera que configures en el propio
//                                 Database Webhook (ver supabase/README.md).
//                                 Sin esto, cualquiera que conozca la URL de
//                                 la función podría llamarla con datos
//                                 inventados y hacer que se manden correos.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "VIABLE <avisos@tudominio.com>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://tudominio.com";
const UNSUB_SECRET = Deno.env.get("UNSUB_SECRET")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function firmar(texto: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(UNSUB_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(firma)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

Deno.serve(async (req: Request) => {
  try {
    // El secreto va en una cabecera propia, configurada en el Database Webhook
    // (ver supabase/README.md), no como parte del cuerpo: así no aparece en
    // ningún log que capture solo el payload.
    if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response("no autorizado", { status: 401 });
    }

    const payload = await req.json();
    const fila = payload?.record; // la fila de estudios_compartidos recién insertada
    if (!fila?.perfil_id || !fila?.estudio_id) {
      return new Response("payload incompleto", { status: 400 });
    }

    // El aviso dentro de la app se crea siempre, vía trigger SQL, decida lo que
    // decida la persona aquí. Esta preferencia gobierna SOLO el correo.
    const { data: pref } = await admin
      .from("preferencias_notificacion")
      .select("modo")
      .eq("perfil_id", fila.perfil_id)
      .eq("tipo", "estudio_compartido")
      .maybeSingle();
    const modo = pref?.modo ?? "inmediato";

    if (modo === "nunca") {
      return new Response("preferencia: nunca — no se envía correo", { status: 200 });
    }
    if (modo === "resumen_diario") {
      // El envío inmediato se salta aquí. El resumen diario en sí (agrupar
      // todo lo pendiente y mandarlo una vez al día) es una función con cron
      // aparte, todavía no construida — ver supabase/README.md.
      return new Response("preferencia: resumen diario — pendiente del cron", { status: 200 });
    }

    const [{ data: estudio }, { data: destUser }] = await Promise.all([
      admin.from("estudios").select("nombre, ubicacion, creado_por").eq("id", fila.estudio_id).single(),
      admin.auth.admin.getUserById(fila.perfil_id),
    ]);
    const correoDestino = destUser?.user?.email;
    if (!estudio || !correoDestino) {
      return new Response("estudio o correo del destinatario no encontrado", { status: 200 });
    }

    const { data: remitentePerfil } = await admin
      .from("perfiles").select("nombre").eq("id", estudio.creado_por).maybeSingle();
    const nombreRemitente = remitentePerfil?.nombre || "Alguien de tu red";

    const firma = await firmar(fila.perfil_id + "|estudio_compartido");
    const enlaceBaja =
      `${SUPABASE_URL}/functions/v1/baja-notificaciones` +
      `?perfil=${encodeURIComponent(fila.perfil_id)}&tipo=estudio_compartido&firma=${firma}`;
    const enlaceAbrir = `${APP_URL}/Dashboard_v4.html`;

    const nombreEstudio = escapeHtml(estudio.nombre || "Un estudio");
    const ubicacion = estudio.ubicacion ? escapeHtml(estudio.ubicacion) : "";
    const remitente = escapeHtml(nombreRemitente);

    const asunto = `${nombreRemitente} te ha compartido un estudio en VIABLE`;
    const html = `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:8px;">
        <p style="color:#16233A;font-size:15px;">${remitente} te ha compartido un estudio de viabilidad:</p>
        <div style="border:1px solid #DCE2E4;border-radius:10px;padding:16px 18px;margin:14px 0;">
          <div style="font-size:17px;font-weight:600;color:#16233A;">${nombreEstudio}</div>
          ${ubicacion ? `<div style="color:#6B7480;font-size:14px;margin-top:3px;">${ubicacion}</div>` : ""}
        </div>
        <p><a href="${enlaceAbrir}"
              style="display:inline-block;background:#16233A;color:#fff;padding:11px 20px;
                     border-radius:7px;text-decoration:none;font-size:14px;">
              Ver en el panel
            </a></p>
        <p style="font-size:12px;color:#9AA5B1;margin-top:36px;line-height:1.5;">
          Recibes esto porque alguien de tu red te compartió un estudio en VIABLE.
          <a href="${enlaceBaja}" style="color:#9AA5B1;">Dejar de recibir estos avisos por correo</a>.
        </p>
      </div>`;

    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: correoDestino, subject: asunto, html }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error("Resend ha devuelto un error:", detalle);
      return new Response("fallo al enviar: " + detalle, { status: 502 });
    }

    return new Response("enviado", { status: 200 });
  } catch (e) {
    console.error("notificar-por-email:", e);
    return new Response("error: " + String(e), { status: 500 });
  }
});

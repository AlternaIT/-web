// Alterna — inicio de sesión con Zoho (OAuth 2.0 / OpenID Connect).
//  • El navegador manda el "code" que devuelve Zoho; aquí se cambia por los datos del usuario.
//  • Solo entran correos @alterna.pro que ya estén dados de alta y activos en public.usuarios.
//  • Devuelve la misma forma que login_usuario (id, correo, nombre, rol, activo, token),
//    así el resto del sitio no cambia.
// Secreto del servidor: ZOHO_CLIENT_SECRET (el Client ID es público y va aquí mismo).
// Se pide acceso "online" y sin prompt=consent: así Zoho solo pide permiso la primera vez.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DOMINIO = "alterna.pro";

// Zoho tiene un servidor de cuentas por región; solo se acepta uno de estos
// (nunca una dirección arbitraria, porque ahí se envía el secreto).
const SERVIDORES_ZOHO = new Set([
  "https://accounts.zoho.com", "https://accounts.zoho.eu", "https://accounts.zoho.in",
  "https://accounts.zoho.com.au", "https://accounts.zoho.jp", "https://accounts.zoho.ca",
  "https://accounts.zoho.sa", "https://accounts.zoho.com.cn", "https://accounts.zoho.uk",
]);

// Páginas a las que Zoho puede regresar (deben coincidir con las del cliente en api-console.zoho.com)
const REDIRECCIONES = new Set([
  "https://alternait.github.io/-web/index.html",
  "http://localhost:5500/index.html",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const log = (nivel: string, evento: string, datos: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ nivel, evento, ...datos }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// El id_token llega directo del servidor de Zoho por HTTPS, así que basta con leerlo
// y comprobar emisor y destinatario (OpenID Connect, sección 3.1.3.7).
function leerIdToken(idToken: string) {
  const parte = idToken.split(".")[1] ?? "";
  const b64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
}

// Foto de perfil de Zoho → data URL pequeña (la dirección de Zoho solo se abre con su sesión)
const MAX_BYTES_FOTO = 300 * 1024;
async function descargarFoto(url: string, accessToken: string): Promise<string | null> {
  if (!/^https:\/\/([\w-]+\.)*zoho\.(com|eu|in|com\.au|jp|ca|sa|com\.cn|uk)\//.test(url)) return null;
  try {
    const r = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    const tipo = r.headers.get("content-type") ?? "";
    if (!r.ok || !/^image\/(png|jpe?g|gif|webp)/.test(tipo)) { log("info", "zoho_foto_no_disponible", { status: r.status, tipo }); return null; }
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES_FOTO) return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${tipo.split(";")[0]};base64,${btoa(bin)}`;
  } catch (e) {
    log("warn", "zoho_foto_fallo", { error: String(e) });
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const clientId = Deno.env.get("ZOHO_CLIENT_ID") || "1000.I12TCLUMS0P0H4HH33UE9FLXMRSBRH";
  const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    log("error", "zoho_sin_configurar");
    return json({ error: "El inicio de sesión con Zoho aún no está configurado." }, 500);
  }

  let cuerpo: { code?: string; redirect_uri?: string; accounts_server?: string };
  try { cuerpo = await req.json(); } catch { return json({ error: "Solicitud inválida" }, 400); }

  const code = String(cuerpo.code ?? "");
  const redirectUri = String(cuerpo.redirect_uri ?? "");
  const servidor = String(cuerpo.accounts_server || "https://accounts.zoho.com").replace(/\/+$/, "");
  if (!code || !REDIRECCIONES.has(redirectUri) || !SERVIDORES_ZOHO.has(servidor)) {
    return json({ error: "Solicitud inválida" }, 400);
  }

  // 1) Cambiar el code por los tokens
  const r = await fetch(`${servidor}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: redirectUri,
      client_id: clientId, client_secret: clientSecret,
    }),
  });
  const tokens = await r.json().catch(() => ({}));
  if (!r.ok || tokens.error || !tokens.access_token) {
    log("warn", "zoho_token_fallo", { status: r.status, error: tokens.error });
    return json({ error: "Zoho no aceptó el inicio de sesión. Intenta de nuevo." }, 401);
  }

  // 2) Correo del usuario: del id_token, o del endpoint userinfo si no viene
  let correo = "", nombre = "", verificado = false, picture = "";
  try {
    if (tokens.id_token) {
      const c = leerIdToken(tokens.id_token);
      const audOk = c.aud === clientId || (Array.isArray(c.aud) && c.aud.includes(clientId));
      if (!audOk || !String(c.iss ?? "").includes("zoho")) throw new Error("id_token ajeno");
      correo = c.email ?? ""; nombre = c.name ?? ""; verificado = c.email_verified !== false; picture = c.picture ?? "";
    }
    if (!correo || !picture) {
      const u = await fetch(`${servidor}/oauth/v2/userinfo`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const info = await u.json().catch(() => ({}));
      if (!correo) { correo = info.email ?? ""; nombre = info.name ?? nombre; verificado = info.email_verified !== false; }
      picture = picture || (info.picture ?? "");
    }
  } catch (e) {
    log("warn", "zoho_identidad_fallo", { error: String(e) });
    return json({ error: "No se pudo leer tu cuenta de Zoho." }, 401);
  }

  const foto = picture ? await descargarFoto(picture, tokens.access_token) : null;
  if (!picture) log("info", "zoho_sin_picture");

  // El token de Zoho ya no se necesita: se revoca para no dejarlo vivo
  fetch(`${servidor}/oauth/v2/token/revoke?token=${encodeURIComponent(tokens.access_token)}`, { method: "POST" }).catch(() => {});

  correo = correo.trim().toLowerCase();
  if (!correo || !verificado || !correo.endsWith("@" + DOMINIO)) {
    log("info", "zoho_dominio_rechazado", { dominio: correo.split("@")[1] ?? "" });
    return json({ error: `Solo pueden entrar cuentas @${DOMINIO}.` }, 403);
  }

  // 3) Buscar al usuario dado de alta y abrir sesión (igual que login_usuario)
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: usuario, error: errU } = await db.from("usuarios")
    .select("id, correo, nombre, rol, activo, foto").ilike("correo", correo.replace(/[\\%_]/g, "\\$&")).maybeSingle(); // ilike sin comodines = igual sin mayúsculas
  if (errU) { log("error", "zoho_buscar_usuario", { error: errU.message }); return json({ error: "Error del servidor." }, 500); }
  if (!usuario) {
    log("info", "zoho_usuario_no_registrado", { correo });
    return json({ error: "Tu cuenta no está dada de alta. Pide acceso al área de IT." }, 403);
  }
  if (usuario.activo !== true) return json({ error: "Tu usuario se encuentra desactivado." }, 403);

  const { data: sesion, error: errS } = await db.from("sesiones_app")
    .insert({ usuario_id: usuario.id }).select("token").single();
  if (errS) { log("error", "zoho_crear_sesion", { error: errS.message }); return json({ error: "Error del servidor." }, 500); }

  // Foto nueva de Zoho → se guarda; si esta vez no llegó, se conserva la anterior
  if (foto && foto !== usuario.foto) {
    const { error: errF } = await db.from("usuarios").update({ foto }).eq("id", usuario.id);
    if (errF) log("warn", "zoho_guardar_foto", { error: errF.message });
    usuario.foto = foto;
  }

  log("info", "zoho_login_ok", { usuario_id: usuario.id, foto: !!usuario.foto });
  return json({ ...usuario, token: String(sesion.token) });
});

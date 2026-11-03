// Alterna — inicio de sesión con la cuenta de Zoho.
//  • accion "password": el correo y la contraseña de Zoho se escriben en nuestra pantalla y se
//    comprueban contra Zoho Mail (IMAP). Si Zoho los acepta, entra sin ver ninguna página de Zoho.
//    Contraseña mal → "Correo o contraseña incorrectos". Otra respuesta de Zoho (p. ej. verificación
//    en dos pasos) → { zoho: true } y la página manda a Zoho.
//  • accion "oauth" (por defecto): el "code" que devuelve Zoho se cambia por la identidad (OpenID).
//  • Solo entran correos @alterna.pro dados de alta y activos en public.usuarios.
//  • Devuelve la misma forma que login_usuario (id, correo, nombre, rol, activo, token) + foto.
// Secreto del servidor: ZOHO_CLIENT_SECRET (el Client ID es público y va aquí mismo).
// La contraseña nunca se guarda ni se escribe en los registros.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DOMINIO = "alterna.pro";
const IMAP_HOST = "imappro.zoho.com"; // cuentas de empresa (dominio propio)
const MAX_FALLOS = 5;                  // por correo cada 15 minutos (Zoho bloquea si hay muchos)
const VENTANA_FALLOS_MIN = 15;

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

const db = (): SupabaseClient => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// El id_token llega directo del servidor de Zoho por HTTPS, así que basta con leerlo
// y comprobar emisor y destinatario (OpenID Connect, sección 3.1.3.7).
function leerIdToken(idToken: string) {
  const parte = idToken.split(".")[1] ?? "";
  const b64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
}

const aBase64 = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

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
    return `data:${tipo.split(";")[0]};base64,${aBase64(bytes)}`;
  } catch (e) {
    log("warn", "zoho_foto_fallo", { error: String(e) });
    return null;
  }
}

/* ───────────── Usuario y sesión (comunes a los dos caminos) ───────────── */

type Usuario = { id: number; correo: string; nombre: string; rol: string; activo: boolean; foto: string | null };

async function buscarUsuario(base: SupabaseClient, correo: string): Promise<Usuario | null> {
  const { data, error } = await base.from("usuarios")
    .select("id, correo, nombre, rol, activo, foto")
    .ilike("correo", correo.replace(/[\\%_]/g, "\\$&")) // ilike sin comodines = igual sin mayúsculas
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Usuario | null;
}

async function abrirSesion(base: SupabaseClient, usuario: Usuario, via: string) {
  const { data, error } = await base.from("sesiones_app").insert({ usuario_id: usuario.id }).select("token").single();
  if (error) { log("error", "crear_sesion", { error: error.message }); return json({ error: "Error del servidor." }, 500); }
  log("info", "login_ok", { usuario_id: usuario.id, via, foto: !!usuario.foto });
  return json({ ...usuario, token: String(data.token) });
}

/* ───────────── Camino 1: contraseña de Zoho comprobada en Zoho Mail (IMAP) ───────────── */

// "ok" = Zoho aceptó la contraseña · "invalida" = la rechazó · "otro" = respuesta distinta
// (p. ej. verificación en dos pasos) · null = no se pudo comprobar.
// Si el usuario no tiene IMAP activado, Zoho valida primero la contraseña y solo con la correcta
// responde "You are yet to enable IMAP" (con la incorrecta: AUTHENTICATIONFAILED): eso cuenta como "ok".
type ResultadoImap = "ok" | "invalida" | "otro" | null;
async function imapAcepta(correo: string, contrasena: string): Promise<ResultadoImap> {
  let con: Deno.TlsConn | null = null;
  const temporizador = setTimeout(() => { try { con?.close(); } catch { /* ya cerrada */ } }, 10_000);
  try {
    con = await Deno.connectTls({ hostname: IMAP_HOST, port: 993 });
    const dec = new TextDecoder(), enc = new TextEncoder(), buf = new Uint8Array(4096);
    let texto = "";
    const leerHasta = async (fin: RegExp) => {
      while (!fin.test(texto)) {
        const n = await con!.read(buf);
        if (n === null) throw new Error("conexión cerrada");
        texto += dec.decode(buf.subarray(0, n));
      }
    };
    await leerHasta(/^\* (OK|BYE)[^\r\n]*\r\n/m);
    if (!/^\* OK/m.test(texto)) return null;
    // AUTHENTICATE PLAIN con SASL-IR: base64("\0usuario\0contraseña"), sin problemas de comillas
    const credencial = aBase64(enc.encode(`\0${correo}\0${contrasena}`));
    texto = "";
    await con.write(enc.encode(`A1 AUTHENTICATE PLAIN ${credencial}\r\n`));
    await leerHasta(/^A1 (OK|NO|BAD)[^\r\n]*\r\n/m);
    const respuesta = texto.match(/^A1 [^\r\n]*/m)?.[0] ?? "";
    try { await con.write(enc.encode("A2 LOGOUT\r\n")); } catch { /* no importa */ }
    if (/^A1 OK/.test(respuesta) || /yet to enable IMAP/i.test(respuesta)) return "ok";
    log("info", "imap_rechazo", { respuesta: respuesta.slice(0, 160) });
    return /AUTHENTICATIONFAILED|Invalid credentials/i.test(respuesta) ? "invalida" : "otro";
  } catch (e) {
    log("warn", "imap_fallo", { error: String(e) });
    return null;
  } finally {
    clearTimeout(temporizador);
    try { con?.close(); } catch { /* ya cerrada */ }
  }
}

async function loginConContrasena(correoBruto: string, contrasena: string) {
  const correo = correoBruto.trim().toLowerCase();
  if (!correo || !contrasena) return json({ error: "Ingresa tu correo y contraseña." }, 400);
  if (!correo.endsWith("@" + DOMINIO) || /[\r\n\0]/.test(correo + contrasena) || contrasena.length > 256) {
    return json({ error: `Solo pueden entrar cuentas @${DOMINIO}.` }, 403);
  }

  const base = db();
  let usuario: Usuario | null;
  try { usuario = await buscarUsuario(base, correo); }
  catch (e) { log("error", "buscar_usuario", { error: String(e) }); return json({ error: "Error del servidor." }, 500); }
  // Mismo mensaje para "no existe" que para contraseña mal: no se revela quién está dado de alta
  if (!usuario || usuario.activo !== true) {
    log("info", "password_usuario_no_valido", { correo });
    return json({ error: "Correo o contraseña incorrectos." }, 401);
  }

  const desde = new Date(Date.now() - VENTANA_FALLOS_MIN * 60_000).toISOString();
  const { count } = await base.from("login_intentos").select("id", { count: "exact", head: true })
    .eq("correo", correo).gte("created_at", desde);
  // Demasiados fallos: ya no se prueba en Zoho Mail (evita que Zoho bloquee la cuenta)
  if ((count ?? 0) >= MAX_FALLOS) {
    log("info", "password_limite", { usuario_id: usuario.id });
    return json({ error: `Demasiados intentos fallidos. Espera ${VENTANA_FALLOS_MIN} minutos e intenta de nuevo.` }, 429);
  }

  const resultado = await imapAcepta(correo, contrasena);
  if (resultado === "ok") {
    await base.from("login_intentos").delete().eq("correo", correo);
    return abrirSesion(base, usuario, "password");
  }
  if (resultado === "invalida") {
    await base.from("login_intentos").insert({ correo });
    return json({ error: "Correo o contraseña incorrectos." }, 401);
  }
  if (resultado === null) return json({ error: "No se pudo comprobar tu contraseña con Zoho. Intenta de nuevo." }, 503);
  // Respuesta distinta (p. ej. verificación en dos pasos): lo resuelve Zoho en su página
  return json({ zoho: true });
}

/* ───────────── Camino 2: regreso desde la página de Zoho (OAuth / OpenID) ───────────── */

async function loginConZoho(cuerpo: Record<string, unknown>) {
  const clientId = Deno.env.get("ZOHO_CLIENT_ID") || "1000.I12TCLUMS0P0H4HH33UE9FLXMRSBRH";
  const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
  if (!clientSecret) {
    log("error", "zoho_sin_configurar");
    return json({ error: "El inicio de sesión con Zoho aún no está configurado." }, 500);
  }

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
  let correo = "", verificado = false, picture = "";
  try {
    if (tokens.id_token) {
      const c = leerIdToken(tokens.id_token);
      const audOk = c.aud === clientId || (Array.isArray(c.aud) && c.aud.includes(clientId));
      if (!audOk || !String(c.iss ?? "").includes("zoho")) throw new Error("id_token ajeno");
      correo = c.email ?? ""; verificado = c.email_verified !== false; picture = c.picture ?? "";
    }
    if (!correo || !picture) {
      const u = await fetch(`${servidor}/oauth/v2/userinfo`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const info = await u.json().catch(() => ({}));
      if (!correo) { correo = info.email ?? ""; verificado = info.email_verified !== false; }
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

  // 3) Buscar al usuario dado de alta y abrir sesión
  const base = db();
  let usuario: Usuario | null;
  try { usuario = await buscarUsuario(base, correo); }
  catch (e) { log("error", "buscar_usuario", { error: String(e) }); return json({ error: "Error del servidor." }, 500); }
  if (!usuario) {
    log("info", "zoho_usuario_no_registrado", { correo });
    return json({ error: "Tu cuenta no está dada de alta. Pide acceso al área de IT." }, 403);
  }
  if (usuario.activo !== true) return json({ error: "Tu usuario se encuentra desactivado." }, 403);

  // Foto nueva de Zoho → se guarda; si esta vez no llegó, se conserva la anterior
  if (foto && foto !== usuario.foto) {
    const { error: errF } = await base.from("usuarios").update({ foto }).eq("id", usuario.id);
    if (errF) log("warn", "zoho_guardar_foto", { error: errF.message });
    usuario.foto = foto;
  }
  // Entró con su contraseña y verificación de Zoho: se limpian los fallos anteriores
  await base.from("login_intentos").delete().eq("correo", correo);

  return abrirSesion(base, usuario, "zoho");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let cuerpo: Record<string, unknown>;
  try { cuerpo = await req.json(); } catch { return json({ error: "Solicitud inválida" }, 400); }

  if (cuerpo.accion === "password") return loginConContrasena(String(cuerpo.correo ?? ""), String(cuerpo.contrasena ?? ""));
  return loginConZoho(cuerpo);
});

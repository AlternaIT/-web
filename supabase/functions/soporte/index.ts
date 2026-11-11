// Alterna — app Soporte (soporte.html): crea tickets en Zoho Desk.
//  • El usuario ya entró a Alterna (con su cuenta de Zoho); aquí no vuelve a conectar nada.
//    La sesión se valida igual que en alterna-ai (usuario_id + token de sesiones_app) y se
//    comprueba el acceso a la app (catálogo "aplicaciones", url soporte.html).
//  • El ticket se crea con la conexión de Zoho Desk de la empresa (tabla zoho_desk_config, solo
//    servidor), a nombre del correo verificado del usuario: Zoho Desk lo asocia a su contacto.
//  • La conexión es interna: se guarda una vez en zoho_desk_config (no se pide en la página).
// Acciones (JSON): "perfil", "mis_tickets", "ticket" (detalle). Envío del ticket: multipart/form-data con los campos y archivos.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ORG_ID = Deno.env.get("ZOHO_DESK_ORG_ID") || "718939940";
const DEPARTAMENTO_ID = Deno.env.get("ZOHO_DESK_DEPARTMENT_ID") || "512816000000006907";
// Campos personalizados de Zoho Desk (Configuración → Tickets → Campos → nombre de API)
const CF_NOMBRE = "cf_nombre_completo";
const CF_DEPARTAMENTO = "cf_departamento_area";
const CF_APLICACION = "cf_aplicacion_en_la_que_necesita_apoyo";

const MAX_ARCHIVOS = 5;
const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024;
const MAX_BYTES_TOTAL = 20 * 1024 * 1024;
const MAX_TICKETS_HORA = 10;

const CATEGORIAS = ["Facturación", "Soporte técnico", "Consulta general", "Conectividad", "Hardware", "Software", "Otro"];
const APLICACIONES = ["Mail", "Cliq", "CRM", "Calendar", "Project", "Form", "Sitio Web", "Sprints", "People", "Drive", "Sign",
  "Expense", "Books", "Aplicativo control de honorarios", "Analytics", "Otro"];
const PRIORIDADES: Record<string, { nombre: string; bg: string; tx: string; bd: string }> = {
  Low:    { nombre: "Baja",    bg: "#ecfdf5", tx: "#065f46", bd: "#6ee7b7" },
  Medium: { nombre: "Media",   bg: "#fffbeb", tx: "#92400e", bd: "#fcd34d" },
  High:   { nombre: "Alta",    bg: "#fff1f2", tx: "#9f1239", bd: "#fca5a5" },
  Urgent: { nombre: "Urgente", bg: "#faf5ff", tx: "#581c87", bd: "#c084fc" },
};

// Zoho Desk de cada servidor de cuentas de Zoho
const DESK_DE: Record<string, string> = {
  "https://accounts.zoho.com": "https://desk.zoho.com",
  "https://accounts.zoho.eu": "https://desk.zoho.eu",
  "https://accounts.zoho.in": "https://desk.zoho.in",
  "https://accounts.zoho.com.au": "https://desk.zoho.com.au",
  "https://accounts.zoho.jp": "https://desk.zoho.jp",
  "https://accounts.zoho.ca": "https://desk.zohocloud.ca",
  "https://accounts.zoho.sa": "https://desk.zoho.sa",
  "https://accounts.zoho.uk": "https://desk.zoho.uk",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const log = (nivel: string, evento: string, datos: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ nivel, evento, ...datos }));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

class ErrorUsuario extends Error {
  constructor(mensaje: string, public status = 400) { super(mensaje); }
}

/* ───────────── Sesión y acceso ───────────── */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Usuario = { id: number; nombre: string; rol: string; activo: boolean; correo: string };

async function autenticar(db: SupabaseClient, usuarioId: unknown, token: unknown): Promise<Usuario | null> {
  const id = Number(usuarioId), t = String(token ?? "");
  if (!Number.isFinite(id) || !UUID.test(t)) return null;
  const { data: user } = await db.from("usuarios").select("id, nombre, rol, activo, correo").eq("id", id).maybeSingle();
  if (!user || user.activo !== true) return null;
  const { data: s } = await db.from("sesiones_app").select("usuario_id, expira").eq("token", t).maybeSingle();
  if (!s || s.usuario_id !== user.id || new Date(s.expira) < new Date()) return null;
  return user as Usuario;
}

async function tieneAcceso(db: SupabaseClient, usuarioId: number): Promise<boolean> {
  // La clave la pone quien crea la app en el panel: se busca por su enlace
  const { data: apps } = await db.from("aplicaciones").select("clave, url").eq("activa", true);
  const app = (apps ?? []).find((a) => /(^|\/)soporte\.html([?#]|$)/i.test(a.url ?? ""));
  if (!app) return false;
  const { data } = await db.rpc("usuario_tiene_acceso", { p_usuario: usuarioId, p_clave: app.clave });
  return data === true;
}

/* ───────────── Conexión de la empresa con Zoho Desk ───────────── */

type Config = { client_id: string; client_secret: string; refresh_token: string; servidor: string };
let cacheToken: { token: string; vence: number; refresh: string } | null = null;

async function leerConfig(db: SupabaseClient): Promise<Config | null> {
  const { data, error } = await db.from("zoho_desk_config").select("client_id, client_secret, refresh_token, servidor").eq("id", 1).maybeSingle();
  if (error) { log("error", "leer_config", { error: error.message }); return null; }
  return data as Config | null;
}

async function tokenDesk(cfg: Config, forzar = false): Promise<string> {
  if (!forzar && cacheToken && cacheToken.refresh === cfg.refresh_token && cacheToken.vence > Date.now() + 60_000) return cacheToken.token;
  const r = await fetch(`${cfg.servidor}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: cfg.refresh_token, client_id: cfg.client_id, client_secret: cfg.client_secret }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    log("error", "zoho_refresh_fallo", { status: r.status, error: d.error });
    throw new ErrorUsuario("La conexión con Zoho Desk dejó de funcionar. Avisa al área de IT.", 503);
  }
  cacheToken = { token: d.access_token, vence: Date.now() + (Number(d.expires_in) || 3600) * 1000, refresh: cfg.refresh_token };
  return d.access_token;
}

// Llamada a Zoho Desk; si el token venció se renueva una vez
async function desk(cfg: Config, ruta: string, opciones: RequestInit = {}): Promise<Response> {
  const base = (DESK_DE[cfg.servidor] ?? "https://desk.zoho.com") + "/api/v1";
  const llamar = async (forzar: boolean) => fetch(base + ruta, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), Authorization: "Zoho-oauthtoken " + await tokenDesk(cfg, forzar), orgId: ORG_ID },
  });
  let r = await llamar(false);
  if (r.status === 401) r = await llamar(true);
  return r;
}
const mensajeZoho = async (r: Response) => {
  const d = await r.json().catch(() => ({}));
  return [d.errorCode, d.message].filter(Boolean).join(": ");
};

// Departamento del usuario en Zoho People (árbol de departamentos de la organización), por su correo
const cacheDepartamento = new Map<string, { valor: string; vence: number }>();
async function departamentoDe(cfg: Config, correo: string): Promise<string> {
  const clave = correo.toLowerCase();
  const guardado = cacheDepartamento.get(clave);
  if (guardado && guardado.vence > Date.now()) return guardado.valor;
  try {
    const people = (DESK_DE[cfg.servidor] ?? "https://desk.zoho.com").replace("://desk.", "://people.");
    const busqueda = JSON.stringify({ searchField: "EmailID", searchOperator: "Is", searchText: clave });
    const r = await fetch(`${people}/people/api/forms/employee/getRecords?searchParams=${encodeURIComponent(busqueda)}`, {
      headers: { Authorization: "Zoho-oauthtoken " + await tokenDesk(cfg) },
    });
    const d = await r.json().catch(() => ({}));
    const registros = (d?.response?.result ?? []).flatMap((x: Record<string, unknown[]>) => Object.values(x).flat());
    const valor = String((registros[0] as Record<string, unknown> | undefined)?.Department ?? "").trim();
    if (!valor) log("warn", "people_sin_departamento", { status: r.status, codigo: d?.response?.errors?.code, mensaje: d?.response?.errors?.message ?? d?.response?.message });
    cacheDepartamento.set(clave, { valor, vence: Date.now() + (valor ? 3600_000 : 300_000) });
    return valor;
  } catch (e) {
    log("warn", "departamento_fallo", { error: String(e) });
    return "";
  }
}

/* ───────────── Mis tickets (solo los del correo de la sesión) ───────────── */

// Grupo para la interfaz: abierto · proceso · espera · cerrado (Zoho permite estados personalizados)
function grupoEstado(status: string, statusType: string): string {
  if (/closed/i.test(statusType)) return "cerrado";
  if (/progress|proceso|escalat|asignad|atendiendo|revisi/i.test(status)) return "proceso";
  if (/hold/i.test(statusType)) return "espera";
  return "abierto";
}
const nombreDe = (p: { firstName?: string; lastName?: string; name?: string } | null | undefined) =>
  p ? (p.name || [p.firstName, p.lastName].filter(Boolean).join(" ")).trim() : "";
const esDelUsuario = (t: Record<string, any>, correo: string) =>
  [t.email, t.contact?.email].some((e) => String(e ?? "").toLowerCase() === correo.toLowerCase());

async function misTickets(cfg: Config, user: Usuario) {
  const r = await desk(cfg, "/tickets/search?limit=100&email=" + encodeURIComponent(user.correo));
  if (r.status === 204) return json({ tickets: [] });
  if (!r.ok) {
    const motivo = await mensajeZoho(r);
    log("error", "mis_tickets_fallo", { status: r.status, motivo });
    throw new ErrorUsuario("No se pudieron cargar tus tickets. Intenta de nuevo en unos minutos.", 502);
  }
  const lista: Record<string, any>[] = (await r.json()).data ?? [];
  const tickets = lista
    .filter((t) => esDelUsuario(t, user.correo))
    .map((t) => ({
      id: String(t.id), numero: String(t.ticketNumber ?? ""), asunto: String(t.subject ?? ""),
      estado: String(t.status ?? ""), grupo: grupoEstado(String(t.status ?? ""), String(t.statusType ?? "")),
      prioridad: String(t.priority ?? ""), categoria: String(t.category ?? ""),
      creado: t.createdTime ?? null, actualizado: t.modifiedTime ?? t.createdTime ?? null, cerrado: t.closedTime ?? null,
    }))
    .sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
  return json({ tickets });
}

async function verTicket(cfg: Config, user: Usuario, id: string) {
  if (!/^\d{1,30}$/.test(id)) throw new ErrorUsuario("Ticket no válido.");
  const r = await desk(cfg, `/tickets/${id}?include=contacts,assignee`);
  if (r.status === 404 || r.status === 422) throw new ErrorUsuario("No encontramos ese ticket.", 404);
  if (!r.ok) { log("error", "ver_ticket_fallo", { status: r.status, motivo: await mensajeZoho(r) }); throw new ErrorUsuario("No se pudo cargar el ticket.", 502); }
  const t = await r.json();
  // Solo el dueño del ticket lo puede ver (mismo mensaje que si no existiera)
  if (!esDelUsuario(t, user.correo)) throw new ErrorUsuario("No encontramos ese ticket.", 404);

  let adjuntos: { nombre: string; tamano: number }[] = [];
  try {
    const ra = await desk(cfg, `/tickets/${id}/attachments?limit=50`);
    if (ra.ok && ra.status !== 204) adjuntos = ((await ra.json()).data ?? []).filter((a: any) => a.isPublic !== false)
      .map((a: any) => ({ nombre: String(a.name ?? "archivo"), tamano: Number(a.size ?? 0) }));
  } catch { /* sin adjuntos */ }

  return json({
    ticket: {
      id: String(t.id), numero: String(t.ticketNumber ?? ""), asunto: String(t.subject ?? ""),
      estado: String(t.status ?? ""), grupo: grupoEstado(String(t.status ?? ""), String(t.statusType ?? "")),
      prioridad: String(t.priority ?? ""), categoria: String(t.category ?? ""), aplicacion: String(t.cf?.[CF_APLICACION] ?? ""),
      responsable: nombreDe(t.assignee), creado: t.createdTime ?? null, actualizado: t.modifiedTime ?? null,
      cerrado: t.closedTime ?? null, vence: t.dueDate ?? null,
    },
    adjuntos,
  });
}

/* ───────────── Acciones ───────────── */

async function perfil(db: SupabaseClient, user: Usuario) {
  const cfg = await leerConfig(db);
  return json({
    nombre: user.nombre, correo: user.correo,
    departamento: cfg ? await departamentoDe(cfg, user.correo) : "",
    configurado: !!cfg,
  });
}

function descripcionHtml(d: Record<string, string>) {
  const p = PRIORIDADES[d.prioridad] ?? PRIORIDADES.Low;
  const fecha = new Date().toLocaleString("es-GT", { dateStyle: "full", timeStyle: "short", timeZone: "America/Guatemala" });
  const fila = (k: string, v: string, alt: boolean) => `<tr style="${alt ? "background:#f9fafb;" : ""}"><td style="padding:10px 18px;width:36%;font-size:13px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">${k}</td><td style="padding:10px 18px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${v}</td></tr>`;
  const tabla = (titulo: string, filas: [string, string][]) => `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:separate;border-spacing:0;"><tr><td colspan="2" style="padding:11px 18px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.08em;">${titulo}</td></tr>${filas.map(([k, v], i) => fila(k, v, i % 2 === 1)).join("")}</table>`;
  const solicitante: [string, string][] = [
    ["Nombre", esc(d.nombre)],
    ["Correo", `<a href="mailto:${esc(d.correo)}" style="color:#21b894;text-decoration:none;">${esc(d.correo)}</a>`],
    ...(d.telefono ? [["Teléfono", esc(d.telefono)] as [string, string]] : []),
    ["Departamento", esc(d.departamento || "—")],
  ];
  const solicitud: [string, string][] = [
    ["Aplicación", `<strong>${esc(d.aplicacion)}</strong>`],
    ["Categoría", esc(d.categoria)],
    ...(d.subcategoria ? [["Subcategoría", esc(d.subcategoria)] as [string, string]] : []),
    ["Prioridad", `<span style="display:inline-block;padding:2px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${p.bg};color:${p.tx};border:1px solid ${p.bd};">${p.nombre}</span>`],
  ];
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6;max-width:680px;">`
    + `<div style="background:#21b894;padding:16px 20px;border-radius:8px;margin-bottom:20px;"><div style="color:#fff;font-size:15px;font-weight:700;">Ticket de soporte técnico</div><div style="color:rgba(255,255,255,.8);font-size:12px;margin-top:3px;">${esc(fecha)} · enviado desde Alterna</div></div>`
    + tabla("Solicitante", solicitante) + tabla("Solicitud", solicitud)
    + `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:separate;border-spacing:0;"><tr><td style="padding:11px 18px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.08em;">Descripción del problema</td></tr><tr><td style="padding:16px 18px;font-size:13px;line-height:1.75;color:#1f2937;white-space:pre-wrap;">${esc(d.descripcion)}</td></tr></table>`
    + `</div>`;
}

async function crearTicket(db: SupabaseClient, user: Usuario, f: FormData) {
  const cfg = await leerConfig(db);
  if (!cfg) throw new ErrorUsuario("Zoho Desk aún no está configurado. Avisa al área de IT.", 503);

  const d: Record<string, string> = {
    nombre: user.nombre || user.correo, correo: user.correo,
    telefono: texto(f.get("telefono"), 30),
    asunto: texto(f.get("asunto"), 200),
    categoria: texto(f.get("categoria"), 60),
    subcategoria: texto(f.get("subcategoria"), 80),
    aplicacion: texto(f.get("aplicacion"), 80),
    descripcion: texto(f.get("descripcion"), 3000),
    prioridad: texto(f.get("prioridad"), 10),
  };
  if (!d.asunto || !d.descripcion) throw new ErrorUsuario("Escribe el asunto y la descripción.");
  if (!CATEGORIAS.includes(d.categoria) || !APLICACIONES.includes(d.aplicacion)) throw new ErrorUsuario("Elige la categoría y la aplicación.");
  if (!PRIORIDADES[d.prioridad]) d.prioridad = "Low";

  const archivos = f.getAll("archivos").filter((x): x is File => x instanceof File && x.size > 0);
  if (archivos.length > MAX_ARCHIVOS) throw new ErrorUsuario(`Puedes adjuntar hasta ${MAX_ARCHIVOS} archivos.`);
  if (archivos.some((a) => a.size > MAX_BYTES_ARCHIVO)) throw new ErrorUsuario("Cada archivo puede pesar hasta 10 MB.");
  if (archivos.reduce((s, a) => s + a.size, 0) > MAX_BYTES_TOTAL) throw new ErrorUsuario("Los archivos juntos pueden pesar hasta 20 MB.");

  const { count } = await db.from("soporte_tickets").select("id", { count: "exact", head: true })
    .eq("usuario_id", user.id).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= MAX_TICKETS_HORA) throw new ErrorUsuario("Enviaste muchos tickets en la última hora. Espera un poco e intenta de nuevo.", 429);

  d.departamento = await departamentoDe(cfg, user.correo);
  const partes = d.nombre.split(/\s+/);
  const r = await desk(cfg, "/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: d.asunto,
      description: descripcionHtml(d),
      departmentId: DEPARTAMENTO_ID,
      // Zoho Desk asocia el ticket al contacto con este correo (o lo crea si no existe)
      contact: { email: d.correo, firstName: partes.length > 1 ? partes[0] : undefined, lastName: partes.length > 1 ? partes.slice(1).join(" ") : d.nombre, phone: d.telefono || undefined },
      email: d.correo,
      phone: d.telefono || undefined,
      priority: d.prioridad,
      category: d.categoria,
      channel: "Web",
      cf: { [CF_NOMBRE]: d.nombre, [CF_DEPARTAMENTO]: d.departamento, [CF_APLICACION]: d.aplicacion },
    }),
  });
  if (!r.ok) {
    const motivo = await mensajeZoho(r);
    log("error", "crear_ticket_fallo", { status: r.status, motivo, usuario_id: user.id });
    throw new ErrorUsuario("Zoho Desk no aceptó el ticket. Avisa al área de IT." + (motivo ? ` (${motivo})` : ""), 502);
  }
  const ticket = await r.json();

  const fallidos: string[] = [];
  for (const a of archivos) {
    try {
      const fd = new FormData();
      fd.append("file", a, a.name);
      const ra = await desk(cfg, `/tickets/${encodeURIComponent(ticket.id)}/attachments?isPublic=true`, { method: "POST", body: fd });
      if (!ra.ok) { fallidos.push(a.name); log("warn", "adjunto_fallo", { status: ra.status, motivo: await mensajeZoho(ra) }); }
    } catch (e) {
      fallidos.push(a.name);
      log("warn", "adjunto_fallo", { error: String(e) });
    }
  }

  const { error } = await db.from("soporte_tickets").insert({ usuario_id: user.id, ticket_id: String(ticket.id), numero: String(ticket.ticketNumber ?? ""), asunto: d.asunto });
  if (error) log("warn", "registrar_ticket", { error: error.message });
  log("info", "ticket_creado", { usuario_id: user.id, ticket: ticket.ticketNumber, adjuntos: archivos.length, fallidos: fallidos.length });
  return json({ numero: ticket.ticketNumber ?? ticket.id, fallidos });
}

/* ───────────── Servidor ───────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const multipart = (req.headers.get("content-type") ?? "").startsWith("multipart/form-data");
    let p: Record<string, unknown> = {}, formulario: FormData | null = null;
    if (multipart) {
      formulario = await req.formData();
      p = { usuario_id: formulario.get("usuario_id"), token: formulario.get("token"), accion: "crear" };
    } else {
      p = await req.json();
    }

    const user = await autenticar(db, p.usuario_id, p.token);
    if (!user) return json({ error: "sesion_invalida" }, 401);
    if (!(await tieneAcceso(db, user.id))) return json({ error: "No tienes acceso a Soporte. Pide acceso al área de IT." }, 403);

    if (p.accion === "perfil") return await perfil(db, user);
    if (p.accion === "mis_tickets" || p.accion === "ticket") {
      const cfg = await leerConfig(db);
      if (!cfg) throw new ErrorUsuario("Zoho Desk aún no está configurado. Avisa al área de IT.", 503);
      return p.accion === "ticket" ? await verTicket(cfg, user, String(p.id ?? "")) : await misTickets(cfg, user);
    }
    if (p.accion === "crear" && formulario) return await crearTicket(db, user, formulario);
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    if (e instanceof ErrorUsuario) return json({ error: e.message }, e.status);
    log("error", "soporte_fallo", { error: String(e) });
    return json({ error: "Error del servidor. Intenta de nuevo." }, 500);
  }
});

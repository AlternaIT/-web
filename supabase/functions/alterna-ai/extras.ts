// Alterna IA — documentos adjuntos, memoria personal, voz y calificación de respuestas.
const OPENAI = "https://api.openai.com/v1";

/* ───────────── Documentos ───────────── */

export const MAX_DOCS = 5;
const MAX_TEXTO_DOC = 200_000;        // caracteres por documento (~50 mil tokens)
const PRESUPUESTO_DOCS = 240_000;     // caracteres de documentos que se envían al modelo por mensaje
export const DOC_RE = /⟦doc:([0-9a-f-]{36})\|([^|⟧]*)\|([^⟧]*)⟧/g;
const TIPOS_DOC = ["pdf", "word", "excel", "csv", "texto", "presentacion"];

const limpiarNombre = (s: unknown) => String(s ?? "documento").replace(/[|⟦⟧\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "documento";

// Valida y guarda los documentos del mensaje. Devuelve las marcas que se insertan en el mensaje del usuario.
export async function guardarDocumentos(db: any, usuarioId: number, convId: string, docs: any[]): Promise<{ marcas: string[]; error?: string }> {
  const marcas: string[] = [];
  for (const d of docs.slice(0, MAX_DOCS)) {
    const texto = String(d?.texto ?? "").replace(/\u0000/g, "").trim();
    const tipo = TIPOS_DOC.includes(d?.tipo) ? d.tipo : "texto";
    const nombre = limpiarNombre(d?.nombre);
    if (!texto) return { marcas, error: `No se encontró texto en «${nombre}».` };
    const recortado = texto.length > MAX_TEXTO_DOC;
    const final = recortado ? texto.slice(0, MAX_TEXTO_DOC) + "\n\n[… documento recortado: supera el máximo de caracteres que se pueden analizar]" : texto;
    const paginas = Number.isFinite(+d?.paginas) && +d.paginas > 0 ? Math.min(Math.round(+d.paginas), 100000) : null;
    const { data, error } = await db.from("ia_documentos").insert({
      usuario_id: usuarioId, conversacion_id: convId, nombre, tipo, paginas, caracteres: final.length, texto: final,
    }).select("id").single();
    if (error) return { marcas, error: "No se pudo guardar el documento." };
    marcas.push(`⟦doc:${data.id}|${nombre}|${tipo}${paginas ? ":" + paginas : ""}⟧`);
  }
  return { marcas };
}

// Carga el texto de los documentos citados en el historial (solo los del propio usuario).
export async function cargarDocumentos(db: any, usuarioId: number, contenidos: string[]): Promise<Map<string, any>> {
  const ids = [...new Set(contenidos.flatMap((c) => [...c.matchAll(DOC_RE)].map((m) => m[1])))].slice(0, 40);
  if (!ids.length) return new Map();
  const { data } = await db.from("ia_documentos").select("id, nombre, tipo, paginas, texto").in("id", ids).eq("usuario_id", usuarioId);
  return new Map((data ?? []).map((d: any) => [d.id, d]));
}

const ETIQUETA_TIPO: Record<string, string> = { pdf: "PDF", word: "Word", excel: "Excel", csv: "CSV", texto: "texto", presentacion: "presentación" };

// Sustituye las marcas por el contenido. `presupuesto` se comparte entre mensajes (del más reciente al más antiguo).
export function expandirDocumentos(contenido: string, docs: Map<string, any>, presupuesto: { resta: number }): string {
  return contenido.replace(DOC_RE, (_, id, nombre) => {
    const d = docs.get(id);
    if (!d) return `[Documento adjunto «${nombre}»: ya no está disponible]`;
    const cab = `[Documento adjunto «${d.nombre}» · ${ETIQUETA_TIPO[d.tipo] ?? d.tipo}${d.paginas ? ` · ${d.paginas} página(s)` : ""}]`;
    let texto = d.texto as string;
    if (texto.length > presupuesto.resta) {
      const cabe = Math.max(presupuesto.resta, 3000);
      texto = texto.slice(0, cabe) + `\n[… se omitió el resto del documento por extensión (${(d.texto.length - cabe).toLocaleString("es")} caracteres)]`;
    }
    presupuesto.resta = Math.max(0, presupuesto.resta - texto.length);
    return `${cab}\n<<<INICIO DEL DOCUMENTO>>>\n${texto}\n<<<FIN DEL DOCUMENTO>>>`;
  });
}
export const nuevoPresupuesto = () => ({ resta: PRESUPUESTO_DOCS });
export const docsComoTexto = (c: string) => c.replace(DOC_RE, (_, __, nombre) => `[documento: ${nombre}]`);
export const nombresDocs = (marcas: string[]) => marcas.map((m) => (m.match(/\|([^|]*)\|/) || [])[1]).filter(Boolean);

/* ───────────── Perfil y memoria ───────────── */

const MAX_MEMORIAS = 60;

export async function obtenerPerfil(db: any, usuarioId: number) {
  const [{ data: p }, { data: m }] = await Promise.all([
    db.from("ia_perfil").select("sobre_mi, instrucciones, memoria_activa, updated_at").eq("usuario_id", usuarioId).maybeSingle(),
    db.from("ia_memorias").select("id, texto, created_at").eq("usuario_id", usuarioId).order("created_at", { ascending: true }).limit(MAX_MEMORIAS),
  ]);
  return { perfil: p ?? { sobre_mi: "", instrucciones: "", memoria_activa: true }, memorias: m ?? [] };
}

export async function guardarPerfil(db: any, usuarioId: number, p: any) {
  const fila = {
    usuario_id: usuarioId,
    sobre_mi: String(p?.sobre_mi ?? "").trim().slice(0, 1500),
    instrucciones: String(p?.instrucciones ?? "").trim().slice(0, 1500),
    memoria_activa: p?.memoria_activa !== false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("ia_perfil").upsert(fila, { onConflict: "usuario_id" });
  if (error) throw new Error("No se pudo guardar tu perfil.");
  return obtenerPerfil(db, usuarioId);
}

export async function borrarMemoria(db: any, usuarioId: number, id: unknown) {
  const q = db.from("ia_memorias").delete().eq("usuario_id", usuarioId);
  const { error } = id === "todas" ? await q : await q.eq("id", Number(id));
  if (error) throw new Error("No se pudo borrar la memoria.");
  return obtenerPerfil(db, usuarioId);
}

const SENSIBLE = /(contraseñ|password|clave\s+de\s+(acceso|correo|usuario|wifi|red)|\bpin\b|\btoken\s+de\s+acceso|tarjeta\s+de\s+cr[eé]dito|\b\d{13,19}\b|\bcvv\b|\bdpi\b|\b\d{4}\s?\d{5}\s?\d{4}\b)/i;

export async function recordar(db: any, usuarioId: number, dato: unknown): Promise<{ ok: boolean; texto: string; motivo?: string }> {
  const texto = String(dato ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (texto.length < 3) return { ok: false, texto, motivo: "vacío" };
  if (SENSIBLE.test(texto)) return { ok: false, texto, motivo: "sensible" };
  const { count } = await db.from("ia_memorias").select("id", { count: "exact", head: true }).eq("usuario_id", usuarioId);
  if ((count ?? 0) >= MAX_MEMORIAS) return { ok: false, texto, motivo: "lleno" };
  const { error } = await db.from("ia_memorias").insert({ usuario_id: usuarioId, texto });
  return error ? { ok: false, texto, motivo: "error" } : { ok: true, texto };
}

export async function olvidar(db: any, usuarioId: number, id: unknown): Promise<string | null> {
  const { data } = await db.from("ia_memorias").delete().eq("usuario_id", usuarioId).eq("id", Number(id)).select("texto").maybeSingle();
  return data?.texto ?? null;
}

export const HERRAMIENTAS_MEMORIA = [
  {
    type: "function",
    function: {
      name: "guardar_memoria",
      description: "Guarda un dato breve y duradero sobre la persona para recordarlo en futuras conversaciones: cuando pida explícitamente que recuerdes algo, o cuando comparta su cargo, área, proyectos en curso o preferencias de formato. No guardes datos sensibles (contraseñas, números de tarjeta, documentos de identidad, salud) ni información pasajera.",
      parameters: { type: "object", properties: { dato: { type: "string", description: "El dato en tercera persona, en una frase corta. Ej.: «Trabaja en Contabilidad y prepara el cierre mensual»." } }, required: ["dato"] },
    },
  },
  {
    type: "function",
    function: {
      name: "olvidar_memoria",
      description: "Borra un dato de la memoria cuando la persona pida olvidarlo o cuando ya no sea cierto. Usa el número entre corchetes de la lista MEMORIA.",
      parameters: { type: "object", properties: { id: { type: "integer", description: "Número del dato en la lista MEMORIA." } }, required: ["id"] },
    },
  },
];
export const NOMBRES_MEMORIA = ["guardar_memoria", "olvidar_memoria"];

export function promptPerfil(perfil: any, memorias: any[]): string {
  const partes: string[] = [];
  if (perfil?.sobre_mi) partes.push(`Sobre la persona (lo escribió ella): ${perfil.sobre_mi}`);
  if (perfil?.instrucciones) partes.push(`Cómo quiere que respondas (lo escribió ella): ${perfil.instrucciones}`);
  let out = partes.length ? `\n\nPERFIL PERSONAL\n${partes.join("\n")}\nAdapta tus respuestas a esto salvo que contradiga las REGLAS.` : "";
  if (perfil?.memoria_activa !== false) {
    out += memorias.length
      ? `\n\nMEMORIA (datos que recuerdas de conversaciones anteriores; úsalos con naturalidad cuando aporten, sin enumerarlos):\n${memorias.map((m) => `- [${m.id}] ${m.texto}`).join("\n")}`
      : "\n\nMEMORIA: aún no recuerdas nada de esta persona.";
    out += `\nPara recordar algo nuevo usa "guardar_memoria"; para olvidar, "olvidar_memoria". Si la persona pregunta qué recuerdas de ella, díselo con base en la lista. Recuerda que puede ver y borrar su memoria en «Personalizar».`;
  }
  return out;
}

/* ───────────── Voz ───────────── */

const EXT_AUDIO: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a", "audio/aac": "m4a" };
export const MAX_BYTES_AUDIO = 12 * 1024 * 1024;

export async function transcribir(key: string, ids: string[], bytes: Uint8Array, mime: string) {
  const base = mime.split(";")[0];
  const ext = EXT_AUDIO[base];
  if (!ext) throw new Error("Formato de audio no compatible.");
  const modelos = [Deno.env.get("OPENAI_TRANSCRIBE_MODEL"), "gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"]
    .filter((m): m is string => !!m && (ids.includes(m) || m === Deno.env.get("OPENAI_TRANSCRIBE_MODEL")));
  for (const modelo of [...new Set(modelos.length ? modelos : ["whisper-1"])]) {
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: base }), `audio.${ext}`);
    fd.append("model", modelo);
    fd.append("language", "es");
    fd.append("response_format", "json");
    const r = await fetch(`${OPENAI}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd });
    if (r.ok) {
      const d = await r.json();
      const u = d.usage ?? {};
      return { texto: String(d.text ?? "").trim(), modelo, entrada: u.input_tokens ?? Math.ceil(bytes.length / 2000), salida: u.output_tokens ?? Math.ceil(String(d.text ?? "").length / 4) };
    }
    const txt = await r.text();
    console.log(JSON.stringify({ nivel: "warn", evento: "transcripcion_fallo", modelo, status: r.status, detalle: txt.slice(0, 200) }));
    if (r.status === 401 || /insufficient_quota|billing/i.test(txt)) break;
  }
  throw new Error("No pude transcribir el audio. Intenta de nuevo.");
}

export async function hablar(key: string, ids: string[], texto: string) {
  const modelos = [Deno.env.get("OPENAI_TTS_MODEL"), "gpt-4o-mini-tts", "tts-1-hd", "tts-1"]
    .filter((m): m is string => !!m && (ids.includes(m) || m === Deno.env.get("OPENAI_TTS_MODEL")));
  for (const modelo of [...new Set(modelos.length ? modelos : ["tts-1"])]) {
    const nuevo = modelo.startsWith("gpt-");
    const body: any = { model: modelo, input: texto, voice: nuevo ? "coral" : "nova", response_format: "mp3" };
    if (nuevo) body.instructions = "Habla en español latinoamericano neutro, con tono cálido, claro y profesional, a ritmo natural.";
    const r = await fetch(`${OPENAI}/audio/speech`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    if (r.ok) return { audio: new Uint8Array(await r.arrayBuffer()), modelo };
    const txt = await r.text();
    console.log(JSON.stringify({ nivel: "warn", evento: "voz_fallo", modelo, status: r.status, detalle: txt.slice(0, 200) }));
    if (r.status === 401 || /insufficient_quota|billing/i.test(txt)) break;
  }
  throw new Error("No pude generar el audio.");
}

/* ───────────── Calificación de respuestas ───────────── */

export const MOTIVOS = ["Incorrecta", "Incompleta", "No entendió", "Muy larga", "Desactualizada", "Otro"];

export async function valorar(db: any, user: any, p: any) {
  const mensajeId = Number(p.mensaje_id);
  if (!Number.isInteger(mensajeId) || mensajeId <= 0) throw new Error("Mensaje no encontrado");
  const { data: m } = await db.from("ia_mensajes").select("id, rol, conversacion_id, modelo, nivel, ia_conversaciones!inner(usuario_id)")
    .eq("id", mensajeId).eq("ia_conversaciones.usuario_id", user.id).maybeSingle();
  if (!m || m.rol !== "assistant") throw new Error("Mensaje no encontrado");
  const valor = Number(p.valor);
  if (valor === 0) { await db.from("ia_valoraciones").delete().eq("mensaje_id", mensajeId).eq("usuario_id", user.id); return { ok: true, valor: 0 }; }
  if (![1, -1].includes(valor)) throw new Error("Valor no válido");
  const motivo = valor === -1 && MOTIVOS.includes(p.motivo) ? p.motivo : null;
  const { error } = await db.from("ia_valoraciones").upsert({
    usuario_id: user.id, conversacion_id: m.conversacion_id, mensaje_id: mensajeId, valor, motivo,
    comentario: valor === -1 ? String(p.comentario ?? "").trim().slice(0, 600) || null : null,
    modelo: m.modelo, nivel: m.nivel, updated_at: new Date().toISOString(),
  }, { onConflict: "mensaje_id" });
  if (error) throw new Error("No se pudo guardar tu calificación.");
  return { ok: true, valor };
}

export async function valoracionesDe(db: any, usuarioId: number, convId: string) {
  const { data } = await db.from("ia_valoraciones").select("mensaje_id, valor, motivo").eq("conversacion_id", convId).eq("usuario_id", usuarioId);
  return data ?? [];
}

export async function panelCalidad(db: any, dias = 30) {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const { data: vs } = await db.from("ia_valoraciones")
    .select("id, valor, motivo, comentario, modelo, nivel, created_at, mensaje_id, conversacion_id, usuario:usuarios!ia_valoraciones_usuario_id_fkey(nombre, correo)")
    .gte("created_at", desde).order("created_at", { ascending: false }).limit(5000);
  const lista = vs ?? [];
  const agrupar = (k: string) => {
    const o: Record<string, { n: number; pos: number }> = {};
    for (const v of lista) { const c = String(v[k] ?? "Sin dato"); (o[c] ??= { n: 0, pos: 0 }).n++; if (v.valor === 1) o[c].pos++; }
    return Object.entries(o).map(([clave, x]) => ({ clave, ...x, satisfaccion: Math.round(x.pos / x.n * 100) })).sort((a, b) => b.n - a.n);
  };
  const motivos: Record<string, number> = {};
  for (const v of lista) if (v.valor === -1) motivos[v.motivo ?? "Sin motivo"] = (motivos[v.motivo ?? "Sin motivo"] ?? 0) + 1;

  const negativos = lista.filter((v: any) => v.valor === -1).slice(0, 25);
  const detalles = await Promise.all(negativos.map(async (v: any) => {
    const [{ data: resp }, { data: preg }] = await Promise.all([
      db.from("ia_mensajes").select("contenido").eq("id", v.mensaje_id).maybeSingle(),
      db.from("ia_mensajes").select("contenido").eq("conversacion_id", v.conversacion_id).eq("rol", "user").lt("id", v.mensaje_id).order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const corto = (s: string | undefined, n: number) => docsComoTexto(String(s ?? "")).replace(/!\[[^\]]*\]\([^)]*\)/g, "[imagen]").replace(/⟦[^⟧]*⟧/g, "").trim().slice(0, n);
    return { id: v.id, fecha: v.created_at, usuario: v.usuario?.nombre ?? "—", motivo: v.motivo, comentario: v.comentario, modelo: v.modelo, nivel: v.nivel, pregunta: corto(preg?.contenido, 400), respuesta: corto(resp?.contenido, 700) };
  }));

  const pos = lista.filter((v: any) => v.valor === 1).length;
  return {
    dias, total: lista.length, positivas: pos, negativas: lista.length - pos,
    satisfaccion: lista.length ? Math.round(pos / lista.length * 100) : null,
    por_nivel: agrupar("nivel"), por_modelo: agrupar("modelo"),
    motivos: Object.entries(motivos).map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n),
    negativas_recientes: detalles,
  };
}

// Base de conocimiento (Obsidian ⇄ nube): sincronización, búsqueda semántica y lectura.
// La bóveda local es la fuente de verdad; aquí vive un espejo para el visor web y la IA.
const OPENAI = "https://api.openai.com/v1";
export const AUDIENCIAS = ["Colaboradores", "Solo TI", "Externos"];
export const audienciasPara = (user: any) => (user.rol === "admin" ? AUDIENCIAS : ["Colaboradores", "Externos"]);

const UMBRAL = 0.32; // similitud mínima para considerar un fragmento relevante

/* ───────────── Embeddings ───────────── */

let modeloEmb: string | null = null;
const esV3 = (m: string) => m.startsWith("text-embedding-3");

export async function embeber(key: string, textos: string[]): Promise<number[][] | null> {
  if (!textos.length) return [];
  const candidatos = [...new Set([Deno.env.get("KB_EMBED_MODEL"), modeloEmb, "text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"].filter(Boolean) as string[])];
  for (const modelo of candidatos) {
    const out: number[][] = [];
    let ok = true;
    for (let i = 0; i < textos.length && ok; i += 64) {
      const body: any = { model: modelo, input: textos.slice(i, i + 64).map((t) => t.slice(0, 6000)) };
      if (esV3(modelo)) body.dimensions = 1536; // la columna es vector(1536)
      const r = await fetch(`${OPENAI}/embeddings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
      if (!r.ok) { console.log(JSON.stringify({ nivel: "warn", evento: "embedding_fallo", modelo, status: r.status })); ok = false; break; }
      const d = await r.json();
      for (const e of [...d.data].sort((a: any, b: any) => a.index - b.index)) out.push(e.embedding);
    }
    if (ok) { modeloEmb = modelo; return out; }
  }
  return null;
}

/* ───────────── Fragmentación ───────────── */

export function trocear(titulo: string, contenido: string): string[] {
  const limpio = contenido
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\r/g, "");
  const out: string[] = [];
  for (const sec of limpio.split(/\n(?=#{1,3}\s)/)) {
    const s = sec.trim(); if (!s) continue;
    const prefijo = `${titulo}\n`;
    if (s.length <= 1200) { out.push(prefijo + s); continue; }
    const cab = /^#{1,3}\s.*/.test(s) ? s.split("\n")[0] + "\n" : "";
    let acum = "";
    for (const p of s.split(/\n{2,}/)) {
      if (acum && acum.length + p.length > 1100) { out.push(prefijo + cab + acum.trim()); acum = ""; }
      acum += p + "\n\n";
    }
    if (acum.trim()) out.push(prefijo + cab + acum.trim());
  }
  return out.filter((t) => t.length > 60);
}

/* ───────────── Sincronización (solo admin) ───────────── */

export async function estadoKb(db: any) {
  const { data } = await db.from("kb_notas").select("ruta, hash, updated_at").limit(10000);
  return { notas: data ?? [], total: (data ?? []).length };
}

export async function sincronizar(db: any, key: string, notas: any[], borrar: string[]) {
  const res = { subidas: 0, borradas: 0, errores: [] as string[], embeddings: true };
  for (const n of notas.slice(0, 20)) {
    try {
      const ruta = String(n.ruta ?? "").slice(0, 500), titulo = String(n.titulo ?? "").slice(0, 300), contenido = String(n.contenido ?? "");
      if (!ruta || !titulo || !contenido.trim()) throw new Error("nota incompleta");
      if (contenido.length > 300_000) throw new Error("nota demasiado grande");
      const audiencia = AUDIENCIAS.includes(n.audiencia) ? n.audiencia : "Colaboradores";
      const { data: fila, error } = await db.from("kb_notas").upsert({
        ruta, titulo, categoria: n.categoria ? String(n.categoria).slice(0, 200) : null, audiencia, estado: n.estado ? String(n.estado).slice(0, 100) : null,
        tags: Array.isArray(n.tags) ? n.tags.map((t: any) => String(t).slice(0, 80)).slice(0, 30) : [], contenido,
        hash: String(n.hash ?? "").slice(0, 100), fecha_modificacion: n.mtime ? new Date(n.mtime).toISOString() : null, updated_at: new Date().toISOString(),
      }, { onConflict: "ruta" }).select("id").single();
      if (error) throw error;
      await db.from("kb_chunks").delete().eq("nota_id", fila.id);
      const trozos = trocear(titulo, contenido);
      const emb = await embeber(key, trozos);
      if (!emb) res.embeddings = false;
      const filas = trozos.map((texto, i) => ({ nota_id: fila.id, orden: i, texto, embedding: emb ? JSON.stringify(emb[i]) : null }));
      for (let i = 0; i < filas.length; i += 40) {
        const { error: e2 } = await db.from("kb_chunks").insert(filas.slice(i, i + 40));
        if (e2) throw e2;
      }
      res.subidas++;
    } catch (e) {
      res.errores.push(`${String(n?.ruta ?? "?").slice(0, 120)}: ${String((e as any)?.message ?? e).slice(0, 160)}`);
    }
  }
  const rutas = (borrar ?? []).map((r) => String(r)).slice(0, 300);
  if (rutas.length) {
    const { data } = await db.from("kb_notas").delete().in("ruta", rutas).select("id");
    res.borradas = data?.length ?? 0;
  }
  return res;
}

/* ───────────── Lectura y búsqueda ───────────── */

export async function listarKb(db: any, user: any) {
  const { data } = await db.from("kb_notas").select("id, ruta, titulo, categoria, audiencia, estado, tags, updated_at")
    .in("audiencia", audienciasPara(user)).order("categoria", { ascending: true }).order("titulo", { ascending: true }).limit(2000);
  return data ?? [];
}

export async function leerKb(db: any, user: any, id: string) {
  const { data } = await db.from("kb_notas").select("id, ruta, titulo, categoria, audiencia, estado, tags, contenido, updated_at")
    .eq("id", id).in("audiencia", audienciasPara(user)).maybeSingle();
  return data;
}

export async function buscarKb(db: any, key: string | undefined, user: any, consulta: string, k = 6) {
  const emb = key ? await embeber(key, [consulta]).catch(() => null) : null;
  const { data, error } = await db.rpc("kb_buscar", {
    p_embedding: emb ? JSON.stringify(emb[0]) : null, p_texto: consulta, p_k: k, p_audiencias: audienciasPara(user),
  });
  if (error) { console.log(JSON.stringify({ nivel: "error", evento: "kb_buscar", mensaje: error.message })); return []; }
  const filas = (data ?? []) as any[];
  return emb ? filas.filter((f) => f.similitud >= UMBRAL) : filas;
}

// Fragmentos para el prompt del chat + ids de las notas citables.
export async function contextoKb(db: any, key: string, user: any, consulta: string) {
  const filas = await buscarKb(db, key, user, consulta, 6);
  if (!filas.length) return null;
  const bloques = filas.map((f, i) => `[${i + 1}] «${f.titulo}» (${f.categoria ?? "General"} · Estado: ${f.estado ?? "—"})\n${f.texto.replace(/^[^\n]*\n/, "").slice(0, 1400)}`);
  const fuentes = [...new Set(filas.map((f) => f.nota_id as string))].slice(0, 3);
  return {
    fuentes,
    prompt: `\n\nBASE DE CONOCIMIENTO (fragmentos relevantes de la documentación interna de Alterna):\n${bloques.join("\n\n")}\n\nSi respondes con base en estos fragmentos, sigue los pasos tal como están y menciona la fuente como (Fuente: «título»). Si el estado del artículo es «Pendiente de validación», avisa que ese procedimiento aún no está validado. Si los fragmentos no responden la pregunta, dilo y no inventes.`,
  };
}

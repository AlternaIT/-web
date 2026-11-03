// Herramientas avanzadas de Alterna IA: búsqueda en internet y ejecución de código (Python).
// El chat principal (Chat Completions) decide cuándo usarlas con una llamada a función; aquí se resuelven
// con la API de Responses de OpenAI y sus herramientas integradas (web_search y code_interpreter),
// transmitiendo la respuesta al usuario a medida que llega.
const OPENAI = "https://api.openai.com/v1";

export const NOMBRES_AVANZADAS = ["buscar_web", "ejecutar_codigo"];

export const HERRAMIENTAS_AVANZADAS = [
  {
    type: "function",
    function: {
      name: "buscar_web",
      description: "Busca en internet información actual o verificable: noticias, precios, tipos de cambio, clima, eventos, versiones de software, documentación técnica, leyes, datos de empresas o cualquier dato que pueda haber cambiado. Úsala también cuando el usuario pida buscar, investigar o citar fuentes.",
      parameters: {
        type: "object",
        properties: { consulta: { type: "string", description: "Qué buscar, en una frase clara y específica." } },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ejecutar_codigo",
      description: "Ejecuta código Python en un entorno aislado para obtener resultados reales: cálculos exactos, estadísticas, análisis o transformación de datos que el usuario pegó, conversión de formatos, o probar y depurar un programa. Úsala cuando el resultado deba calcularse de verdad en lugar de estimarse.",
      parameters: {
        type: "object",
        properties: { tarea: { type: "string", description: "Qué debe calcular o comprobar el código." } },
        required: ["tarea"],
      },
    },
  },
];

type Resultado = { entrada: number; salida: number; modelo: string };

const esRazonador = (m: string) => /^(gpt-5|o\d)/.test(m);

// Chat Completions → Responses (mismo historial, imágenes incluidas).
function aEntrada(messages: any[]) {
  return messages.filter((m) => m.role !== "system").map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: m.content.map((p: any) => p.type === "image_url"
        ? { type: "input_image", image_url: p.image_url.url }
        : { type: m.role === "assistant" ? "output_text" : "input_text", text: p.text }),
    };
  });
}

function cuerpo(modelo: string, tipo: string, instrucciones: string, input: any[], maxSalida?: number) {
  const b: any = {
    model: modelo, instructions: instrucciones, input, stream: true, tool_choice: "required",
    max_output_tokens: Math.min(esRazonador(modelo) ? 16000 : 4000, Math.max(maxSalida ?? Infinity, esRazonador(modelo) ? 2000 : 800)),
    tools: tipo === "code_interpreter" ? [{ type: "code_interpreter", container: { type: "auto" } }] : [{ type: tipo }],
  };
  if (tipo === "code_interpreter") b.include = ["code_interpreter_call.outputs"];
  return JSON.stringify(b);
}

// Resuelve la herramienta y va llamando a `emitir` con el texto (Markdown) que verá el usuario.
export async function responderConHerramienta(
  key: string, candidatos: string[], nombre: string, args: Record<string, any>,
  instrucciones: string, messages: any[], emitir: (t: string) => void, maxSalida?: number,
  subir?: (bytes: Uint8Array, mime: string) => Promise<string>,
): Promise<Resultado | null> {
  const web = nombre === "buscar_web";
  const guia = web
    ? `\n\nBÚSQUEDA EN INTERNET: busca "${String(args.consulta ?? "").slice(0, 300)}" y responde con lo que encuentres. Prioriza fuentes oficiales y recientes, indica la fecha de los datos cuando importe y no inventes nada que no esté en los resultados.`
    : `\n\nEJECUCIÓN DE CÓDIGO: escribe y ejecuta Python para: ${String(args.tarea ?? "").slice(0, 500)}. Después explica el resultado en español, de forma breve y clara. Si la persona pidió una gráfica, calcula los datos con Python y al final entrega un bloque \`\`\`grafica con el JSON (tipo, titulo, etiquetas, series, ejeX, ejeY, formato) en lugar de dibujarla con matplotlib, salvo que pida expresamente una imagen.`;
  const tipos = web ? ["web_search", "web_search_preview"] : ["code_interpreter"];
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  const input = aEntrada(messages);

  for (const modelo of candidatos.filter((m) => !/mini|nano/.test(m)).concat(candidatos.filter((m) => /mini|nano/.test(m)))) {
    for (const tipo of tipos) {
      const r = await fetch(`${OPENAI}/responses`, { method: "POST", headers, body: cuerpo(modelo, tipo, instrucciones + guia, input, maxSalida) });
      if (!r.ok || !r.body) {
        const txt = await r.text();
        console.log(JSON.stringify({ nivel: "warn", evento: "herramienta_fallo", nombre, modelo, tipo, status: r.status, detalle: txt.slice(0, 200) }));
        if (r.status === 401 || /insufficient_quota|billing/i.test(txt)) return null;
        continue; // otro tipo de herramienta u otro modelo
      }
      return await transmitir(r, modelo, web, emitir, key, subir);
    }
  }
  return null;
}

// Imagen producida por el código (p. ej. una gráfica de matplotlib): se guarda y se muestra en el chat.
async function imagenDeCodigo(key: string, subir: ((b: Uint8Array, m: string) => Promise<string>) | undefined, fuente: { url?: string; container_id?: string; file_id?: string }): Promise<string | null> {
  if (!subir) return null;
  try {
    let bytes: Uint8Array | null = null, mime = "image/png";
    if (fuente.url?.startsWith("data:image/")) {
      const [cab, b64] = fuente.url.split(",");
      mime = cab.slice(5, cab.indexOf(";")) || "image/png";
      const bin = atob(b64); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      const url = fuente.container_id && fuente.file_id ? `${OPENAI}/containers/${fuente.container_id}/files/${fuente.file_id}/content` : fuente.url;
      if (!url) return null;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
      if (!r.ok) return null;
      mime = (r.headers.get("content-type") || "").split(";")[0];
      if (!/^image\/(png|jpeg|webp)$/.test(mime)) return null;
      bytes = new Uint8Array(await r.arrayBuffer());
    }
    if (!bytes || bytes.length > 8 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(mime)) return null;
    return await subir(bytes, mime);
  } catch { return null; }
}

async function transmitir(r: Response, modelo: string, web: boolean, emitir: (t: string) => void, key: string, subir?: (b: Uint8Array, m: string) => Promise<string>): Promise<Resultado> {
  const rd = r.body!.getReader(), dec = new TextDecoder();
  let buf = "", hayTexto = false;
  const res: Resultado = { entrada: 0, salida: 0, modelo };
  const fuentes = new Map<string, string>();
  const archivos = new Set<string>(); // imágenes ya mostradas

  while (true) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const ls = buf.split("\n"); buf = ls.pop() ?? "";
    for (const l of ls) {
      if (!l.startsWith("data:")) continue;
      let j: any; try { j = JSON.parse(l.slice(5).trim()); } catch { continue; }
      if (j.type === "response.output_text.delta" && j.delta) { emitir(j.delta); hayTexto = true; }
      else if (j.type === "response.output_text.annotation.added" && j.annotation?.type === "url_citation") fuentes.set(j.annotation.url, j.annotation.title || j.annotation.url);
      else if (j.type === "response.output_item.done" && j.item?.type === "code_interpreter_call" && j.item.code) {
        // El código que realmente se ejecutó y su salida, para que el usuario pueda revisarlo
        const logs = (j.item.outputs ?? []).filter((o: any) => o.type === "logs" && o.logs).map((o: any) => o.logs).join("\n").trim();
        emitir(`${hayTexto ? "\n\n" : ""}**Código ejecutado**\n\n\`\`\`python\n${j.item.code.trim()}\n\`\`\`\n` + (logs ? `\n**Resultado**\n\n\`\`\`text\n${logs.slice(0, 4000)}\n\`\`\`\n` : "") + "\n");
        hayTexto = true;
        for (const o of j.item.outputs ?? []) if (o.type === "image" && o.url && !archivos.has(o.url)) {
          archivos.add(o.url);
          const u = await imagenDeCodigo(key, subir, { url: o.url });
          if (u) emitir(`![Gráfica generada](${u})\n\n`);
        }
      } else if (j.type === "response.output_text.annotation.added" && j.annotation?.type === "container_file_citation" && /\.(png|jpe?g|webp)$/i.test(j.annotation.filename ?? "")) {
        const a = j.annotation, k = a.container_id + "/" + a.file_id;
        if (!archivos.has(k)) { archivos.add(k); const u = await imagenDeCodigo(key, subir, a); if (u) { emitir(`\n\n![${String(a.filename).replace(/[\[\]]/g, "")}](${u})\n\n`); hayTexto = true; } }
      } else if (j.type === "response.completed" || j.type === "response.incomplete") {
        const u = j.response?.usage; if (u) { res.entrada = u.input_tokens ?? 0; res.salida = u.output_tokens ?? 0; }
        for (const it of j.response?.output ?? []) for (const c of it.content ?? []) for (const a of c.annotations ?? [])
          if (a.type === "url_citation" && a.url) fuentes.set(a.url, a.title || a.url);
      } else if (j.type === "response.failed" || j.type === "error") {
        console.log(JSON.stringify({ nivel: "error", evento: "herramienta_stream", detalle: JSON.stringify(j).slice(0, 300) }));
        if (!hayTexto) emitir("⚠️ No se pudo completar la búsqueda o la ejecución. Intenta de nuevo.");
      }
    }
  }

  if (web && fuentes.size) {
    const lista = [...fuentes].slice(0, 6).map(([url, titulo], i) => `${i + 1}. [${titulo.replace(/[\[\]\n]/g, " ").slice(0, 90)}](${url})`);
    emitir(`\n\n**Fuentes**\n${lista.join("\n")}`);
  }
  return res;
}

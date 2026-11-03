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
): Promise<Resultado | null> {
  const web = nombre === "buscar_web";
  const guia = web
    ? `\n\nBÚSQUEDA EN INTERNET: busca "${String(args.consulta ?? "").slice(0, 300)}" y responde con lo que encuentres. Prioriza fuentes oficiales y recientes, indica la fecha de los datos cuando importe y no inventes nada que no esté en los resultados.`
    : `\n\nEJECUCIÓN DE CÓDIGO: escribe y ejecuta Python para: ${String(args.tarea ?? "").slice(0, 500)}. Después explica el resultado en español, de forma breve y clara.`;
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
      return await transmitir(r, modelo, web, emitir);
    }
  }
  return null;
}

async function transmitir(r: Response, modelo: string, web: boolean, emitir: (t: string) => void): Promise<Resultado> {
  const rd = r.body!.getReader(), dec = new TextDecoder();
  let buf = "", hayTexto = false;
  const res: Resultado = { entrada: 0, salida: 0, modelo };
  const fuentes = new Map<string, string>();

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

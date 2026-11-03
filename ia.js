/* ═══════════════════════════════════════════
   ALTERNA IA — página de chat
   Sesión: reutiliza el login del sistema (localStorage "usuario").
   Backend: Edge Function "alterna-ai" (historial, streaming, imágenes, visión).
═══════════════════════════════════════════ */
const SUPABASE_URL = "https://nxbncqixxlmdvepapuqe.supabase.co";
const SUPABASE_KEY = "sb_publishable_2nsr-fPUd1FJYLyWJf_UiQ_N7kaYKFv";
const ENDPOINT = SUPABASE_URL + "/functions/v1/alterna-ai";
const MAX_ADJ = 3;

/* ── Sesión ── */
let usuario = null;
try { usuario = JSON.parse(localStorage.getItem("usuario")); } catch { /* sin sesión */ }
if (!usuario?.id) { window.location.replace("index.html"); throw new Error("Sin sesión"); }
const credenciales = () => ({ usuario_id: usuario.id, correo: usuario.correo, token: usuario.token });

/* ── Iconos ── */
const svg = (d, s = 18, extra = "") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const I = {
    spark: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zm7 11l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13zM5 14l.7 2 2 .7-2 .7L5 19.5l-.7-2.1-2-.7 2-.7L5 14z"/></svg>',
    sparkS: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zm7 11l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13z"/></svg>',
    send: svg('<path d="M12 19V5M5 12l7-7 7 7"/>', 18, 'stroke-width="2.4"'),
    stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
    copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>', 14),
    edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>', 14),
    del: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>', 14),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>'),
    cal: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    chart: svg('<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>'),
    tool: svg('<path d="M14.7 6.3a4 4 0 005.4 5.4L21 13l-8 8-4-4 8-8-2.3-2.7zM9 17l-5 5"/>'),
    pc: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
    img: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    clip: svg('<path d="M21 12.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.2-8.2"/>', 20),
    dl: svg('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', 14),
    exp: svg('<path d="M12 3v12M7 8l5-5 5 5M4 21h16"/>'),
    regen: svg('<path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/>', 14),
    x: svg('<path d="M18 6L6 18M6 6l12 12"/>', 12, 'stroke-width="2.6"'),
    pdf: svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6"/>', 14),
    xls: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>', 14),
    play: svg('<path d="M7 5l12 7-12 7V5z"/>', 13),
    shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>', 16),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', 19),
    up: svg('<path d="M7 10v11H4V10h3zM7 10l4-7a2 2 0 012.6 1.9V9h5.6a2 2 0 012 2.3l-1.4 8A2 2 0 0117.8 21H7"/>', 14),
    down: svg('<path d="M17 14V3h3v11h-3zM17 14l-4 7a2 2 0 01-2.6-1.9V15H4.8a2 2 0 01-2-2.3l1.4-8A2 2 0 016.2 3H17"/>', 14),
    voz: svg('<path d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>', 14),
    pausa: svg('<path d="M9 5v14M15 5v14"/>', 14, 'stroke-width="2.6"'),
    yo: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', 15),
    doc: svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5"/>', 18),
    tabla: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>', 14),
    png: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', 14),
};
// Icono y color de cada tipo de documento
const TIPO_DOC = {
    pdf: { e: "PDF", c: "#dc2626" }, word: { e: "DOC", c: "#2563eb" }, excel: { e: "XLS", c: "#059669" },
    csv: { e: "CSV", c: "#059669" }, presentacion: { e: "PPT", c: "#ea580c" }, texto: { e: "TXT", c: "#6b7280" },
};

const SUGERENCIAS = [
    { i: I.mail,  t: "Redactar un correo",     d: "Comunicados y respuestas listos para enviar.", p: "Ayúdame a redactar un correo profesional. Primero pregúntame a quién va dirigido y qué necesito comunicar." },
    { i: I.pdf,   t: "Analizar un documento",  d: "PDF, Word, Excel o PowerPoint.",               adj: true },
    { i: I.edit,  t: "Corregir un texto",      d: "Ortografía, tono y claridad.",                 p: "Voy a pegarte un texto. Corrige ortografía y redacción, mejora la claridad y dime qué cambiaste." },
    { i: I.cal,   t: "Preparar una reunión",   d: "Agenda, puntos clave y minuta.",               p: "Ayúdame a preparar una reunión: propón una agenda clara y una plantilla de minuta para anotar acuerdos, responsables y fechas." },
    { i: I.chart, t: "Crear una gráfica",      d: "A partir de tus datos o de un Excel.",          p: "Quiero crear una gráfica. Pregúntame qué datos quiero mostrar (puedo pegarlos o adjuntar un Excel) y qué tipo de gráfica me conviene." },
    { i: I.img,   t: "Crear una imagen",       d: "Logos, banners, ilustraciones y mockups.",     p: "Genera una imagen profesional de un banner horizontal para una campaña de Alterna, estilo moderno, cálido y cercano." },
];

/* ── Utilidades ── */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function toast(t) { const e = $("toast"); e.textContent = t; e.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("show"), 2200); }
async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); }
    catch { const a = document.createElement("textarea"); a.value = texto; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); }
    toast("Copiado");
}
const IMG_MD = /!\[([^\]]*)\]\((https:\/\/[^\s)]+\/storage\/v1\/object\/public\/ia-imagenes\/[^\s)]+)\)/g;
const sinImagenes = t => t.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\u27E6[^\u27E7]*\u27E7/g, "").trim();

/* ── Markdown (seguro: todo se escapa antes de dar formato) ── */
function inline(s) {
    const codes = [];
    s = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = s.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+\/storage\/v1\/object\/public\/ia-imagenes\/[^\s)]+)\)/g,
            (_, alt, url) => `<span class="imgbox"><img src="${url}" alt="${alt}" loading="lazy"><span class="imgtools"><button type="button" data-dl="${url}">${I.dl} Descargar</button></span></span>`)
         .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
         .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
         .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => "<code>" + codes[i] + "</code>");
}

function bloques(texto) {
    const L = texto.split("\n"); let out = "", i = 0;
    const esTabla = (k) => /\|/.test(L[k] || "") && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(L[k + 1] || "");
    const celdas = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    while (i < L.length) {
        const l = L[i];
        if (!l.trim()) { i++; continue; }
        let m;
        if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue; }
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out += "<hr>"; i++; continue; }
        if (esTabla(i)) {
            const cab = celdas(L[i]); i += 2; let filas = "";
            while (i < L.length && /\|/.test(L[i]) && L[i].trim()) { filas += "<tr>" + celdas(L[i]).map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>"; i++; }
            out += '<div class="tw"><table><thead><tr>' + cab.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" + filas + "</tbody></table></div>"; continue;
        }
        if (/^>\s?/.test(l)) { let q = []; while (i < L.length && /^>\s?/.test(L[i])) q.push(L[i++].replace(/^>\s?/, "")); out += "<blockquote>" + inline(q.join(" ")) + "</blockquote>"; continue; }
        if (/^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
            const ord = /^\s*\d+[.)]\s+/.test(l); let items = "";
            while (i < L.length && (ord ? /^\s*\d+[.)]\s+/.test(L[i]) : /^\s*[-*•]\s+/.test(L[i]))) { items += "<li>" + inline(L[i].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")) + "</li>"; i++; }
            out += (ord ? "<ol>" : "<ul>") + items + (ord ? "</ol>" : "</ul>"); continue;
        }
        let p = [];
        while (i < L.length && L[i].trim() && !/^(#{1,4}\s|>\s?|\s*[-*•]\s+|\s*\d+[.)]\s+)/.test(L[i]) && !esTabla(i)) p.push(L[i++]);
        out += "<p>" + inline(p.join("\n")).replace(/\n/g, "<br>") + "</p>";
    }
    return out;
}

// vivo = la respuesta aún está llegando (las gráficas se dibujan al terminar)
let renderVivo = false;
function md(src, vivo = false) {
    // Mensajes antiguos pueden traer la marca ⟦fuentes:…⟧ de la base de conocimiento (ya retirada): se oculta
    src = src.replace(/\n*⟦fuentes:[0-9a-f,-]*⟧?/g, "");
    renderVivo = vivo;
    try { return mdSinFuentes(src); } finally { renderVivo = false; }
}

function mdSinFuentes(src) {
    const partes = src.split(/\u27E6accion:([0-9a-f-]{36})\u27E7/);
    return partes.map((p, i) => i % 2 === 0 ? (p.trim() ? mdTexto(p) : "") : `<div class="acc" data-acc="${p}"><div class="acc-load">Preparando acción…</div></div>`).join("");
}

// Marcas de progreso del backend: solo se muestran mientras son lo último que llegó.
const MARCAS_RE = /⟦(imagen|buscando|ejecutando)⟧/g;
const MSG_RE = /⟦msg:(\d+)⟧/;
const quitarMarcas = t => t.replace(MARCAS_RE, "").replace(/⟦msg:\d+⟧/g, "");
const marcaFinal = t => (t.trimEnd().match(/⟦(imagen|buscando|ejecutando)⟧$/) || [])[1] || null;
const PROGRESO = {
    buscando: `<div class="prog">${svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>', 16, 'class="prog-ic gira"')}<span>Buscando en internet</span><i class="prog-dots"><b></b><b></b><b></b></i></div>`,
    ejecutando: `<div class="prog">${svg('<path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12"/>', 16, 'class="prog-ic late"')}<span>Ejecutando código</span><i class="prog-dots"><b></b><b></b><b></b></i></div>`,
};

// Lenguaje del bloque → extensión al descargar
const EXT = { javascript: "js", js: "js", typescript: "ts", ts: "ts", python: "py", py: "py", html: "html", css: "css", json: "json", sql: "sql", bash: "sh", sh: "sh", shell: "sh", powershell: "ps1", ps1: "ps1", java: "java", csharp: "cs", "c#": "cs", cs: "cs", php: "php", go: "go", rust: "rs", c: "c", cpp: "cpp", "c++": "cpp", ruby: "rb", kotlin: "kt", swift: "swift", yaml: "yml", yml: "yml", xml: "xml", markdown: "md", md: "md", jsx: "jsx", tsx: "tsx", vue: "vue", dart: "dart", r: "r", svg: "svg", text: "txt" };
const conVistaPrevia = lang => /^(html|svg)$/i.test(lang);

function mdTexto(src) {
    const marca = marcaFinal(src);
    src = quitarMarcas(src);
    const partes = src.split("```"); let out = "";
    partes.forEach((seg, k) => {
        if (k % 2 === 0) { out += bloques(seg); return; }
        const nl = seg.indexOf("\n");
        const lang = (nl >= 0 ? seg.slice(0, nl) : "").trim().slice(0, 20).toLowerCase();
        const code = nl >= 0 ? seg.slice(nl + 1).replace(/\n$/, "") : seg;
        const cerrado = k < partes.length - 1; // mientras llega, el último bloque aún no tiene cierre
        if (lang === "grafica" || lang === "chart") {
            out += cerrado && !renderVivo
                ? `<div class="graf" data-spec="${esc(code).replace(/"/g, "&quot;")}"><div class="graf-load"><span class="shimmer"></span><span>Dibujando gráfica…</span></div></div>`
                : `<div class="graf"><div class="graf-load"><span class="shimmer"></span><span>Preparando gráfica…</span></div></div>`;
            return;
        }
        out += `<pre data-lang="${esc(lang)}"><div class="ph"><span>${esc(lang || "código")}</span><span class="ph-b">` +
            (cerrado && conVistaPrevia(lang) ? `<button type="button" data-preview>${I.play} Vista previa</button>` : "") +
            (cerrado ? `<button type="button" data-dlcode>${I.dl} Descargar</button>` : "") +
            `<button type="button" data-copy>${I.copy} Copiar</button></span></div><code class="${lang ? "language-" + esc(lang) : ""}">${esc(code)}</code></pre>`;
    });
    if (marca === "imagen") out += '<div class="imgload"><span class="shimmer"></span><span class="il-t">Generando imagen… puede tardar unos segundos</span></div>';
    else if (marca) out += PROGRESO[marca];
    return out;
}

/* ── Programación: resaltado de sintaxis, descarga y vista previa ── */
const HLJS = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
async function resaltar(raiz) {
    const bloques = [...raiz.querySelectorAll("pre code:not([data-hl])")]; if (!bloques.length) return;
    try { await cargarScript(HLJS); } catch { return; /* sin conexión: queda sin colores */ }
    for (const c of bloques) {
        c.dataset.hl = "1";
        const lang = c.closest("pre").dataset.lang;
        try {
            const r = lang && hljs.getLanguage(lang) ? hljs.highlight(c.textContent, { language: lang, ignoreIllegals: true }) : hljs.highlightAuto(c.textContent);
            c.innerHTML = r.value; c.classList.add("hljs");
        } catch { /* lenguaje no soportado */ }
    }
}
function descargarCodigo(pre) {
    const lang = pre.dataset.lang || "text", texto = pre.querySelector("code").textContent;
    const b = new Blob([texto], { type: "text/plain;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = nombreArchivo(EXT[lang] || "txt").replace(/-\d{4}-\d{2}-\d{2}/, "");
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function vistaPrevia(pre) {
    const texto = pre.querySelector("code").textContent, lang = pre.dataset.lang;
    // iframe aislado: sin acceso a la sesión ni a la página de Alterna
    $("pvFrame").srcdoc = lang === "svg" ? `<!doctype html><body style="margin:0;display:grid;place-items:center;min-height:100vh">${texto}</body>` : texto;
    $("pvModal").classList.add("open");
}
/* ── Gráficas: bloques ```grafica con JSON → Chart.js ── */
const CHARTJS = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
// Paleta categórica validada para daltonismo (orden fijo, nunca se cicla) — claro / oscuro
const SERIES_CLARO = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SERIES_OSCURO = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const TIPOS_GRAF = { barras: "bar", barras_horizontales: "bar", barras_apiladas: "bar", lineas: "line", area: "line", pastel: "pie", dona: "doughnut", dispersion: "scatter" };
const graficas = new Map(); // nodo .graf → instancia de Chart

function formateador(spec) {
    const f = spec.formato, moneda = /^[A-Z]{3}$/.test(spec.moneda || "") ? spec.moneda : "GTQ";
    const nf = f === "moneda" ? new Intl.NumberFormat("es-GT", { style: "currency", currency: moneda, maximumFractionDigits: 2 })
        : new Intl.NumberFormat("es-GT", { maximumFractionDigits: 2 });
    return v => v == null || isNaN(v) ? "—" : f === "porcentaje" ? nf.format(v) + " %" : nf.format(v);
}
function validarSpec(s) {
    if (!s || typeof s !== "object" || !TIPOS_GRAF[s.tipo] || !Array.isArray(s.series) || !s.series.length) throw new Error("formato");
    s.series = s.series.slice(0, 8).map((x, i) => ({ nombre: String(x?.nombre ?? `Serie ${i + 1}`).slice(0, 60), datos: Array.isArray(x?.datos) ? x.datos.slice(0, 500) : [] }));
    s.etiquetas = Array.isArray(s.etiquetas) ? s.etiquetas.slice(0, 500).map(e => String(e).slice(0, 60)) : [];
    if (/pastel|dona/.test(s.tipo)) s.series = s.series.slice(0, 1);
    return s;
}
function tablaGrafica(s, fmt) {
    if (s.tipo === "dispersion") return `<table><thead><tr><th>Serie</th><th>${esc(s.ejeX || "X")}</th><th>${esc(s.ejeY || "Y")}</th></tr></thead><tbody>` +
        s.series.flatMap(x => x.datos.map(p => `<tr><td>${esc(x.nombre)}</td><td>${fmt(+p?.[0])}</td><td>${fmt(+p?.[1])}</td></tr>`)).join("") + "</tbody></table>";
    return `<table><thead><tr><th>${esc(s.ejeX || "")}</th>${s.series.map(x => `<th>${esc(x.nombre)}</th>`).join("")}</tr></thead><tbody>` +
        s.etiquetas.map((e, i) => `<tr><td>${esc(e)}</td>${s.series.map(x => `<td>${fmt(+x.datos[i])}</td>`).join("")}</tr>`).join("") + "</tbody></table>";
}

async function pintarGraficas(raiz = document) {
    const nodos = [...raiz.querySelectorAll(".graf[data-spec]:not([data-ok])")]; if (!nodos.length) return;
    try { await cargarScript(CHARTJS); } catch { nodos.forEach(n => { n.innerHTML = '<div class="err">No se pudo cargar el dibujo de gráficas. Revisa tu conexión.</div>'; }); return; }
    for (const n of nodos) {
        n.dataset.ok = "1";
        let s; try { s = validarSpec(JSON.parse(n.dataset.spec)); } catch {
            n.innerHTML = `<div class="err">No pude dibujar esta gráfica (datos con formato incorrecto). Pide a la IA que la genere de nuevo.</div>`; continue;
        }
        const fmt = formateador(s);
        n.innerHTML = `<div class="graf-h"><b>${esc(s.titulo || "Gráfica")}</b><span class="graf-b">` +
            `<button type="button" data-graf-tabla>${I.tabla} Ver datos</button><button type="button" data-graf-png>${I.png} Descargar</button></span></div>` +
            `<div class="graf-c${/pastel|dona/.test(s.tipo) ? " circ" : ""}"><canvas role="img" aria-label="${esc(s.titulo || "Gráfica")}"></canvas></div>` +
            `<div class="graf-t tw" hidden>${tablaGrafica(s, fmt)}</div>`;
        n._spec = s; dibujarGrafica(n);
    }
}

function dibujarGrafica(n) {
    const s = n._spec; if (!s || !window.Chart) return;
    graficas.get(n)?.destroy();
    const oscuro = document.body.classList.contains("dark"), cs = getComputedStyle(document.body);
    const pal = oscuro ? SERIES_OSCURO : SERIES_CLARO, sup = cs.getPropertyValue("--surface").trim() || (oscuro ? "#1c1c1e" : "#fff");
    const texto = cs.getPropertyValue("--text-soft").trim(), muted = cs.getPropertyValue("--muted").trim(), linea = cs.getPropertyValue("--border").trim();
    const fmt = formateador(s), tipo = TIPOS_GRAF[s.tipo], circ = /pastel|dona/.test(s.tipo), horiz = s.tipo === "barras_horizontales";
    const apilada = s.tipo === "barras_apiladas", area = s.tipo === "area", varias = s.series.length > 1;
    const datasets = circ
        ? [{ label: s.series[0].nombre, data: s.series[0].datos.map(Number), backgroundColor: s.etiquetas.map((_, i) => pal[i % 8]), borderColor: sup, borderWidth: 2, hoverOffset: 6 }]
        : s.series.map((x, i) => ({
            label: x.nombre, data: s.tipo === "dispersion" ? x.datos.map(p => ({ x: +p?.[0], y: +p?.[1] })) : x.datos.map(v => v == null ? null : Number(v)),
            backgroundColor: area ? pal[i] + "33" : pal[i], borderColor: pal[i],
            borderWidth: tipo === "bar" ? 0 : 2, borderRadius: tipo === "bar" ? 4 : 0, borderSkipped: apilada ? false : "start", maxBarThickness: 44,
            pointRadius: tipo === "scatter" ? 5 : s.etiquetas.length > 30 ? 0 : 3, pointHoverRadius: 6, pointBackgroundColor: pal[i], pointBorderColor: sup, pointBorderWidth: 2,
            tension: .25, fill: area ? (apilada ? "stack" : "origin") : false, spanGaps: true,
        }));
    const eje = (titulo, valores) => ({
        stacked: apilada, grid: { color: valores ? linea : "transparent", drawTicks: false }, border: { display: false },
        ticks: { color: muted, padding: 8, font: { size: 11.5 }, maxRotation: 0, autoSkip: true, ...(valores ? { callback: v => fmt(v) } : {}) },
        title: titulo ? { display: true, text: titulo, color: muted, font: { size: 12 } } : { display: false },
        beginAtZero: tipo === "bar" || area,
    });
    const chart = new Chart(n.querySelector("canvas"), {
        type: tipo,
        data: { labels: s.tipo === "dispersion" ? undefined : s.etiquetas, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: horiz ? "y" : "x", animation: { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500 },
            interaction: circ ? { mode: "nearest", intersect: true } : { mode: tipo === "scatter" ? "nearest" : "index", intersect: false },
            plugins: {
                legend: { display: circ || varias, position: "bottom", labels: { color: texto, usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, padding: 14, font: { size: 12 } } },
                tooltip: {
                    backgroundColor: oscuro ? "#2c2c2e" : "#fff", titleColor: oscuro ? "#f2f2f3" : "#1f2937", bodyColor: oscuro ? "#d1d5db" : "#4b5563",
                    borderColor: linea, borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
                    callbacks: {
                        label: c => {
                            if (circ) { const tot = c.dataset.data.reduce((a, b) => a + (+b || 0), 0); return ` ${c.label}: ${fmt(c.raw)} (${tot ? Math.round(c.raw / tot * 1000) / 10 : 0} %)`; }
                            if (tipo === "scatter") return ` ${c.dataset.label}: ${fmt(c.raw.x)}, ${fmt(c.raw.y)}`;
                            return ` ${c.dataset.label}: ${fmt(horiz ? c.raw : c.parsed.y)}`;
                        },
                    },
                },
            },
            scales: circ ? {} : horiz ? { x: eje(s.ejeY, true), y: eje(s.ejeX, false) } : { x: eje(s.ejeX, tipo === "scatter"), y: eje(s.ejeY, true) },
        },
    });
    graficas.set(n, chart);
}
const redibujarGraficas = () => { for (const [n] of graficas) { if (n.isConnected) dibujarGrafica(n); else { graficas.get(n).destroy(); graficas.delete(n); } } };

function descargarGrafica(n) {
    const c = n.querySelector("canvas"); if (!c) return;
    const r = devicePixelRatio || 1, cab = Math.round(52 * r), m = Math.round(16 * r);
    const k = document.createElement("canvas"); k.width = c.width + m * 2; k.height = c.height + cab + m;
    const x = k.getContext("2d"), cs = getComputedStyle(document.body);
    x.fillStyle = cs.getPropertyValue("--surface").trim() || "#fff"; x.fillRect(0, 0, k.width, k.height);
    x.fillStyle = cs.getPropertyValue("--text").trim() || "#111"; x.font = `600 ${Math.round(16 * r)}px Inter, system-ui, sans-serif`;
    x.fillText(n._spec?.titulo || "Gráfica", m, Math.round(34 * r));
    x.drawImage(c, m, cab);
    const a = document.createElement("a"); a.href = k.toDataURL("image/png");
    a.download = ((n._spec?.titulo || "grafica").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "grafica") + ".png";
    document.body.appendChild(a); a.click(); a.remove();
}

$("pvModal").addEventListener("click", e => { if (e.target.id === "pvModal" || e.target.closest("[data-pv-x]")) { $("pvModal").classList.remove("open"); $("pvFrame").srcdoc = ""; } });

/* ── Estado ── */
let convs = [], actual = null, mensajes = [], enCurso = false, abortar = null, filtro = "", adjuntos = [];

/* ── API ── */
async function api(accion, extra = {}) {
    const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
        body: JSON.stringify({ accion, ...credenciales(), ...extra })
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { localStorage.removeItem("usuario"); window.location.replace("index.html"); throw new Error("Sesión no válida"); }
    if (!r.ok) throw new Error(d.error || "No fue posible conectar con Alterna IA.");
    return d;
}

/* ── Barra lateral ── */
function grupo(f) {
    const d = new Date(f), h = new Date(); h.setHours(0, 0, 0, 0);
    const dias = Math.floor((h - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    return dias <= 0 ? "Hoy" : dias === 1 ? "Ayer" : dias <= 7 ? "Últimos 7 días" : "Anteriores";
}

function pintarLista() {
    const cont = $("convs"); const q = filtro.trim().toLowerCase();
    const lista = convs.filter(c => !q || c.titulo.toLowerCase().includes(q));
    if (!lista.length) { cont.innerHTML = `<div class="empty-list">${q ? "Sin resultados." : "Aún no tienes conversaciones.<br>Empieza una nueva."}</div>`; return; }
    let html = "", ult = "";
    for (const c of lista) {
        const g = grupo(c.updated_at);
        if (g !== ult) { html += `<div class="grp">${g}</div>`; ult = g; }
        html += `<div class="conv${c.id === actual ? " act" : ""}" data-id="${c.id}"><span class="t">${esc(c.titulo)}</span>` +
                `<span class="acts"><button class="ren" title="Renombrar">${I.edit}</button><button class="del" title="Eliminar">${I.del}</button></span></div>`;
    }
    cont.innerHTML = html;
}

$("convs").addEventListener("click", e => {
    const fila = e.target.closest(".conv"); if (!fila || e.target.closest("input")) return;
    const id = fila.dataset.id;
    if (e.target.closest(".del")) return eliminar(id);
    if (e.target.closest(".ren")) return renombrar(fila, id);
    abrir(id); cerrarMenu();
});

function renombrar(fila, id) {
    const c = convs.find(x => x.id === id); const t = fila.querySelector(".t");
    const inp = document.createElement("input"); inp.className = "ren"; inp.value = c.titulo; inp.maxLength = 80;
    t.replaceWith(inp); fila.querySelector(".acts").style.display = "none"; inp.focus(); inp.select();
    let hecho = false;
    const fin = async guardar => {
        if (hecho) return; hecho = true;
        const nuevo = inp.value.trim();
        if (guardar && nuevo && nuevo !== c.titulo) {
            try { await api("renombrar", { id, titulo: nuevo }); c.titulo = nuevo; if (id === actual) $("titulo").textContent = nuevo; }
            catch (e) { toast(e.message); }
        }
        pintarLista();
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") fin(true); if (e.key === "Escape") fin(false); });
    inp.addEventListener("blur", () => fin(true));
}

/* Diálogo de confirmación propio de la app (reemplaza al confirm() del navegador). */
function confirmar({ titulo, mensaje, ok = "Aceptar", peligro = false }) {
    return new Promise(resolve => {
        const m = $("confirmModal");
        $("cfTitulo").textContent = titulo; $("cfMensaje").textContent = mensaje;
        const bOk = $("cfOk"), bNo = $("cfNo");
        bOk.textContent = ok; bOk.classList.toggle("peligro", peligro);
        const cerrar = v => { m.classList.remove("open"); bOk.onclick = bNo.onclick = m.onclick = null; document.removeEventListener("keydown", tecla, true); resolve(v); };
        const tecla = e => { if (e.key === "Escape") { e.stopPropagation(); cerrar(false); } };
        bOk.onclick = () => cerrar(true); bNo.onclick = () => cerrar(false);
        m.onclick = e => { if (e.target === m) cerrar(false); };
        document.addEventListener("keydown", tecla, true);
        m.classList.add("open"); bNo.focus();
    });
}

async function eliminar(id) {
    const c = convs.find(x => x.id === id);
    if (!await confirmar({ titulo: "Eliminar conversación", mensaje: `Se eliminará «${c?.titulo}» junto con sus imágenes. Esta acción no se puede deshacer.`, ok: "Eliminar", peligro: true })) return;
    try { await api("eliminar", { id }); } catch (e) { return toast(e.message); }
    convs = convs.filter(x => x.id !== id);
    if (id === actual) nueva(); else pintarLista();
    toast("Conversación eliminada");
}

/* ── Vista principal ── */
const nombre1 = (usuario.nombre || "").trim().split(/\s+/)[0] || "";
/* Saludos aleatorios según la hora y el día, para que la bienvenida se sienta cercana. {n} = nombre. */
const SALUDOS = {
    manana: ["Buenos días, {n}", "Buen día, {n}. ¿Cómo amaneciste?", "Arrancamos el día, {n}", "¡Qué gusto verte esta mañana, {n}!", "Buenos días, {n}. Hoy va a salir todo bien"],
    tarde: ["Buenas tardes, {n}", "Hola, {n}. ¿Cómo va tu tarde?", "¡Hola de nuevo, {n}!", "Qué bueno tenerte por aquí, {n}", "Buenas tardes, {n}. ¿Cómo va el día?"],
    noche: ["Buenas noches, {n}", "Hola, {n}. ¿Cerrando el día?", "Aquí sigo contigo, {n}", "¡Hola, {n}! ¿Seguimos un rato?", "Buenas noches, {n}. Sin prisa, aquí estoy"],
    madrugada: ["Hola, {n}. Hoy sí que madrugas", "¿Trasnochando, {n}? Aquí estoy para ayudarte", "Hola, {n}. Te acompaño en este turno"],
    general: ["¡Hola, {n}! ¿Qué hacemos hoy?", "Hola, {n}. ¿En qué te echo una mano?", "¿Cómo estás, {n}? Cuéntame qué necesitas", "Qué gusto saludarte, {n}", "Aquí estoy, {n}. ¿Por dónde empezamos?", "Hola, {n}. Estoy listo cuando tú lo estés"],
    lunes: ["Feliz lunes, {n}. ¿Empezamos la semana con buen pie?"],
    viernes: ["Feliz viernes, {n}. Vamos a cerrar la semana a lo grande"],
};
const SUBTITULOS = [
    "Soy <strong>Alterna IA</strong>, tu asistente en Alterna. Redacto, resumo, corrijo, preparo reuniones y reportes, analizo imágenes y también puedo crearlas.",
    "Cuenta conmigo para redactar correos, preparar reuniones o armar reportes. A tu ritmo, sin prisa.",
    "Pídeme un resumen, un reporte o una imagen. Lo que necesites para avanzar hoy.",
    "Estoy aquí para quitarte trabajo de encima: consultas, reportes, correos, imágenes y mucho más.",
    "Pregúntame lo que quieras, aunque suene a pregunta tonta. Para eso estoy.",
];
function elegir(lista) {
    let prev = -1; try { prev = +sessionStorage.getItem("ia_prev_" + lista.length) || -1; } catch { /* sin storage */ }
    let i; do { i = Math.floor(Math.random() * lista.length); } while (lista.length > 1 && i === prev);
    try { sessionStorage.setItem("ia_prev_" + lista.length, i); } catch { /* sin storage */ }
    return lista[i];
}
function saludoAleatorio() {
    const h = new Date().getHours(), d = new Date().getDay();
    const franja = h < 5 ? "madrugada" : h < 12 ? "manana" : h < 19 ? "tarde" : "noche";
    const pool = [...SALUDOS[franja], ...SALUDOS[franja], ...SALUDOS.general];   // la franja pesa más
    if (d === 1) pool.push(...SALUDOS.lunes, ...SALUDOS.lunes); if (d === 5) pool.push(...SALUDOS.viernes, ...SALUDOS.viernes);
    const t = elegir(pool);
    return {
        titulo: nombre1 ? esc(t).replace("{n}", "<span>" + esc(nombre1) + "</span>") : esc(t).replace(/,?\s*\{n\}/, ""),
        sub: elegir(SUBTITULOS),
    };
}

function inicio() {
    const s = saludoAleatorio();
    $("vista").innerHTML =
        `<div class="hero"><div class="logo con-img"><img src="img/logo-ia.webp?v=2" alt=""></div>` +
        `<h1>${s.titulo}</h1>` +
        `<p>${s.sub}</p>` +
        `<div class="cards">` + SUGERENCIAS.map((s, k) => `<button class="card" data-k="${k}"><span class="ci">${s.i}</span><span><div class="ct">${s.t}</div><div class="cd">${s.d}</div></span></button>`).join("") + `</div></div>`;
}

$("vista").addEventListener("click", e => {
    const card = e.target.closest(".card");
    if (card) { const s = SUGERENCIAS[card.dataset.k]; return s.adj ? $("fileAdj").click() : ejecutar({ texto: s.p }); }
    const gt = e.target.closest("[data-graf-tabla]");
    if (gt) { const t = gt.closest(".graf").querySelector(".graf-t"); t.hidden = !t.hidden; gt.innerHTML = `${I.tabla} ${t.hidden ? "Ver datos" : "Ocultar datos"}`; return; }
    const gp = e.target.closest("[data-graf-png]"); if (gp) return descargarGrafica(gp.closest(".graf"));
    const vu = e.target.closest("[data-val]"); if (vu) return clicValoracion(vu.closest(".msg"), +vu.dataset.val);
    const mo = e.target.closest("[data-motivo]"); if (mo) { mo.classList.toggle("act"); mo.parentElement.querySelectorAll("[data-motivo]").forEach(b => b !== mo && b.classList.remove("act")); return; }
    const fe = e.target.closest("[data-fb-enviar]"); if (fe) return enviarNegativa(fe.closest(".msg"));
    const fc = e.target.closest("[data-fb-cancelar]"); if (fc) return fc.closest(".fb").remove();
    const tt = e.target.closest("[data-tts]"); if (tt) return leerEnVoz(tt.closest(".msg"));
    const cp = e.target.closest("[data-copy]"); if (cp) return copiar(cp.closest("pre").querySelector("code").textContent);
    const ct = e.target.closest("[data-copymsg]"); if (ct) return copiar(sinImagenes(ct.closest(".msg").dataset.raw || ""));
    const rg = e.target.closest("[data-regen]"); if (rg) return regenerar();
    const ok = e.target.closest("[data-acc-ok]"); if (ok) return resolverAccion(ok.closest(".acc").dataset.acc, true);
    const no = e.target.closest("[data-acc-no]"); if (no) return resolverAccion(no.closest(".acc").dataset.acc, false);
    const dc = e.target.closest("[data-dlcode]"); if (dc) return descargarCodigo(dc.closest("pre"));
    const pv = e.target.closest("[data-preview]"); if (pv) return vistaPrevia(pv.closest("pre"));
    const xl = e.target.closest("[data-xls]"); if (xl) return descargarExcel(xl.closest(".msg").dataset.raw || "");
    const dl = e.target.closest("[data-dl]"); if (dl) return descargar(dl.dataset.dl);
    const im = e.target.closest(".imgbox img, .thumbs img"); if (im) return abrirLightbox(im.src);
});

async function descargar(url) {
    try {
        const b = await (await fetch(url)).blob(); const a = document.createElement("a");
        a.href = URL.createObjectURL(b); a.download = "alterna-ia-" + Date.now() + ".png"; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { window.open(url, "_blank", "noopener"); }
}
function abrirLightbox(src) { $("lb").querySelector("img").src = src; $("lb").classList.add("open"); }
$("lb").addEventListener("click", () => $("lb").classList.remove("open"));

const iniciales = (usuario.nombre || "?").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
// Foto de Zoho (solo data URL de imagen, guardada al iniciar sesión); si no hay, iniciales
const avatarHtml = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(usuario.foto || "")
    ? `<img src="${usuario.foto}" alt="">` : esc(iniciales);

// Marca de documento guardada en el mensaje: ⟦doc:uuid|nombre|tipo[:páginas]⟧
const DOC_MD = /⟦doc:[0-9a-f-]{36}\|([^|⟧]*)\|([^⟧]*)⟧/g;
const docsDeMensaje = c => [...c.matchAll(DOC_MD)].map(m => { const [tipo, pag] = m[2].split(":"); return { nombre: m[1], tipo, paginas: +pag || null }; });
const chipDoc = (d, clase = "", fin = "") => {
    const t = TIPO_DOC[d.tipo] || TIPO_DOC.texto;
    const info = [d.paginas ? `${d.paginas} pág.` : "", d.caracteres ? `${compacto(d.caracteres)} caracteres` : ""].filter(Boolean).join(" · ");
    return `<div class="dchip${clase}" title="${esc(d.nombre)}"><span class="dc-ic" style="--c:${t.c}">${t.e}</span><span class="dc-t"><b>${esc(d.nombre)}</b><small>${esc(d.estado || info || t.e)}</small></span>${fin}</div>`;
};

function nodoUsuario(contenido, previews, docsLocales) {
    const urls = previews || [...contenido.matchAll(IMG_MD)].map(m => m[2]);
    const texto = previews ? contenido : sinImagenes(contenido);
    const docs = docsLocales || docsDeMensaje(contenido);
    const d = document.createElement("div"); d.className = "msg user";
    d.innerHTML = `<div class="av">${avatarHtml}</div><div class="body"><div class="bubble">` +
        (urls.length ? `<div class="thumbs">${urls.map(u => `<img src="${u}" alt="Imagen adjunta">`).join("")}</div>` : "") +
        (docs.length ? `<div class="dchips">${docs.map(x => chipDoc(x)).join("")}</div>` : "") +
        (texto ? `<div>${esc(texto)}</div>` : "") + `</div></div>`;
    return d;
}

const botonesValorar = (id, valor) => id ? `<span class="val" data-mid="${id}"><button type="button" data-val="1" class="${valor === 1 ? "act" : ""}" title="Buena respuesta" aria-label="Buena respuesta" aria-pressed="${valor === 1}">${I.up}</button>` +
    `<button type="button" data-val="-1" class="${valor === -1 ? "act" : ""}" title="Mala respuesta" aria-label="Mala respuesta" aria-pressed="${valor === -1}">${I.down}</button></span>` : "";
const botonVoz = () => `<button type="button" data-tts title="Escuchar en voz alta">${I.voz} Escuchar</button>`;

function nodoAsistente(texto, id = null, valor = 0) {
    const d = document.createElement("div"); d.className = "msg assistant"; d.dataset.raw = texto; if (id) d.dataset.id = id;
    d.innerHTML = `<div class="av con-img"><img src="img/logo-ia.webp?v=2" alt=""></div><div class="body"><div class="who">Alterna IA</div><div class="md">${md(texto)}</div>` +
                  `<div class="tools"><button type="button" data-copymsg>${I.copy} Copiar</button>${botonVoz()}${botonesReporte(texto)}${botonesValorar(id, valor)}</div></div>`;
    return d;
}

function marcarUltimo() {
    document.querySelectorAll("[data-regen]").forEach(b => b.remove());
    const ult = [...document.querySelectorAll(".msg.assistant")].pop();
    const tools = ult?.querySelector(".tools");
    if (tools && !enCurso) tools.insertAdjacentHTML("beforeend", `<button type="button" data-regen>${I.regen} Regenerar</button>`);
}

function pintarConversacion() {
    if (!mensajes.length) { inicio(); return; }
    $("vista").innerHTML = '<div class="col" id="col"></div>';
    const col = $("col");
    mensajes.forEach(m => col.appendChild(m.rol === "user" ? nodoUsuario(m.contenido) : nodoAsistente(m.contenido, m.id, m.valor)));
    marcarUltimo(); hidratarAcciones(); resaltar(col); pintarGraficas(col).then(() => bajar(true)); bajar(true);
}

function bajar(forzar) {
    const s = $("scroll");
    if (forzar || s.scrollHeight - s.scrollTop - s.clientHeight < 140) s.scrollTop = s.scrollHeight;
}

function nueva() {
    if (enCurso) abortar?.abort();
    pararVoz(); documentos = [];
    actual = null; mensajes = []; adjuntos = []; pintarAdjuntos(); history.replaceState(null, "", location.pathname);
    $("titulo").textContent = "Nueva conversación"; pintarLista(); pintarConversacion(); $("entrada").focus();
}

async function abrir(id) {
    if (id === actual) return;
    if (enCurso) abortar?.abort();
    pararVoz();
    actual = id; mensajes = []; history.replaceState(null, "", "#" + id);
    const c = convs.find(x => x.id === id); $("titulo").textContent = c ? c.titulo : "Conversación";
    pintarLista(); $("vista").innerHTML = '<div class="col"><div class="dots"><i></i><i></i><i></i></div></div>';
    try {
        const d = await api("abrir", { id }); if (actual !== id) return;
        const vals = new Map((d.valoraciones || []).map(v => [v.mensaje_id, v.valor]));
        mensajes = d.mensajes.map(m => ({ id: m.id, rol: m.rol, contenido: m.contenido, valor: vals.get(m.id) || 0 })); pintarConversacion();
    } catch (e) { $("vista").innerHTML = `<div class="col"><div class="err">${esc(e.message)}</div></div>`; }
}

/* ── Adjuntos (imágenes) ── */
function leerImagen(file) {
    return new Promise((res, rej) => {
        if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return rej(new Error("Solo se admiten imágenes PNG, JPG o WEBP."));
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
            const k = Math.min(1, 1800 / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
            const c = document.createElement("canvas"); c.width = w; c.height = h;
            const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
            const data = c.toDataURL("image/jpeg", 0.88); URL.revokeObjectURL(url);
            res({ mime: "image/jpeg", base64: data.split(",")[1], preview: data });
        };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen.")); };
        img.src = url;
    });
}
/* ── Documentos: el texto se extrae aquí, en el navegador (el archivo original no se sube) ── */
const MAX_DOCS = 5, MAX_MB_DOC = 25, MAX_TEXTO_DOC = 200000;
const LIBS = {
    pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    mammoth: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
    jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
};
let documentos = []; // { id, nombre, tipo, paginas, texto, caracteres, estado, cargando }

function tipoDeArchivo(f) {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (/^image\/(png|jpe?g|webp)$/.test(f.type)) return "imagen";
    if (ext === "pdf" || f.type === "application/pdf") return "pdf";
    if (ext === "docx") return "word";
    if (["xlsx", "xlsm", "xls", "ods"].includes(ext)) return "excel";
    if (ext === "csv" || ext === "tsv") return "csv";
    if (ext === "pptx") return "presentacion";
    if (["txt", "md", "markdown", "json", "xml", "html", "htm", "log", "sql", "yml", "yaml", "js", "ts", "py", "css", "ps1", "sh", "java", "cs", "php", "go", "rb", "ini", "conf"].includes(ext) || f.type.startsWith("text/")) return "texto";
    if (ext === "doc" || ext === "ppt") return "antiguo";
    return null;
}

// Convierte el HTML de mammoth en texto con títulos, listas y tablas legibles para la IA
function htmlATexto(html) {
    const raiz = new DOMParser().parseFromString(html, "text/html").body, out = [];
    const txt = n => n.textContent.replace(/\s+/g, " ").trim();
    for (const n of raiz.children) {
        const t = n.tagName.toLowerCase();
        if (/^h[1-6]$/.test(t)) out.push("#".repeat(+t[1]) + " " + txt(n));
        else if (t === "ul" || t === "ol") [...n.querySelectorAll("li")].forEach((li, i) => out.push((t === "ol" ? `${i + 1}. ` : "- ") + txt(li)));
        else if (t === "table") {
            const filas = [...n.querySelectorAll("tr")].map(tr => [...tr.children].map(c => txt(c).replace(/\|/g, "/")));
            if (filas.length) out.push(["| " + filas[0].join(" | ") + " |", "|" + filas[0].map(() => " --- ").join("|") + "|", ...filas.slice(1).map(f => "| " + f.join(" | ") + " |")].join("\n"));
        } else { const s = txt(n); if (s) out.push(s); }
    }
    return out.join("\n\n");
}

async function leerPdf(f, avance) {
    await cargarScript(LIBS.pdf);
    pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
    const n = pdf.numPages, paginas = [];
    for (let i = 1; i <= Math.min(n, 500); i++) {
        const c = await (await pdf.getPage(i)).getTextContent();
        let s = ""; for (const it of c.items) { s += it.str; if (it.hasEOL) s += "\n"; else if (it.str && !/\s$/.test(it.str)) s += " "; }
        paginas.push(s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
        if (i % 10 === 0) avance(`Leyendo página ${i} de ${n}…`);
    }
    const texto = paginas.map((p, i) => `--- Página ${i + 1} ---\n${p}`).join("\n\n");
    const util = paginas.join("").replace(/\s/g, "").length;
    // PDF escaneado (sin texto): se envían las primeras páginas como imagen para que la IA las lea
    const escaneado = util < 12 * Math.min(n, 500);
    const imagenes = [];
    if (escaneado) {
        for (let i = 1; i <= Math.min(n, MAX_ADJ - adjuntos.length); i++) {
            const pg = await pdf.getPage(i), vp0 = pg.getViewport({ scale: 1 }), k = Math.min(2, 1600 / Math.max(vp0.width, vp0.height));
            const vp = pg.getViewport({ scale: k }), cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
            const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
            await pg.render({ canvasContext: cx, viewport: vp }).promise;
            const data = cv.toDataURL("image/jpeg", 0.85); imagenes.push({ mime: "image/jpeg", base64: data.split(",")[1], preview: data });
        }
    }
    return { texto: escaneado ? `(PDF escaneado de ${n} página(s), sin texto seleccionable. ${imagenes.length ? `Se adjuntaron las primeras ${imagenes.length} página(s) como imagen.` : ""})\n\n${texto}` : texto, paginas: n, imagenes, escaneado };
}
async function leerWord(f) {
    await cargarScript(LIBS.mammoth);
    const r = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
    return { texto: htmlATexto(r.value) };
}
async function leerExcel(f) {
    await cargarScript(LIBS.xlsx);
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
    const hojas = wb.SheetNames.map(n => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false, dateNF: "yyyy-mm-dd" }).replace(/^(,\s*)+$/gm, "").replace(/\n{2,}/g, "\n").trim();
        const filas = csv ? csv.split("\n").length : 0;
        return `## Hoja: ${n} (${filas} fila(s))\n${csv || "(vacía)"}`;
    });
    return { texto: hojas.join("\n\n"), paginas: wb.SheetNames.length };
}
async function leerPptx(f) {
    await cargarScript(LIBS.jszip);
    const zip = await JSZip.loadAsync(await f.arrayBuffer());
    const num = p => +(p.match(/(\d+)\.xml$/) || [0, 0])[1];
    const diapos = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => num(a) - num(b));
    const partes = [];
    for (const p of diapos) {
        const xml = new DOMParser().parseFromString(await zip.file(p).async("string"), "application/xml");
        const parrafos = [...xml.getElementsByTagName("a:p")].map(par => [...par.getElementsByTagName("a:t")].map(t => t.textContent).join("")).filter(s => s.trim());
        const notas = zip.file(p.replace("slides/slide", "notesSlides/notesSlide"));
        let nt = "";
        if (notas) { const nx = new DOMParser().parseFromString(await notas.async("string"), "application/xml"); nt = [...nx.getElementsByTagName("a:t")].map(t => t.textContent).join(" ").replace(/^\s*\d+\s*$/, "").trim(); }
        partes.push(`--- Diapositiva ${num(p)} ---\n${parrafos.join("\n")}${nt ? `\nNotas: ${nt}` : ""}`);
    }
    return { texto: partes.join("\n\n"), paginas: diapos.length };
}

async function leerDocumento(f, tipo, avance) {
    if (f.size > MAX_MB_DOC * 1024 * 1024) throw new Error(`«${f.name}» pesa más de ${MAX_MB_DOC} MB.`);
    const r = tipo === "pdf" ? await leerPdf(f, avance) : tipo === "word" ? await leerWord(f) : tipo === "excel" ? await leerExcel(f)
        : tipo === "presentacion" ? await leerPptx(f) : { texto: await f.text() };
    let texto = (r.texto || "").replace(/\u0000/g, "").trim();
    if (!texto && !r.imagenes?.length) throw new Error(`No encontré texto en «${f.name}».`);
    const recortado = texto.length > MAX_TEXTO_DOC;
    if (recortado) texto = texto.slice(0, MAX_TEXTO_DOC);
    return { ...r, texto: texto || "(sin texto)", recortado };
}

async function agregarArchivos(files) {
    for (const f of [...files]) {
        const tipo = tipoDeArchivo(f);
        if (tipo === "imagen") {
            if (adjuntos.length >= MAX_ADJ) { toast(`Máximo ${MAX_ADJ} imágenes por mensaje.`); continue; }
            try { adjuntos.push(await leerImagen(f)); pintarAdjuntos(); } catch (e) { toast(e.message); }
            continue;
        }
        if (tipo === "antiguo") { toast(`«${f.name}» es un formato antiguo. Guárdalo como .docx o .pptx e inténtalo de nuevo.`); continue; }
        if (!tipo) { toast(`No puedo leer archivos de tipo «${f.name.split(".").pop()}».`); continue; }
        if (documentos.length >= MAX_DOCS) { toast(`Máximo ${MAX_DOCS} documentos por mensaje.`); break; }
        const d = { id: Math.random().toString(36).slice(2), nombre: f.name.slice(0, 120), tipo, cargando: true, estado: "Leyendo…" };
        documentos.push(d); pintarAdjuntos(); estadoBoton();
        try {
            const r = await leerDocumento(f, tipo, t => { d.estado = t; pintarAdjuntos(); });
            Object.assign(d, { texto: r.texto, paginas: r.paginas || null, caracteres: r.texto.length, cargando: false, estado: "" });
            if (r.recortado) { d.estado = "Muy extenso: se analizará solo una parte"; toast(`«${f.name}» es muy extenso: la IA leerá solo una parte.`); }
            if (r.imagenes?.length) { adjuntos.push(...r.imagenes.slice(0, MAX_ADJ - adjuntos.length)); d.estado = "Escaneado: se leerá como imagen"; }
        } catch (e) {
            documentos = documentos.filter(x => x !== d);
            const propio = /^(«|No )/.test(e?.message || "");
            toast(propio ? e.message : `No pude leer «${f.name}». ¿Está protegido con contraseña o dañado?`);
        }
        pintarAdjuntos(); estadoBoton();
    }
    pintarAdjuntos(); estadoBoton(); $("entrada").focus();
}
function pintarAdjuntos() {
    $("adjs").innerHTML =
        adjuntos.map((a, i) => `<div class="adj"><img src="${a.preview}" alt="Adjunto ${i + 1}"><button type="button" data-rm="${i}" aria-label="Quitar">${I.x}</button></div>`).join("") +
        documentos.map(d => chipDoc(d, d.cargando ? " cargando" : "", `<button type="button" class="dc-x" data-rmdoc="${d.id}" aria-label="Quitar ${esc(d.nombre)}">${I.x}</button>`)).join("");
    $("adjs").style.display = adjuntos.length || documentos.length ? "flex" : "none";
}
$("adjs").addEventListener("click", e => {
    const b = e.target.closest("[data-rm]"); if (b) { adjuntos.splice(+b.dataset.rm, 1); pintarAdjuntos(); estadoBoton(); return; }
    const d = e.target.closest("[data-rmdoc]"); if (d) { documentos = documentos.filter(x => x.id !== d.dataset.rmdoc); pintarAdjuntos(); estadoBoton(); }
});
$("btnAdj").innerHTML = I.clip;
$("btnAdj").onclick = () => $("fileAdj").click();
$("fileAdj").addEventListener("change", e => { agregarArchivos(e.target.files); e.target.value = ""; });
$("entrada").addEventListener("paste", e => {
    const fs = [...(e.clipboardData?.files || [])].filter(f => tipoDeArchivo(f));
    if (fs.length) { e.preventDefault(); agregarArchivos(fs); }
});
let arrastres = 0;
addEventListener("dragenter", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { arrastres++; $("drop").classList.add("on"); } });
addEventListener("dragleave", () => { if (--arrastres <= 0) { arrastres = 0; $("drop").classList.remove("on"); } });
addEventListener("dragover", e => e.preventDefault());
addEventListener("drop", e => { e.preventDefault(); arrastres = 0; $("drop").classList.remove("on"); if (e.dataTransfer?.files?.length) agregarArchivos(e.dataTransfer.files); });

/* ── Envío con streaming ── */
function estadoBoton() {
    const b = $("btnEnviar");
    b.classList.toggle("stop", enCurso);
    b.innerHTML = enCurso ? I.stop : I.send;
    b.title = enCurso ? "Detener" : "Enviar";
    const leyendo = documentos.some(d => d.cargando);
    b.disabled = !enCurso && (leyendo || (!$("entrada").value.trim() && !adjuntos.length && !documentos.length));
    if (leyendo && !enCurso) b.title = "Espera a que termine de leer el documento";
}

async function ejecutar({ texto = "", regen = false }) {
    if (enCurso) return;
    texto = texto.trim();
    if (!regen && documentos.some(d => d.cargando)) return toast("Espera a que termine de leer el documento.");
    const adj = regen ? [] : adjuntos.slice(), docs = regen ? [] : documentos.slice();
    if (!regen && !texto && !adj.length && !docs.length) return;
    pararVoz();

    if (!regen && !mensajes.length) $("vista").innerHTML = '<div class="col" id="col"></div>';
    const col = $("col");
    if (!regen) {
        col.appendChild(nodoUsuario(texto, adj.length || docs.length ? adj.map(a => a.preview) : null, docs.length ? docs : null));
        mensajes.push({ rol: "user", contenido: texto });
        $("entrada").value = ""; $("entrada").style.height = "auto"; adjuntos = []; documentos = []; pintarAdjuntos();
    }
    document.querySelectorAll("[data-regen]").forEach(b => b.remove());

    const nodo = nodoAsistente(""); const cuerpo = nodo.querySelector(".md"); const tools = nodo.querySelector(".tools");
    tools.style.display = "none"; cuerpo.innerHTML = '<div class="dots"><i></i><i></i><i></i></div>';
    col.appendChild(nodo); bajar(true);

    enCurso = true; abortar = new AbortController(); estadoBoton();
    let acumulado = "", esNueva = false;
    try {
        const r = await fetch(ENDPOINT, {
            method: "POST", signal: abortar.signal,
            headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
            body: JSON.stringify({ accion: "chat", ...credenciales(), nivel, conversacion_id: actual, mensaje: texto, regenerar: regen, adjuntos: adj.map(({ mime, base64 }) => ({ mime, base64 })),
                documentos: docs.map(({ nombre, tipo, paginas, texto }) => ({ nombre, tipo, paginas, texto })) })
        });
        if (!r.ok) {
            if (r.status === 401) { localStorage.removeItem("usuario"); window.location.replace("index.html"); return; }
            const d = await r.json().catch(() => ({})); if (d.cuota) pintarCuota(d.cuota);
            throw new Error(d.error || "No fue posible conectar con Alterna IA.");
        }
        const id = r.headers.get("X-Conversacion-Id");
        if (id && !actual) {
            esNueva = true; actual = id; history.replaceState(null, "", "#" + id);
            const t = decodeURIComponent(r.headers.get("X-Titulo") || "Nueva conversación");
            convs.unshift({ id, titulo: t, updated_at: new Date().toISOString() }); $("titulo").textContent = t; pintarLista();
        }
        const rd = r.body.getReader(), dec = new TextDecoder();
        while (true) {
            const { done, value } = await rd.read(); if (done) break;
            acumulado += dec.decode(value, { stream: true });
            cuerpo.innerHTML = md(acumulado, true); cuerpo.classList.toggle("cursor", !marcaFinal(acumulado)); bajar();
        }
        if (!quitarMarcas(acumulado).trim()) throw new Error("La IA no devolvió respuesta. Intenta de nuevo.");
    } catch (e) {
        if (e.name !== "AbortError") {
            if (!acumulado) { cuerpo.innerHTML = `<div class="err">${esc(e.message)}</div>`; tools.remove(); }
            else toast("Se interrumpió la respuesta");
        }
    } finally {
        cuerpo.classList.remove("cursor");
        const final = quitarMarcas(acumulado), idMsg = +(acumulado.match(MSG_RE) || [])[1] || null;
        if (final.trim()) {
            nodo.dataset.raw = final; if (idMsg) nodo.dataset.id = idMsg;
            cuerpo.innerHTML = md(final); resaltar(cuerpo); pintarGraficas(cuerpo).then(() => bajar());
            tools.insertAdjacentHTML("beforeend", botonesReporte(final) + botonesValorar(idMsg, 0)); tools.style.display = "";
            mensajes.push({ id: idMsg, rol: "assistant", contenido: final, valor: 0 });
            const c = convs.find(x => x.id === actual); if (c) { c.updated_at = new Date().toISOString(); convs = [c, ...convs.filter(x => x !== c)]; pintarLista(); }
            if (esNueva && actual) titular(actual);
        } else if (!cuerpo.querySelector(".err")) { nodo.remove(); }
        enCurso = false; abortar = null; estadoBoton(); marcarUltimo(); hidratarAcciones(); $("entrada").focus(); bajar();
        if (final.trim()) setTimeout(cargarCuota, 1500); // el backend registra los tokens al cerrar la respuesta
    }
}

async function titular(id) {
    try {
        const d = await api("titular", { id }); if (!d.titulo) return;
        const c = convs.find(x => x.id === id); if (c) c.titulo = d.titulo;
        if (actual === id) $("titulo").textContent = d.titulo; pintarLista();
    } catch { /* el título provisional se mantiene */ }
}

function regenerar() {
    if (enCurso || !mensajes.length || mensajes[mensajes.length - 1].rol !== "assistant") return;
    mensajes.pop(); [...document.querySelectorAll(".msg.assistant")].pop()?.remove();
    ejecutar({ regen: true });
}

/* ── Calificar respuestas (👍 / 👎) ── */
const MOTIVOS_FB = ["Incorrecta", "Incompleta", "No entendió", "Muy larga", "Desactualizada", "Otro"];
function pintarValor(msg, valor) {
    msg.querySelectorAll("[data-val]").forEach(b => { const on = +b.dataset.val === valor; b.classList.toggle("act", on); b.setAttribute("aria-pressed", String(on)); });
    const m = mensajes.find(x => x.id === +msg.dataset.id); if (m) m.valor = valor;
}
async function clicValoracion(msg, valor) {
    const id = +msg.dataset.id; if (!id) return;
    const actualV = mensajes.find(x => x.id === id)?.valor || 0;
    msg.querySelector(".fb")?.remove();
    if (valor === -1 && actualV !== -1) {
        // Panel para contar qué falló (opcional)
        msg.querySelector(".tools").insertAdjacentHTML("afterend",
            `<div class="fb"><div class="fb-t">¿Qué falló en esta respuesta?</div><div class="fb-m">${MOTIVOS_FB.map(m => `<button type="button" data-motivo="${m}">${m}</button>`).join("")}</div>` +
            `<textarea maxlength="600" rows="2" placeholder="Cuéntanos qué esperabas (opcional)"></textarea>` +
            `<div class="fb-p"><small>El equipo de IT podrá revisar esta respuesta para mejorar la IA.</small><span><button type="button" class="ad-btn" data-fb-cancelar>Cancelar</button><button type="button" class="ad-btn pri" data-fb-enviar>Enviar</button></span></div></div>`);
        msg.querySelector(".fb textarea").focus();
        return;
    }
    const nuevo = actualV === valor ? 0 : valor;
    pintarValor(msg, nuevo);
    try { await api("valorar", { mensaje_id: id, valor: nuevo }); if (nuevo === 1) toast("¡Gracias! Nos ayuda a mejorar"); }
    catch (e) { pintarValor(msg, actualV); toast(e.message); }
}
async function enviarNegativa(msg) {
    const fb = msg.querySelector(".fb"), id = +msg.dataset.id; if (!fb || !id) return;
    const motivo = fb.querySelector("[data-motivo].act")?.dataset.motivo || null, comentario = fb.querySelector("textarea").value.trim();
    fb.querySelectorAll("button").forEach(b => b.disabled = true);
    try { await api("valorar", { mensaje_id: id, valor: -1, motivo, comentario }); pintarValor(msg, -1); fb.remove(); toast("Gracias. Usaremos tu opinión para mejorar"); }
    catch (e) { fb.querySelectorAll("button").forEach(b => b.disabled = false); toast(e.message); }
}

/* ── Voz: lectura en voz alta ── */
let voz = null; // { msg, audio, cancelado, cola }
function textoParaVoz(raw) {
    return quitarMarcas(raw)
        .replace(/```grafica[\s\S]*?```/g, " Te muestro una gráfica en pantalla. ")
        .replace(/```[\s\S]*?```/g, " Te dejé un bloque de código en pantalla. ")
        .replace(/⟦[^⟧]*⟧/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/^\s*\|?\s*:?-{2,}.*$/gm, "").replace(/^\s*\|(.+)\|\s*$/gm, (_, f) => f.split("|").map(c => c.trim()).filter(Boolean).join(", ") + ".")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, "el enlace")
        .replace(/[*_`#>]+/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/<br\s*\/?>/gi, " ")
        .replace(/\p{Extended_Pictographic}/gu, "").replace(/\n{2,}/g, ".\n").replace(/\.(\s*\.)+/g, ".").replace(/[ \t]+/g, " ").trim();
}
function trozosVoz(t) {
    const frases = t.match(/[^.!?¡¿\n]+[.!?]*\s*/g) || [t], out = []; let acc = "";
    for (const f of frases) { const lim = out.length ? 1400 : 350; if (acc && (acc + f).length > lim) { out.push(acc.trim()); acc = ""; } acc += f; }
    if (acc.trim()) out.push(acc.trim());
    return out.slice(0, 12);
}
async function audioDe(texto) {
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }, body: JSON.stringify({ accion: "hablar", ...credenciales(), texto }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); if (d.cuota) pintarCuota(d.cuota); throw new Error(d.error || "No se pudo generar el audio."); }
    return URL.createObjectURL(await r.blob());
}
function botonVozEstado(msg, estado) {
    const b = msg?.querySelector("[data-tts]"); if (!b) return;
    b.classList.toggle("act", estado !== "listo");
    b.innerHTML = estado === "cargando" ? `<span class="mini-spin"></span> Preparando` : estado === "hablando" ? `${I.pausa} Detener` : `${I.voz} Escuchar`;
}
function pararVoz() {
    if (!voz) return;
    voz.cancelado = true; voz.audio?.pause(); window.speechSynthesis?.cancel(); voz.urls?.forEach(u => URL.revokeObjectURL(u));
    botonVozEstado(voz.msg, "listo"); voz = null;
}
function vozNavegador(texto, v) {
    // Respaldo: voz del navegador si el servidor no puede generar audio
    if (!("speechSynthesis" in window)) { toast("Tu navegador no puede leer en voz alta."); return pararVoz(); }
    const u = new SpeechSynthesisUtterance(texto.slice(0, 6000)); u.lang = "es-MX"; u.rate = 1.02;
    const es = speechSynthesis.getVoices().find(x => /^es/i.test(x.lang)); if (es) u.voice = es;
    u.onend = u.onerror = () => { if (voz === v) pararVoz(); };
    botonVozEstado(v.msg, "hablando"); speechSynthesis.speak(u);
}
async function leerEnVoz(msg) {
    if (voz?.msg === msg) return pararVoz();
    pararVoz();
    const texto = textoParaVoz(msg.dataset.raw || ""); if (!texto) return;
    const v = voz = { msg, cancelado: false, urls: [] };
    botonVozEstado(msg, "cargando");
    const trozos = trozosVoz(texto);
    let siguiente = audioDe(trozos[0]);
    for (let i = 0; i < trozos.length; i++) {
        let url;
        try { url = await siguiente; } catch (e) { if (v.cancelado) return; if (i === 0) { vozNavegador(texto, v); return; } toast(e.message); break; }
        if (v.cancelado) { URL.revokeObjectURL(url); return; }
        v.urls.push(url);
        if (i + 1 < trozos.length) siguiente = audioDe(trozos[i + 1]); // se prepara el siguiente mientras suena este
        const a = v.audio = new Audio(url);
        botonVozEstado(msg, "hablando");
        try { await a.play(); } catch { toast("El navegador bloqueó el audio. Toca de nuevo «Escuchar»."); break; }
        await new Promise(res => { a.onended = a.onerror = a.onpause = res; });
        if (v.cancelado) return;
    }
    if (voz === v) pararVoz();
}

/* ── Voz: dictado (micrófono → texto) ── */
const MAX_SEG_GRAB = 120;
let grab = null; // { rec, stream, chunks, t0, timer, cancelado }
const puedeGrabar = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
function pintarMic(estado) {
    const b = $("btnMic"); if (!b) return;
    b.className = "mic" + (estado === "grabando" ? " rec" : estado === "procesando" ? " proc" : "");
    b.innerHTML = estado === "procesando" ? '<span class="mini-spin"></span>' : estado === "grabando" ? I.stop : I.mic;
    b.title = estado === "grabando" ? "Terminar y transcribir" : estado === "procesando" ? "Transcribiendo…" : "Dictar por voz";
    b.disabled = estado === "procesando";
    $("grab").hidden = estado !== "grabando";
    $("form").classList.toggle("grabando", estado === "grabando");
}
async function iniciarDictado() {
    if (grab) return terminarDictado(false);
    pararVoz();
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { return toast(e?.name === "NotAllowedError" ? "Permite el uso del micrófono en tu navegador para dictar." : "No se encontró un micrófono disponible."); }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(m => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    const g = grab = { rec, stream, chunks: [], t0: Date.now(), cancelado: false };
    rec.ondataavailable = e => { if (e.data.size) g.chunks.push(e.data); };
    rec.onstop = () => procesarDictado(g);
    rec.start(1000);
    // Nivel del micrófono para la animación
    try {
        const ctx = g.ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 64; ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount), barras = [...$("grab").querySelectorAll(".gb i")];
        const paso = () => { if (grab !== g) return; an.getByteFrequencyData(buf); barras.forEach((b, i) => { b.style.transform = `scaleY(${Math.max(.15, (buf[i * 2 + 1] || 0) / 255)})`; }); g.raf = requestAnimationFrame(paso); };
        paso();
    } catch { /* sin animación */ }
    g.timer = setInterval(() => {
        const s = Math.floor((Date.now() - g.t0) / 1000);
        $("grabT").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        if (s >= MAX_SEG_GRAB) terminarDictado(false);
    }, 250);
    $("grabT").textContent = "0:00";
    pintarMic("grabando");
}
function terminarDictado(cancelar) {
    const g = grab; if (!g) return;
    g.cancelado = cancelar; clearInterval(g.timer); cancelAnimationFrame(g.raf); g.ctx?.close?.();
    try { g.rec.state !== "inactive" && g.rec.stop(); } catch { procesarDictado(g); }
    g.stream.getTracks().forEach(t => t.stop());
    grab = null;
    pintarMic(cancelar ? "listo" : "procesando");
}
async function procesarDictado(g) {
    if (g.cancelado) return pintarMic("listo");
    const blob = new Blob(g.chunks, { type: (g.rec.mimeType || "audio/webm").split(";")[0] });
    if (blob.size < 1500 || Date.now() - g.t0 < 700) { pintarMic("listo"); return toast("No se escuchó nada. Habla un poco más antes de terminar."); }
    try {
        const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
        const d = await api("transcribir", { audio: b64, mime: blob.type });
        const t = (d.texto || "").trim();
        if (!t) toast("No entendí el audio. Intenta de nuevo, más cerca del micrófono.");
        else {
            const e = $("entrada"); e.value = (e.value.trim() ? e.value.trimEnd() + " " : "") + t;
            e.dispatchEvent(new Event("input")); e.focus(); e.setSelectionRange(e.value.length, e.value.length);
        }
        cargarCuota();
    } catch (e) { toast(e.message); }
    pintarMic("listo");
}

/* ── Personalizar: perfil, instrucciones y memoria ── */
const ATAJOS_ESTILO = ["Respuestas cortas y al grano", "Con pasos numerados", "Tono formal", "Tono cercano", "Sin tecnicismos", "Con ejemplos prácticos", "Siempre en tablas cuando haya datos"];
let perfilDatos = null;
async function abrirPerfil() {
    const m = $("perfilModal"), b = $("perfilBody");
    m.classList.add("open"); b.innerHTML = '<div class="dots"><i></i><i></i><i></i></div>';
    try { perfilDatos = await api("perfil"); pintarPerfil(); } catch (e) { b.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}
function pintarPerfil() {
    const { perfil: p, memorias } = perfilDatos, b = $("perfilBody");
    const fecha = s => new Date(s).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
    b.innerHTML =
        `<form class="ad-form" id="fPerfil">` +
        `<p class="ad-nota">Lo que escribas aquí se aplica a todas tus conversaciones. Solo tú lo ves.</p>` +
        `<label>¿Qué debería saber Alterna IA de ti?<textarea name="sobre_mi" rows="3" maxlength="1500" placeholder="Ej.: Soy analista de Contabilidad en Alterna. Preparo el cierre mensual y reportes en Excel para gerencia."></textarea><small class="cnt" data-cnt="sobre_mi"></small></label>` +
        `<label>¿Cómo quieres que te responda?<textarea name="instrucciones" rows="3" maxlength="1500" placeholder="Ej.: Respuestas cortas, con pasos numerados y sin tecnicismos."></textarea><small class="cnt" data-cnt="instrucciones"></small></label>` +
        `<div class="ad-presets pf-atajos"><small>Agregar:</small>${ATAJOS_ESTILO.map(a => `<button type="button" class="ad-btn" data-atajo="${esc(a)}">${esc(a)}</button>`).join("")}</div>` +
        `<label class="ad-sw"><input type="checkbox" name="memoria_activa"> <span><b>Memoria</b><small>Alterna IA recuerda datos útiles entre conversaciones (por ejemplo, tu área o tus preferencias). Puedes pedirle «recuerda que…» u «olvida que…».</small></span></label>` +
        `<div class="ad-acts"><button type="submit" class="ad-btn pri">Guardar</button></div></form>` +
        `<div class="ad-h pf-h"><span>Lo que Alterna IA recuerda de ti <small>(${memorias.length})</small></span>${memorias.length ? '<button type="button" class="ad-btn peligro" data-mem-todas>Borrar todo</button>' : ""}</div>` +
        (memorias.length ? `<ul class="pf-mem">${memorias.map(x => `<li><span>${esc(x.texto)}<small>${fecha(x.created_at)}</small></span><button type="button" class="ad-btn" data-mem="${x.id}" aria-label="Olvidar">${I.del}</button></li>`).join("")}</ul>`
            : `<p class="ad-nota">Todavía no recuerda nada. Cuéntale algo como «Recuerda que trabajo en Recursos Humanos».</p>`);
    const f = $("fPerfil");
    f.sobre_mi.value = p.sobre_mi || ""; f.instrucciones.value = p.instrucciones || ""; f.memoria_activa.checked = p.memoria_activa !== false;
    const contar = () => f.querySelectorAll("[data-cnt]").forEach(s => { s.textContent = `${f[s.dataset.cnt].value.length} / 1500`; });
    f.addEventListener("input", contar); contar();
    f.querySelectorAll("[data-atajo]").forEach(x => x.onclick = () => {
        const t = f.instrucciones, a = x.dataset.atajo; if (t.value.includes(a)) return;
        t.value = (t.value.trim() ? t.value.trim().replace(/[.]?$/, ". ") : "") + a + "."; contar(); t.focus();
    });
    f.onsubmit = async e => {
        e.preventDefault(); const btn = f.querySelector("[type=submit]"); btn.disabled = true;
        try { perfilDatos = await api("perfil_guardar", { perfil: { sobre_mi: f.sobre_mi.value, instrucciones: f.instrucciones.value, memoria_activa: f.memoria_activa.checked } }); toast("Personalización guardada"); pintarPerfil(); }
        catch (err) { toast(err.message); btn.disabled = false; }
    };
}
$("perfilModal").addEventListener("click", async e => {
    if (e.target.id === "perfilModal" || e.target.closest("[data-perfil-x]")) return $("perfilModal").classList.remove("open");
    const m = e.target.closest("[data-mem]");
    if (m) { m.disabled = true; try { perfilDatos = await api("memoria_borrar", { id: +m.dataset.mem }); pintarPerfil(); toast("Olvidado"); } catch (err) { toast(err.message); m.disabled = false; } return; }
    if (e.target.closest("[data-mem-todas]")) {
        if (!await confirmar({ titulo: "Borrar toda la memoria", mensaje: "Alterna IA olvidará todo lo que recuerda de ti. Tu perfil y tus conversaciones no se borran.", ok: "Borrar todo", peligro: true })) return;
        try { perfilDatos = await api("memoria_borrar", { id: "todas" }); pintarPerfil(); toast("Memoria borrada"); } catch (err) { toast(err.message); }
    }
});

/* ── Exportar ── */
function exportar() {
    if (!mensajes.length) return toast("No hay nada que exportar todavía.");
    const t = $("titulo").textContent;
    const cuerpo = mensajes.map(m => `### ${m.rol === "user" ? (usuario.nombre || "Usuario") : "Alterna IA"}\n\n${m.contenido}`).join("\n\n---\n\n");
    const blob = new Blob([`# ${t}\n\n_Exportado de Alterna IA — ${new Date().toLocaleString("es")}_\n\n${cuerpo}\n`], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = (t.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 50) || "conversacion") + ".md";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ── Acciones propuestas por la IA (tarjetas de confirmación) ── */
const ETIQ = { estado: "Estado", prioridad: "Prioridad", importancia: "Importancia", asignado: "Responsable", fecha_entrega: "Entrega", fecha_limite: "Fecha límite", notas: "Notas" };
const TITULO_ACC = { crear_actividad: "Nueva actividad", actualizar_actividad: "Actualizar actividad", programar_mantenimiento: "Programar mantenimiento" };
function tarjetaAccion(a) {
    const d = a.datos || {}, F = (k, v) => (v == null || v === "") ? "" : `<div class="acc-f"><span>${k}</span><b>${esc(v)}</b></div>`;
    let filas = "";
    if (a.tipo === "crear_actividad") filas = F("Actividad", d.actividad) + F("Prioridad", d.prioridad) + F("Importancia", d.importancia) + F("Área", d.area) + F("Responsable", d.asignado) + F("Entrega", d.fecha_entrega) + F("Proyecto", d.proyecto_macro) + F("Notas", d.notas);
    else if (a.tipo === "actualizar_actividad") filas = F("Actividad", "#" + d.id + " " + (d.titulo || "")) + Object.entries(d.cambios || {}).map(([k, v]) => F(ETIQ[k] || k, (v.antes ?? "—") + "  →  " + (v.despues ?? "—"))).join("");
    else filas = F("Equipo", d.equipo) + F("Tipo", d.tipo) + F("Fecha", d.fecha_programada) + F("Técnico", d.tecnico) + F("Descripción", d.descripcion);
    const est = { ejecutada: ["ok", "Ejecutada"], cancelada: ["no", "Cancelada"], error: ["err", "No se pudo ejecutar"] }[a.estado];
    const pie = a.estado === "pendiente"
        ? `<div class="acc-btns"><button type="button" class="acc-ok" data-acc-ok>Confirmar</button><button type="button" class="acc-no" data-acc-no>Cancelar</button></div>`
        : `<div class="acc-est ${est[0]}">${est[1]}${a.resultado ? " · " + esc(a.resultado) : ""}</div>`;
    return `<div class="acc-h">${I.shield}<span>${TITULO_ACC[a.tipo] || "Acción"}</span><em>Requiere tu confirmación</em></div><div class="acc-b">${filas}</div>${pie}`;
}
async function hidratarAcciones() {
    const nodos = [...document.querySelectorAll(".acc:not([data-h])")]; if (!nodos.length) return;
    nodos.forEach(n => n.dataset.h = "1");
    try {
        const d = await api("accion_info", { ids: nodos.map(n => n.dataset.acc) });
        nodos.forEach(n => { const a = d.acciones.find(x => x.id === n.dataset.acc); n.innerHTML = a ? tarjetaAccion(a) : '<div class="acc-est err">Acción no disponible</div>'; });
    } catch (e) { nodos.forEach(n => { n.innerHTML = `<div class="acc-est err">${esc(e.message)}</div>`; delete n.dataset.h; }); }
}
async function resolverAccion(id, confirmar) {
    const n = document.querySelector(`.acc[data-acc="${id}"]`); if (!n) return;
    n.querySelectorAll("button").forEach(b => b.disabled = true);
    try {
        const r = await api("accion_resolver", { id, confirmar });
        const info = (await api("accion_info", { ids: [id] })).acciones[0];
        n.innerHTML = tarjetaAccion(info || { tipo: "", datos: {}, estado: r.estado, resultado: r.resultado });
        toast(r.estado === "ejecutada" ? "Listo: " + r.resultado : r.resultado || "Hecho");
    } catch (e) { n.querySelectorAll("button").forEach(b => b.disabled = false); toast(e.message); }
}

/* ── Reportes: Excel (se genera en el navegador) ── */
const limpiarMd = t => t.replace(/<br\s*\/?>/gi, " ").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();
const SEP_TABLA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const celdasMd = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => limpiarMd(c));
function tablasMd(raw) {
    const L = raw.split("\n"), out = []; let i = 0;
    while (i < L.length) {
        if (/\|/.test(L[i]) && SEP_TABLA.test(L[i + 1] || "")) {
            const head = celdasMd(L[i]); i += 2; const rows = [];
            while (i < L.length && /\|/.test(L[i]) && L[i].trim()) rows.push(celdasMd(L[i++]));
            out.push({ head, rows });
        } else i++;
    }
    return out;
}
const botonesReporte = raw => (tablasMd(raw || "").length ? `<button type="button" data-xls>${I.xls} Excel</button>` : "");
const cargarScript = src => new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const e = document.createElement("script"); e.src = src; e.onload = res; e.onerror = () => rej(new Error("No se pudo cargar una librería. Revisa tu conexión.")); document.head.appendChild(e);
});
const nombreArchivo = ext => (($("titulo").textContent || "reporte").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "reporte") + "-" + new Date().toISOString().slice(0, 10) + "." + ext;

async function descargarExcel(raw) {
    try {
        await cargarScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
        const wb = XLSX.utils.book_new();
        tablasMd(raw).forEach((t, k) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.head, ...t.rows]), ("Tabla " + (k + 1)).slice(0, 31)));
        XLSX.writeFile(wb, nombreArchivo("xlsx")); toast("Excel descargado");
    } catch (e) { toast(e.message); }
}

/* ── Cuota del usuario (medidor en la barra lateral) ── */
const compacto = n => new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
function pintarCuota(c) {
    const q = $("quota");
    if (!c) { q.style.display = "none"; return; }
    q.style.display = "";
    const pct = c.porcentaje ?? 0;
    q.className = "quota" + (c.bloqueado ? " off" : c.ilimitado ? " inf" : pct >= 100 ? " full" : pct >= 80 ? " warn" : "");
    const estado = c.bloqueado ? "Acceso pausado" : c.ilimitado ? "Uso ilimitado" : c.tokens_limite == null ? "Sin límite de tokens" : `${pct}% usado`;
    const det = c.bloqueado ? (c.motivo_bloqueo || "Contacta al área de IT.")
        : c.ilimitado || c.tokens_limite == null ? `${compacto(c.tokens_usados)} tokens en este periodo`
        : `${compacto(c.tokens_usados)} de ${compacto(c.tokens_limite)} tokens · se restablece ${c.reinicia_texto}`;
    q.title = c.imagenes_limite != null ? `Imágenes: ${c.imagenes_usadas} de ${c.imagenes_limite} en este periodo` : "";
    q.innerHTML = `<div class="q-h"><span>Plan ${esc(c.plan || "—")}</span><b>${estado}</b></div>` +
        (c.ilimitado || c.bloqueado || c.tokens_limite == null ? "" : `<div class="q-bar"><i style="width:${pct}%"></i></div>`) +
        `<div class="q-d">${esc(det)}</div>`;
}
async function cargarCuota() {
    try { pintarCuota((await api("mi_cuota")).cuota); } catch { /* el medidor es informativo */ }
}

/* ── Panel de administración (solo admin) ── */
const DIAS_SEM = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const ZONAS = ["America/Guatemala", "America/El_Salvador", "America/Tegucigalpa", "America/Managua", "America/Costa_Rica", "America/Mexico_City", "America/Bogota", "America/Lima", "America/New_York", "Europe/Madrid", "UTC"];
const hh = h => String(h).padStart(2, "0") + ":00";
const textoPeriodo = p => p.periodo === "semana" ? `Cada ${DIAS_SEM[(p.dia_reinicio - 1) % 7].toLowerCase()} a las ${hh(p.hora_reinicio)}`
    : p.periodo === "mes" ? `El día ${p.dia_reinicio} de cada mes a las ${hh(p.hora_reinicio)}` : `Cada día a las ${hh(p.hora_reinicio)}`;
const nombrePer = p => ({ dia: "día", semana: "semana", mes: "mes" })[p] || "día";
let adTab = "cuotas", adDatos = null, adFiltro = "";

function abrirAdmin() {
    $("adminModal").classList.add("open");
    $("adminTabs").querySelectorAll("button").forEach(b => b.classList.toggle("act", b.dataset.tab === adTab));
    pintarTab();
}
$("adminTabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    adTab = b.dataset.tab; $("adminTabs").querySelectorAll("button").forEach(x => x.classList.toggle("act", x === b)); pintarTab();
});
async function pintarTab() {
    const cont = $("adminBody"); cont.innerHTML = '<div class="dots"><i></i><i></i><i></i></div>';
    try {
        if (adTab === "uso") return await pintarUso(cont);
        if (adTab === "calidad") return await pintarCalidad(cont);
        adDatos = await api("admin_cuotas");
        adTab === "planes" ? pintarPlanes(cont) : pintarCuotas(cont);
    } catch (e) { cont.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

function chipEstado(c) {
    if (!c) return '<span class="chip">—</span>';
    if (c.bloqueado) return '<span class="chip off">Pausado</span>';
    if (c.ilimitado) return '<span class="chip inf">Ilimitado</span>';
    if (c.tokens_restantes === 0) return '<span class="chip full">Límite alcanzado</span>';
    if (c.tokens_limite && c.tokens_usados / (c.tokens_limite + c.tokens_extra) >= .8) return '<span class="chip warn">Cerca del límite</span>';
    return '<span class="chip ok">Activo</span>';
}
function barraConsumo(c) {
    if (!c) return "—";
    if (c.ilimitado || c.tokens_limite == null) return `<span class="q-num">${compacto(c.tokens_usados)}</span> <small>sin límite</small>`;
    const total = c.tokens_limite + c.tokens_extra, pct = Math.min(100, Math.round(c.tokens_usados / Math.max(total, 1) * 100));
    return `<div class="ad-q ${pct >= 100 ? "full" : pct >= 80 ? "warn" : ""}"><div class="q-bar"><i style="width:${pct}%"></i></div><span>${compacto(c.tokens_usados)} / ${compacto(total)}${c.tokens_extra ? ` <small>(+${compacto(c.tokens_extra)} extra)</small>` : ""}</span></div>`;
}

// Cambio rápido de plan desde la tabla: se guarda al elegir otra opción.
function selectorPlan(u) {
    const pred = adDatos.planes.find(p => p.predeterminado), actual = u.ajustes?.plan_id ?? "";
    return `<select class="ad-sel" data-plan-user="${u.id}" aria-label="Plan de ${esc(u.nombre || "")}">` +
        `<option value="">Predeterminado${pred ? ` (${esc(pred.nombre)})` : ""}</option>` +
        adDatos.planes.map(p => `<option value="${p.id}"${p.id === actual ? " selected" : ""}>${esc(p.nombre)}</option>`).join("") + `</select>`;
}
$("adminBody").addEventListener("change", async e => {
    const s = e.target.closest("[data-plan-user]"); if (!s) return;
    const id = +s.dataset.planUser, u = adDatos.usuarios.find(x => x.id === id), previo = u?.ajustes?.plan_id ?? "";
    s.disabled = true;
    try {
        await api("admin_cuota_guardar", { cuota: { usuario_id_objetivo: id, plan_id: s.value || null } });
        toast(`Plan de ${u?.nombre || "usuario"}: ${s.options[s.selectedIndex].text}`);
        adDatos = await api("admin_cuotas"); pintarCuotas($("adminBody")); if (id === usuario.id) cargarCuota();
    } catch (err) { toast(err.message); s.value = previo; s.disabled = false; }
});

function pintarCuotas(cont) {
    const q = adFiltro.trim().toLowerCase();
    const us = adDatos.usuarios.filter(u => !q || (u.nombre + " " + u.correo).toLowerCase().includes(q));
    const n = k => adDatos.usuarios.filter(u => k(u.cuota || {})).length;
    cont.innerHTML =
        `<div class="ad-stats"><div><b>${adDatos.usuarios.length}</b><span>Usuarios</span></div><div><b>${n(c => c.ilimitado)}</b><span>Ilimitados</span></div><div><b>${n(c => !c.ilimitado && c.tokens_restantes === 0)}</b><span>En su límite</span></div><div><b>${n(c => c.bloqueado)}</b><span>Pausados</span></div></div>` +
        `<div class="ad-bar-top"><input type="search" id="adBuscar" placeholder="Buscar usuario" value="${esc(adFiltro)}" autocomplete="off"></div>` +
        `<div class="tw"><table><thead><tr><th>Usuario</th><th>Plan</th><th>Consumo del periodo</th><th>Imágenes</th><th>Se restablece</th><th>Estado</th><th></th></tr></thead><tbody>` +
        (us.map(u => { const c = u.cuota; return `<tr><td>${esc(u.nombre || "—")}<br><small>${esc(u.correo || "")}</small></td>` +
            `<td>${selectorPlan(u)}${c?.personalizado ? '<br><small title="Tiene ajustes propios (Gestionar)">personalizado</small>' : ""}</td>` +
            `<td>${barraConsumo(c)}</td><td>${c ? (c.imagenes_limite == null ? `${c.imagenes_usadas} <small>/ ∞</small>` : `${c.imagenes_usadas} / ${c.imagenes_limite}`) : "—"}</td>` +
            `<td>${c ? esc(c.reinicia_texto) : "—"}</td><td>${chipEstado(c)}</td>` +
            `<td><button class="ad-btn" data-gest="${u.id}">Gestionar</button></td></tr>`; }).join("") || `<tr><td colspan="7"><small>Sin resultados.</small></td></tr>`) +
        `</tbody></table></div>`;
    const inp = $("adBuscar");
    inp.addEventListener("input", () => { adFiltro = inp.value; pintarCuotas(cont); const i = $("adBuscar"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
}

const aLocal = iso => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const ACCIONES_HIST = { cuota_editada: "Ajustes actualizados", consumo_reiniciado: "Consumo reiniciado" };
const CAMPOS_HIST = { plan_id: "plan", ilimitado: "ilimitado", bloqueado: "pausado", motivo_bloqueo: "motivo", tokens_limite: "límite", tokens_extra: "tokens extra", extra_hasta: "extra vence", notas: "notas" };
function resumenCambio(h) {
    const d = h.detalle || {};
    const partes = Object.entries(d).map(([k, v]) => {
        if (k === "plan_id") return "plan: " + (adDatos.planes.find(p => p.id === v)?.nombre || "predeterminado");
        if (typeof v === "boolean") return `${CAMPOS_HIST[k] || k}: ${v ? "sí" : "no"}`;
        if (k === "extra_hasta") return "extra vence: " + (v ? new Date(v).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "nunca");
        if (k === "tokens_limite" || k === "tokens_extra") return `${CAMPOS_HIST[k]}: ${v == null ? "del plan" : compacto(v)}`;
        return `${CAMPOS_HIST[k] || k}: ${v ?? "—"}`;
    });
    return partes.join(" · ");
}

async function gestionarUsuario(id) {
    const u = adDatos.usuarios.find(x => x.id === id); if (!u) return;
    const c = u.cuota || {}, a = u.ajustes || {}, cont = $("adminBody");
    const pred = adDatos.planes.find(p => p.predeterminado);
    cont.innerHTML =
        `<button class="ad-back" data-volver>← Usuarios</button>` +
        `<div class="ad-user"><div><b>${esc(u.nombre || "—")}</b><small>${esc(u.correo || "")} · ${esc(u.rol || "")}</small></div>${chipEstado(c)}</div>` +
        `<div class="ad-now">${barraConsumo(c)}<small>Periodo actual: desde ${c.inicio ? new Date(c.inicio).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" }) : "—"} · se restablece ${esc(c.reinicia_texto || "—")}</small></div>` +
        `<form class="ad-form" id="fCuota">` +
        `<label>Plan<select name="plan_id"><option value="">Predeterminado${pred ? ` (${esc(pred.nombre)})` : ""}</option>${adDatos.planes.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></label>` +
        `<label class="ad-sw"><input type="checkbox" name="ilimitado"> <span><b>Ilimitado</b><small>Sin límite de tokens, imágenes ni mensajes por hora, sin importar el plan.</small></span></label>` +
        `<div class="ad-2"><label>Límite propio de tokens por periodo<input name="tokens_limite" type="number" min="0" step="1000" placeholder="El del plan"></label>` +
        `<label>Tokens extra (bono)<input name="tokens_extra" type="number" min="0" step="1000" placeholder="0"></label></div>` +
        `<label>El bono vence<input name="extra_hasta" type="datetime-local"><small>Vacío: el bono no vence (se suma en cada periodo).</small></label>` +
        `<label class="ad-sw"><input type="checkbox" name="bloqueado"> <span><b>Pausar acceso a la IA</b><small>El usuario no podrá enviar mensajes hasta que lo reactives.</small></span></label>` +
        `<label>Motivo visible para el usuario<input name="motivo_bloqueo" maxlength="200" placeholder="Opcional"></label>` +
        `<label>Notas internas<textarea name="notas" rows="2" maxlength="500" placeholder="Solo las ven los administradores"></textarea></label>` +
        `<div class="ad-acts"><button type="submit" class="ad-btn pri">Guardar cambios</button><button type="button" class="ad-btn" data-reset>Reiniciar consumo ahora</button></div></form>` +
        `<div class="ad-h">Historial</div><div id="adHist"><div class="dots"><i></i><i></i><i></i></div></div>`;
    // El formulario muestra los ajustes guardados del usuario (no el estado calculado con el plan)
    const f = $("fCuota");
    f.plan_id.value = a.plan_id ?? ""; f.ilimitado.checked = !!a.ilimitado; f.tokens_limite.value = a.tokens_limite ?? "";
    f.tokens_extra.value = a.tokens_extra || ""; f.extra_hasta.value = aLocal(a.extra_hasta);
    f.bloqueado.checked = !!a.bloqueado; f.motivo_bloqueo.value = a.motivo_bloqueo || ""; f.notas.value = a.notas || "";
    const sync = () => { f.motivo_bloqueo.closest("label").style.display = f.bloqueado.checked ? "" : "none"; f.tokens_limite.disabled = f.ilimitado.checked; };
    f.bloqueado.onchange = f.ilimitado.onchange = sync; sync();
    f.onsubmit = async e => {
        e.preventDefault();
        const b = f.querySelector("[type=submit]"); b.disabled = true;
        try {
            await api("admin_cuota_guardar", { cuota: {
                usuario_id_objetivo: id, plan_id: f.plan_id.value || null, ilimitado: f.ilimitado.checked, bloqueado: f.bloqueado.checked,
                motivo_bloqueo: f.motivo_bloqueo.value, tokens_limite: f.tokens_limite.value === "" ? null : +f.tokens_limite.value,
                tokens_extra: f.tokens_extra.value === "" ? 0 : +f.tokens_extra.value,
                extra_hasta: f.extra_hasta.value ? new Date(f.extra_hasta.value).toISOString() : null, notas: f.notas.value } });
            toast("Cambios guardados"); adDatos = await api("admin_cuotas"); gestionarUsuario(id); if (id === usuario.id) cargarCuota();
        } catch (err) { toast(err.message); b.disabled = false; }
    };
    f.querySelector("[data-reset]").onclick = async () => {
        if (!await confirmar({ titulo: "Reiniciar consumo", mensaje: `El consumo del periodo actual de ${u.nombre || "este usuario"} volverá a cero desde este momento. El historial de uso se conserva.`, ok: "Reiniciar" })) return;
        try { await api("admin_cuota_reiniciar", { usuario_id_objetivo: id }); toast("Consumo reiniciado"); adDatos = await api("admin_cuotas"); gestionarUsuario(id); if (id === usuario.id) cargarCuota(); }
        catch (err) { toast(err.message); }
    };
    try {
        const h = await api("admin_cuota_historial", { usuario_id_objetivo: id }), fecha = s => new Date(s).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
        $("adHist").innerHTML =
            (h.cambios.length ? `<ul class="ad-log">${h.cambios.map(x => `<li><b>${ACCIONES_HIST[x.accion] || x.accion}</b> <small>${fecha(x.created_at)}${x.admin?.nombre ? " · " + esc(x.admin.nombre) : ""}</small>${x.accion === "cuota_editada" ? `<div>${esc(resumenCambio(x))}</div>` : ""}</li>`).join("")}</ul>` : `<p class="ad-nota">Sin cambios registrados.</p>`) +
            `<div class="ad-h">Últimos usos</div>` +
            (h.uso.length ? `<div class="tw"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Modelo</th><th>Entrada</th><th>Salida</th></tr></thead><tbody>${h.uso.map(x => `<tr><td>${fecha(x.created_at)}</td><td>${{ imagen: "Imagen", voz: "Voz" }[x.tipo] || "Mensaje"}</td><td>${esc(x.modelo || "—")}</td><td>${x.tipo === "imagen" ? "—" : (x.tokens_entrada ?? 0).toLocaleString("es")}</td><td>${x.tipo === "imagen" ? "—" : (x.tokens_salida ?? 0).toLocaleString("es")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="ad-nota">Aún no ha usado la IA.</p>`);
    } catch (err) { $("adHist").innerHTML = `<div class="err">${esc(err.message)}</div>`; }
}

function pintarPlanes(cont) {
    const enPlan = id => adDatos.usuarios.filter(u => u.cuota?.plan_id === id).length;
    const lim = (v, suf) => v == null ? "Sin límite" : `${compacto(v)} ${suf}`;
    cont.innerHTML =
        `<div class="ad-bar-top"><p class="ad-nota">Los planes definen cuánto puede usar cada persona y cuándo se restablece su consumo. Los usuarios sin plan asignado usan el <b>predeterminado</b>.</p><button class="ad-btn pri" data-plan-nuevo>+ Nuevo plan</button></div>` +
        `<div class="ad-planes">${adDatos.planes.map(p => `<div class="ad-plan${p.predeterminado ? " pred" : ""}">` +
            `<div class="ap-h"><b>${esc(p.nombre)}</b>${p.predeterminado ? '<span class="chip ok">Predeterminado</span>' : ""}${p.ilimitado ? '<span class="chip inf">Ilimitado</span>' : ""}</div>` +
            (p.descripcion ? `<p>${esc(p.descripcion)}</p>` : "") +
            (p.ilimitado ? `<ul><li>Tokens, imágenes y mensajes sin límite</li></ul>` :
            `<ul><li><span>Tokens</span><b>${lim(p.tokens_limite, "por " + nombrePer(p.periodo))}</b></li><li><span>Imágenes</span><b>${lim(p.imagenes_limite, "por " + nombrePer(p.periodo))}</b></li><li><span>Mensajes</span><b>${lim(p.mensajes_hora, "por hora")}</b></li><li><span>Se restablece</span><b>${textoPeriodo(p)}</b></li></ul>`) +
            `<div class="ap-f"><small>${enPlan(p.id)} usuario(s) · ${esc(p.zona_horaria)}</small><span><button class="ad-btn" data-plan-ed="${p.id}">Editar</button>${p.predeterminado ? "" : `<button class="ad-btn peligro" data-plan-del="${p.id}">Eliminar</button>`}</span></div></div>`).join("")}</div>`;
}

function formPlan(p = {}) {
    const cont = $("adminBody"), nuevo = !p.id;
    const zonas = [...new Set([p.zona_horaria || "America/Guatemala", ...ZONAS])];
    cont.innerHTML =
        `<button class="ad-back" data-tab-volver="planes">← Planes</button><div class="ad-h">${nuevo ? "Nuevo plan" : "Editar plan"}</div>` +
        `<form class="ad-form" id="fPlan">` +
        `<div class="ad-2"><label>Nombre<input name="nombre" required maxlength="60"></label><label>Descripción<input name="descripcion" maxlength="200" placeholder="Opcional"></label></div>` +
        `<label class="ad-sw"><input type="checkbox" name="ilimitado"> <span><b>Plan ilimitado</b><small>Sin límite de tokens, imágenes ni mensajes por hora.</small></span></label>` +
        `<div class="ad-lim"><div class="ad-3"><label>Tokens por periodo<input name="tokens_limite" type="number" min="0" step="1000"></label>` +
        `<label>Imágenes por periodo<input name="imagenes_limite" type="number" min="0" placeholder="Sin límite"></label>` +
        `<label>Mensajes por hora<input name="mensajes_hora" type="number" min="1" placeholder="Sin límite"></label></div>` +
        `<div class="ad-presets"><small>Rápido:</small>${[[50e3, "50 mil"], [200e3, "200 mil"], [500e3, "500 mil"], [1e6, "1 millón"], [5e6, "5 millones"]].map(([v, t]) => `<button type="button" class="ad-btn" data-tok="${v}">${t}</button>`).join("")}</div></div>` +
        `<div class="ad-h">Restablecimiento del consumo</div>` +
        `<div class="ad-3"><label>Periodo<select name="periodo"><option value="dia">Diario</option><option value="semana">Semanal</option><option value="mes">Mensual</option></select></label>` +
        `<label class="ad-dia">Día<select name="dia_reinicio"></select></label>` +
        `<label>Hora<select name="hora_reinicio">${Array.from({ length: 24 }, (_, h) => `<option value="${h}">${hh(h)}</option>`).join("")}</select></label></div>` +
        `<label>Zona horaria<select name="zona_horaria">${zonas.map(z => `<option>${esc(z)}</option>`).join("")}</select></label>` +
        `<p class="ad-nota" id="fPlanRes"></p>` +
        `<label class="ad-sw"><input type="checkbox" name="predeterminado"> <span><b>Plan predeterminado</b><small>Se aplica a todos los usuarios que no tienen un plan asignado.</small></span></label>` +
        `<div class="ad-acts"><button type="submit" class="ad-btn pri">${nuevo ? "Crear plan" : "Guardar plan"}</button></div></form>`;
    const f = $("fPlan");
    f.nombre.value = p.nombre || ""; f.descripcion.value = p.descripcion || ""; f.ilimitado.checked = !!p.ilimitado;
    f.tokens_limite.value = p.tokens_limite ?? (nuevo ? 200000 : ""); f.imagenes_limite.value = p.imagenes_limite ?? ""; f.mensajes_hora.value = p.mensajes_hora ?? (nuevo ? 60 : "");
    f.periodo.value = p.periodo || "dia"; f.hora_reinicio.value = p.hora_reinicio ?? 0; f.zona_horaria.value = p.zona_horaria || "America/Guatemala"; f.predeterminado.checked = !!p.predeterminado;
    const dias = () => {
        const per = f.periodo.value, prev = +f.dia_reinicio.value || p.dia_reinicio || 1;
        f.dia_reinicio.innerHTML = per === "semana" ? DIAS_SEM.map((d, i) => `<option value="${i + 1}">${d}</option>`).join("") : Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">Día ${i + 1}</option>`).join("");
        f.dia_reinicio.value = Math.min(prev, per === "semana" ? 7 : 28);
        f.querySelector(".ad-dia").style.display = per === "dia" ? "none" : "";
    };
    const sync = () => {
        f.querySelector(".ad-lim").style.display = f.ilimitado.checked ? "none" : "";
        $("fPlanRes").textContent = `${textoPeriodo({ periodo: f.periodo.value, dia_reinicio: +f.dia_reinicio.value || 1, hora_reinicio: +f.hora_reinicio.value })} (${f.zona_horaria.value}), el consumo de cada usuario vuelve a cero.`;
    };
    dias(); sync();
    f.periodo.onchange = () => { dias(); sync(); }; f.dia_reinicio.onchange = f.hora_reinicio.onchange = f.zona_horaria.onchange = f.ilimitado.onchange = sync;
    f.querySelectorAll("[data-tok]").forEach(b => b.onclick = () => { f.tokens_limite.value = b.dataset.tok; });
    f.onsubmit = async e => {
        e.preventDefault();
        const b = f.querySelector("[type=submit]"); b.disabled = true;
        const v = k => f[k].value === "" ? null : +f[k].value;
        try {
            await api("admin_plan_guardar", { plan: {
                id: p.id, nombre: f.nombre.value, descripcion: f.descripcion.value, ilimitado: f.ilimitado.checked,
                tokens_limite: v("tokens_limite"), imagenes_limite: v("imagenes_limite"), mensajes_hora: v("mensajes_hora"),
                periodo: f.periodo.value, dia_reinicio: +f.dia_reinicio.value || 1, hora_reinicio: +f.hora_reinicio.value,
                zona_horaria: f.zona_horaria.value, predeterminado: f.predeterminado.checked } });
            toast(nuevo ? "Plan creado" : "Plan guardado"); adTab = "planes"; pintarTab(); cargarCuota();
        } catch (err) { toast(err.message); b.disabled = false; }
    };
}

$("adminBody").addEventListener("click", async e => {
    const g = e.target.closest("[data-gest]"); if (g) return gestionarUsuario(+g.dataset.gest);
    if (e.target.closest("[data-volver]")) return pintarCuotas($("adminBody"));
    const tv = e.target.closest("[data-tab-volver]"); if (tv) return pintarPlanes($("adminBody"));
    if (e.target.closest("[data-plan-nuevo]")) return formPlan();
    const ed = e.target.closest("[data-plan-ed]"); if (ed) return formPlan(adDatos.planes.find(p => p.id === +ed.dataset.planEd));
    const del = e.target.closest("[data-plan-del]");
    if (del) {
        const p = adDatos.planes.find(x => x.id === +del.dataset.planDel); if (!p) return;
        if (!await confirmar({ titulo: "Eliminar plan", mensaje: `Se eliminará el plan «${p.nombre}». Los usuarios que lo tenían pasarán al plan predeterminado.`, ok: "Eliminar", peligro: true })) return;
        try { await api("admin_plan_eliminar", { id: p.id }); toast("Plan eliminado"); pintarTab(); cargarCuota(); } catch (err) { toast(err.message); }
    }
});

async function pintarUso(cont) {
        const d = await api("admin_uso"), max = Math.max(1, ...d.mensajes_por_dia.map(x => x.n));
        const num = n => Number(n).toLocaleString("es"), usd = n => n == null ? "—" : "$" + Number(n).toFixed(2);
        cont.innerHTML =
            `<div class="ad-stats"><div><b>${num(d.total.mensajes)}</b><span>Mensajes (30 d)</span></div><div><b>${num(d.total.imagenes)}</b><span>Imágenes</span></div><div><b>${num(d.total.tokens)}</b><span>Tokens</span></div><div><b>${usd(d.total.costo_usd)}</b><span>Costo estimado</span></div></div>` +
            `<div class="ad-h">Mensajes por día (últimos 14)</div><div class="ad-bars">${d.mensajes_por_dia.map(x => `<div class="ad-bar" title="${x.fecha}: ${x.n}"><i style="height:${Math.round(x.n / max * 100)}%"></i><span>${x.fecha.slice(8)}</span></div>`).join("")}</div>` +
            `<div class="ad-h">Uso por usuario</div><div class="tw"><table><thead><tr><th>Usuario</th><th>Mensajes</th><th>Imágenes</th><th>Tokens</th><th>Conv.</th><th>Costo</th><th>Último uso</th></tr></thead><tbody>` +
            d.usuarios.map(u => `<tr><td>${esc(u.nombre)}<br><small>${esc(u.correo)}</small></td><td>${num(u.mensajes)}</td><td>${num(u.imagenes)}</td><td>${num(u.tokens_entrada + u.tokens_salida)}</td><td>${num(u.conversaciones)}</td><td>${usd(u.costo_usd)}</td><td>${u.ultimo ? new Date(u.ultimo).toLocaleDateString("es") : "—"}</td></tr>`).join("") + `</tbody></table></div>` +
            (d.costo_configurado ? "" : `<p class="ad-nota">Para ver el costo estimado, agrega en Supabase (Edge Functions → Secrets) los precios de tu modelo: <code>IA_PRECIO_ENTRADA_USD_1M</code>, <code>IA_PRECIO_SALIDA_USD_1M</code> e <code>IA_PRECIO_IMAGEN_USD</code>. Los mensajes y tokens ya se registran.</p>`);
}
$("adminModal").addEventListener("click", e => { if (e.target.id === "adminModal" || e.target.closest("[data-admin-x]")) $("adminModal").classList.remove("open"); });

// Calidad: cómo califican los usuarios las respuestas, por nivel y modelo, y qué falla
let calDias = 30;
const NOMBRE_NIVEL = { bajo: "Rápido", medio: "Equilibrado", alto: "Avanzado" };
async function pintarCalidad(cont) {
    const d = await api("admin_calidad", { dias: calDias });
    const pct = v => v == null ? "—" : v + " %";
    const barra = (x, total) => `<div class="cal-row"><span>${esc(x.etiqueta)}</span><div class="cal-bar"><i style="width:${Math.round(x.n / Math.max(total, 1) * 100)}%"></i></div><b>${x.n}</b></div>`;
    const filaGrupo = (g, nombre) => `<tr><td>${esc(nombre(g.clave))}</td><td>${g.n}</td><td>${g.pos}</td><td>${g.n - g.pos}</td><td><span class="chip ${g.satisfaccion >= 80 ? "ok" : g.satisfaccion >= 60 ? "warn" : "full"}">${g.satisfaccion} %</span></td></tr>`;
    const tablaGrupo = (lista, titulo, nombre) => lista.length ? `<div class="ad-h">${titulo}</div><div class="tw"><table><thead><tr><th></th><th>Calificaciones</th><th>👍</th><th>👎</th><th>Satisfacción</th></tr></thead><tbody>${lista.map(g => filaGrupo(g, nombre)).join("")}</tbody></table></div>` : "";
    cont.innerHTML =
        `<div class="ad-bar-top"><p class="ad-nota">Calificaciones que dan los usuarios a las respuestas con 👍 y 👎.</p><select class="ad-sel" id="calDias" aria-label="Periodo">${[7, 30, 90].map(n => `<option value="${n}"${n === calDias ? " selected" : ""}>Últimos ${n} días</option>`).join("")}</select></div>` +
        `<div class="ad-stats"><div><b>${d.total}</b><span>Calificaciones</span></div><div><b>${pct(d.satisfaccion)}</b><span>Satisfacción</span></div><div><b>${d.positivas}</b><span>👍 Buenas</span></div><div><b>${d.negativas}</b><span>👎 Malas</span></div></div>` +
        (d.total ? "" : `<p class="ad-nota">Aún no hay calificaciones en este periodo. Aparecerán cuando los usuarios usen 👍 o 👎 debajo de cada respuesta.</p>`) +
        tablaGrupo(d.por_nivel, "Por nivel", k => NOMBRE_NIVEL[k] || "Sin dato") +
        tablaGrupo(d.por_modelo, "Por modelo", k => k) +
        (d.motivos.length ? `<div class="ad-h">Por qué fallan</div><div class="cal-motivos">${d.motivos.map(m => barra({ etiqueta: m.motivo, n: m.n }, d.negativas)).join("")}</div>` : "") +
        (d.negativas_recientes.length ? `<div class="ad-h">Respuestas mal calificadas recientes</div><div class="cal-lista">${d.negativas_recientes.map(x =>
            `<div class="cal-item"><div class="ci-h"><b>${esc(x.usuario)}</b><small>${new Date(x.fecha).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })} · ${esc(NOMBRE_NIVEL[x.nivel] || "—")}${x.modelo ? " · " + esc(x.modelo) : ""}</small>${x.motivo ? `<span class="chip full">${esc(x.motivo)}</span>` : ""}</div>` +
            (x.comentario ? `<p class="ci-c">“${esc(x.comentario)}”</p>` : "") +
            (x.pregunta ? `<div class="ci-q"><span>Pregunta</span>${esc(x.pregunta)}</div>` : "") +
            `<div class="ci-r"><span>Respuesta</span>${esc(x.respuesta)}${x.respuesta.length >= 700 ? "…" : ""}</div></div>`).join("")}</div>` : "");
    $("calDias").onchange = e => { calDias = +e.target.value; pintarTab(); };
}

/* ── Nivel de la IA: tres opciones con nombres claros; el backend elige el modelo de cada una ── */
const NIVELES = {
    bajo:  { n: "Rápido",      d: "Respuestas al instante para preguntas sencillas y textos cortos.", i: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>', 16) },
    medio: { n: "Equilibrado", d: "Para el día a día: correos, resúmenes, reportes y dudas generales.", i: svg('<path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 006 0L5 7zm14 0l-3 6a3 3 0 006 0l-3-6zM8 21h8"/>', 16) },
    alto:  { n: "Avanzado",    d: "Para análisis, programación y tareas complejas. Tarda un poco más.", i: svg('<path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zm7 11l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13z"/>', 16) },
};
let nivel = "medio";
try { const g = localStorage.getItem("ia_nivel"); if (NIVELES[g]) nivel = g; } catch { /* sin storage */ }
function pintarNivel() {
    const v = NIVELES[nivel];
    $("btnNivel").innerHTML = `<span class="nv-ic nv-${nivel}">${v.i}</span><span class="nv-n">${v.n}</span>${svg('<path d="M6 9l6 6 6-6"/>', 13, 'class="nv-flecha"')}`;
    $("menuNivel").innerHTML = `<div class="nv-t">Nivel de la IA</div>` + Object.entries(NIVELES).map(([k, x]) =>
        `<button type="button" role="menuitemradio" aria-checked="${k === nivel}" data-nivel="${k}" class="${k === nivel ? "act" : ""}"><span class="nv-ic nv-${k}">${x.i}</span><span><b>${x.n}</b><small>${x.d}</small></span>${k === nivel ? svg('<path d="M5 12l5 5L20 7"/>', 16, 'class="nv-ok"') : ""}</button>`).join("");
}
function menuNivel(abrir) {
    const m = $("menuNivel"); m.hidden = !abrir; $("btnNivel").setAttribute("aria-expanded", String(abrir));
    if (abrir) m.querySelector(".act")?.focus();
}
$("btnNivel").onclick = e => { e.stopPropagation(); menuNivel($("menuNivel").hidden); };
$("menuNivel").addEventListener("click", e => {
    const b = e.target.closest("[data-nivel]"); if (!b) return;
    nivel = b.dataset.nivel; try { localStorage.setItem("ia_nivel", nivel); } catch { /* sin storage */ }
    pintarNivel(); menuNivel(false); toast("Nivel: " + NIVELES[nivel].n); $("entrada").focus();
});
document.addEventListener("click", e => { if (!e.target.closest(".nivel")) menuNivel(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("menuNivel").hidden) { menuNivel(false); $("btnNivel").focus(); } });
pintarNivel();

/* ── Eventos ── */
$("form").addEventListener("submit", e => { e.preventDefault(); if (enCurso) abortar?.abort(); else ejecutar({ texto: $("entrada").value }); });
$("entrada").addEventListener("input", function () { this.style.height = "auto"; this.style.height = Math.min(this.scrollHeight, 180) + "px"; estadoBoton(); });
$("entrada").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!enCurso) ejecutar({ texto: $("entrada").value }); } });
$("btnNew").onclick = () => { nueva(); cerrarMenu(); };
$("btnExp").innerHTML = I.exp; $("btnExp").onclick = exportar;
$("buscar").addEventListener("input", e => { filtro = e.target.value; pintarLista(); });
$("btnVolver").onclick = () => { window.location.href = "apps.html"; };
$("btnSalir").onclick = async () => {
    try { await fetch(SUPABASE_URL + "/rest/v1/rpc/cerrar_sesion", { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, "x-app-token": usuario.token || "" }, body: "{}" }); } catch { /* sin conexión: se cierra igual en el navegador */ }
    localStorage.removeItem("usuario"); window.location.href = "index.html";
};
const cerrarMenu = () => $("app").classList.remove("open");
$("btnMenu").onclick = () => $("app").classList.add("open");
$("overlay").onclick = cerrarMenu;
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    cerrarMenu(); $("lb").classList.remove("open");
    if (grab) terminarDictado(true);
    if ($("perfilModal").classList.contains("open") && !$("confirmModal").classList.contains("open")) $("perfilModal").classList.remove("open");
});

/* ── Tema (comparte la preferencia del dashboard) ── */
function aplicarTema() {
    const t = localStorage.getItem("alterna_tema") || "claro";
    const oscuro = t === "oscuro" || (t === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("dark", oscuro);
    $("btnTema").innerHTML = oscuro ? I.sun : I.moon;
    redibujarGraficas();
}
$("btnTema").onclick = () => {
    const oscuro = document.body.classList.contains("dark");
    localStorage.setItem("alterna_tema", oscuro ? "claro" : "oscuro"); aplicarTema();
};

/* ── Inicio ── */
// Acceso por aplicación (tabla aplicaciones / usuarios_aplicaciones)
async function tieneAcceso(clave) {
    try {
        const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/app_tiene_acceso", {
            method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, "x-app-token": usuario.token || "" },
            body: JSON.stringify({ p_clave: clave })
        });
        return r.ok && (await r.json()) === true;
    } catch { return true; /* sin conexión: el servidor de la IA vuelve a validar */ }
}

(async function init() {
    if (!(await tieneAcceso("ia"))) { window.location.replace("apps.html"); return; }
    aplicarTema();
    $("meAv").innerHTML = avatarHtml;$("meNm").textContent = usuario.nombre || usuario.correo; $("meRl").textContent = usuario.rol || "";
    if (usuario.rol === "admin") { $("btnAdmin").style.display = ""; $("btnAdmin").onclick = abrirAdmin; }
    $("btnPerfil").innerHTML = `${I.yo} Personalizar`; $("btnPerfil").onclick = () => { abrirPerfil(); cerrarMenu(); };
    if (puedeGrabar) { $("btnMic").hidden = false; pintarMic("listo"); $("btnMic").onclick = iniciarDictado; $("grabX").onclick = () => terminarDictado(true); }
    pintarAdjuntos(); estadoBoton(); inicio(); pintarLista(); cargarCuota();
    const preguntaInicial = new URLSearchParams(location.search).get("q");
    if (preguntaInicial) { history.replaceState(null, "", location.pathname + location.hash); setTimeout(() => ejecutar({ texto: preguntaInicial.slice(0, 2000) }), 300); }
    try {
        convs = (await api("listar")).conversaciones; pintarLista();
        const id = location.hash.slice(1);
        if (id && convs.some(c => c.id === id)) abrir(id);
    } catch (e) { if (e.message !== "Sesión no válida") toast(e.message); }
})();

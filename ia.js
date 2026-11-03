/* ═══════════════════════════════════════════
   ALTERNA IA — página de chat
   Sesión: reutiliza el login del sistema (localStorage "usuario").
   Backend: Edge Function "alterna-ai" (historial, streaming, imágenes, visión).
═══════════════════════════════════════════ */
const SUPABASE_URL = "https://nxbncqixxlmdvepapuqe.supabase.co";
const SUPABASE_KEY = "sb_publishable_2nsr-fPUd1FJYLyWJf_UiQ_N7kaYKFv";
const ENDPOINT = SUPABASE_URL + "/functions/v1/alterna-ai";
const MARCA_IMAGEN = "⟦imagen⟧";
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
    shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>', 16),
};

const SUGERENCIAS = [
    { i: I.mail,  t: "Redactar un correo",     d: "Comunicados y respuestas listos para enviar.", p: "Ayúdame a redactar un correo profesional. Primero pregúntame a quién va dirigido y qué necesito comunicar." },
    { i: I.pdf,   t: "Resumir un texto",       d: "Puntos clave y próximos pasos.",               p: "Voy a pegarte un texto. Resúmelo en puntos clave y dime qué acciones o pendientes se desprenden de él." },
    { i: I.edit,  t: "Corregir un texto",      d: "Ortografía, tono y claridad.",                 p: "Voy a pegarte un texto. Corrige ortografía y redacción, mejora la claridad y dime qué cambiaste." },
    { i: I.cal,   t: "Preparar una reunión",   d: "Agenda, puntos clave y minuta.",               p: "Ayúdame a preparar una reunión: propón una agenda clara y una plantilla de minuta para anotar acuerdos, responsables y fechas." },
    { i: I.chart, t: "Armar un reporte",       d: "Con tablas; descárgalo en PDF o Excel.",       p: "Ayúdame a armar un reporte con tablas a partir de unos datos que te voy a pegar. Pregúntame primero qué quiero mostrar." },
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

function md(src) {
    // Mensajes antiguos pueden traer la marca ⟦fuentes:…⟧ de la base de conocimiento (ya retirada): se oculta
    src = src.replace(/\n*⟦fuentes:[0-9a-f,-]*⟧?/g, "");
    return mdSinFuentes(src);
}

function mdSinFuentes(src) {
    const partes = src.split(/\u27E6accion:([0-9a-f-]{36})\u27E7/);
    return partes.map((p, i) => i % 2 === 0 ? (p.trim() ? mdTexto(p) : "") : `<div class="acc" data-acc="${p}"><div class="acc-load">Preparando acción…</div></div>`).join("");
}

function mdTexto(src) {
    // La marca ⟦imagen⟧ solo se muestra como "generando…" mientras es lo último que llegó.
    const generando = src.trimEnd().endsWith(MARCA_IMAGEN);
    src = src.split(MARCA_IMAGEN).join("");
    const partes = src.split("```"); let out = "";
    partes.forEach((seg, k) => {
        if (k % 2 === 0) { out += bloques(seg); return; }
        const nl = seg.indexOf("\n");
        const lang = (nl >= 0 ? seg.slice(0, nl) : "").trim().slice(0, 20);
        const code = nl >= 0 ? seg.slice(nl + 1).replace(/\n$/, "") : seg;
        out += `<pre><div class="ph"><span>${esc(lang || "código")}</span><button type="button" data-copy>${I.copy} Copiar</button></div><code>${esc(code)}</code></pre>`;
    });
    if (generando) out += '<div class="imgload"><span class="shimmer"></span><span class="il-t">Generando imagen… puede tardar unos segundos</span></div>';
    return out;
}

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
        `<div class="hero"><div class="logo con-img"><img src="img/logo-ia.webp" alt=""></div>` +
        `<h1>${s.titulo}</h1>` +
        `<p>${s.sub}</p>` +
        `<div class="cards">` + SUGERENCIAS.map((s, k) => `<button class="card" data-k="${k}"><span class="ci">${s.i}</span><span><div class="ct">${s.t}</div><div class="cd">${s.d}</div></span></button>`).join("") + `</div></div>`;
}

$("vista").addEventListener("click", e => {
    const card = e.target.closest(".card"); if (card) return ejecutar({ texto: SUGERENCIAS[card.dataset.k].p });
    const cp = e.target.closest("[data-copy]"); if (cp) return copiar(cp.closest("pre").querySelector("code").textContent);
    const ct = e.target.closest("[data-copymsg]"); if (ct) return copiar(sinImagenes(ct.closest(".msg").dataset.raw || ""));
    const rg = e.target.closest("[data-regen]"); if (rg) return regenerar();
    const ok = e.target.closest("[data-acc-ok]"); if (ok) return resolverAccion(ok.closest(".acc").dataset.acc, true);
    const no = e.target.closest("[data-acc-no]"); if (no) return resolverAccion(no.closest(".acc").dataset.acc, false);
    const pf = e.target.closest("[data-pdf]"); if (pf) return descargarPDF(pf.closest(".msg").dataset.raw || "");
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

function nodoUsuario(contenido, previews) {
    const urls = previews || [...contenido.matchAll(IMG_MD)].map(m => m[2]);
    const texto = previews ? contenido : sinImagenes(contenido);
    const d = document.createElement("div"); d.className = "msg user";
    d.innerHTML = `<div class="av">${avatarHtml}</div><div class="body"><div class="bubble">` +
        (urls.length ? `<div class="thumbs">${urls.map(u => `<img src="${u}" alt="Imagen adjunta">`).join("")}</div>` : "") +
        (texto ? `<div>${esc(texto)}</div>` : "") + `</div></div>`;
    return d;
}

function nodoAsistente(texto) {
    const d = document.createElement("div"); d.className = "msg assistant"; d.dataset.raw = texto;
    d.innerHTML = `<div class="av con-img"><img src="img/logo-ia.webp" alt=""></div><div class="body"><div class="who">Alterna IA</div><div class="md">${md(texto)}</div>` +
                  `<div class="tools"><button type="button" data-copymsg>${I.copy} Copiar</button>${botonesReporte(texto)}</div></div>`;
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
    mensajes.forEach(m => col.appendChild(m.rol === "user" ? nodoUsuario(m.contenido) : nodoAsistente(m.contenido)));
    marcarUltimo(); hidratarAcciones(); bajar(true);
}

function bajar(forzar) {
    const s = $("scroll");
    if (forzar || s.scrollHeight - s.scrollTop - s.clientHeight < 140) s.scrollTop = s.scrollHeight;
}

function nueva() {
    if (enCurso) abortar?.abort();
    actual = null; mensajes = []; adjuntos = []; pintarAdjuntos(); history.replaceState(null, "", location.pathname);
    $("titulo").textContent = "Nueva conversación"; pintarLista(); pintarConversacion(); $("entrada").focus();
}

async function abrir(id) {
    if (id === actual) return;
    if (enCurso) abortar?.abort();
    actual = id; mensajes = []; history.replaceState(null, "", "#" + id);
    const c = convs.find(x => x.id === id); $("titulo").textContent = c ? c.titulo : "Conversación";
    pintarLista(); $("vista").innerHTML = '<div class="col"><div class="dots"><i></i><i></i><i></i></div></div>';
    try {
        const d = await api("abrir", { id }); if (actual !== id) return;
        mensajes = d.mensajes.map(m => ({ rol: m.rol, contenido: m.contenido })); pintarConversacion();
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
async function agregarArchivos(files) {
    for (const f of [...files]) {
        if (adjuntos.length >= MAX_ADJ) { toast(`Máximo ${MAX_ADJ} imágenes por mensaje.`); break; }
        try { adjuntos.push(await leerImagen(f)); } catch (e) { toast(e.message); }
    }
    pintarAdjuntos(); estadoBoton(); $("entrada").focus();
}
function pintarAdjuntos() {
    $("adjs").innerHTML = adjuntos.map((a, i) => `<div class="adj"><img src="${a.preview}" alt="Adjunto ${i + 1}"><button type="button" data-rm="${i}" aria-label="Quitar">${I.x}</button></div>`).join("");
    $("adjs").style.display = adjuntos.length ? "flex" : "none";
}
$("adjs").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) { adjuntos.splice(+b.dataset.rm, 1); pintarAdjuntos(); estadoBoton(); } });
$("btnAdj").innerHTML = I.clip;
$("btnAdj").onclick = () => $("fileAdj").click();
$("fileAdj").addEventListener("change", e => { agregarArchivos(e.target.files); e.target.value = ""; });
$("entrada").addEventListener("paste", e => {
    const fs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith("image/"));
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
    b.disabled = !enCurso && !$("entrada").value.trim() && !adjuntos.length;
}

async function ejecutar({ texto = "", regen = false }) {
    if (enCurso) return;
    texto = texto.trim();
    const adj = regen ? [] : adjuntos.slice();
    if (!regen && !texto && !adj.length) return;

    if (!regen && !mensajes.length) $("vista").innerHTML = '<div class="col" id="col"></div>';
    const col = $("col");
    if (!regen) {
        col.appendChild(nodoUsuario(texto, adj.length ? adj.map(a => a.preview) : null));
        mensajes.push({ rol: "user", contenido: texto });
        $("entrada").value = ""; $("entrada").style.height = "auto"; adjuntos = []; pintarAdjuntos();
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
            body: JSON.stringify({ accion: "chat", ...credenciales(), conversacion_id: actual, mensaje: texto, regenerar: regen, adjuntos: adj.map(({ mime, base64 }) => ({ mime, base64 })) })
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
            cuerpo.innerHTML = md(acumulado); if (!acumulado.trimEnd().endsWith(MARCA_IMAGEN)) cuerpo.classList.add("cursor"); else cuerpo.classList.remove("cursor"); bajar();
        }
        if (!acumulado.replace(MARCA_IMAGEN, "").trim()) throw new Error("La IA no devolvió respuesta. Intenta de nuevo.");
    } catch (e) {
        if (e.name !== "AbortError") {
            if (!acumulado) { cuerpo.innerHTML = `<div class="err">${esc(e.message)}</div>`; tools.remove(); }
            else toast("Se interrumpió la respuesta");
        }
    } finally {
        cuerpo.classList.remove("cursor");
        const final = acumulado.split(MARCA_IMAGEN).join("");
        if (final.trim()) {
            nodo.dataset.raw = final; cuerpo.innerHTML = md(final); tools.insertAdjacentHTML("beforeend", botonesReporte(final)); tools.style.display = "";
            mensajes.push({ rol: "assistant", contenido: final });
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

/* ── Reportes: PDF y Excel (se generan en el navegador) ── */
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
const botonesReporte = raw => (raw && raw.length > 120 ? `<button type="button" data-pdf>${I.pdf} PDF</button>` : "") + (tablasMd(raw || "").length ? `<button type="button" data-xls>${I.xls} Excel</button>` : "");
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

async function descargarPDF(raw) {
    try {
        await cargarScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
        await cargarScript("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js");
        const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" });
        const W = 210, M = 16, AN = W - M * 2;
        const ok = t => limpiarMd(t).replace(/[^\u0000-ÿ–—‘-”•…]/g, "");
        let y = 34;
        const espacio = h => { if (y + h > 280) { doc.addPage(); y = 20; } };

        doc.setFillColor(28, 28, 30); doc.rect(0, 0, W, 24, "F");
        doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Alterna IA", M, 14);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(new Date().toLocaleString("es", { dateStyle: "long", timeStyle: "short" }), W - M, 14, { align: "right" });
        doc.setTextColor(30); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(ok($("titulo").textContent || "Reporte"), M, y); y += 9;

        const L = raw.replace(/⟦[^⟧]*⟧/g, "").split("\n"); let i = 0;
        while (i < L.length) {
            const l = L[i];
            if (!l.trim()) { i++; continue; }
            let m;
            if (/\|/.test(l) && SEP_TABLA.test(L[i + 1] || "")) {
                const head = celdasMd(l).map(ok); i += 2; const body = [];
                while (i < L.length && /\|/.test(L[i]) && L[i].trim()) body.push(celdasMd(L[i++]).map(ok));
                espacio(20);
                doc.autoTable({ head: [head], body, startY: y, margin: { left: M, right: M }, styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: [58, 58, 60] }, alternateRowStyles: { fillColor: [245, 246, 248] } });
                y = doc.lastAutoTable.finalY + 6; continue;
            }
            if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
                espacio(12); doc.setFont("helvetica", "bold"); doc.setFontSize(m[1].length === 1 ? 14 : 12); doc.setTextColor(30); y += 2;
                doc.text(doc.splitTextToSize(ok(m[2]), AN), M, y); y += m[1].length === 1 ? 8 : 6.5; i++; continue;
            }
            const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(50);
            const lineas = doc.splitTextToSize((li ? "•  " : "") + ok(li ? li[1] : l), AN - (li ? 4 : 0));
            espacio(lineas.length * 5 + 2); doc.text(lineas, M + (li ? 4 : 0), y); y += lineas.length * 5 + (li ? 1.2 : 2.5); i++;
        }
        const n = doc.internal.getNumberOfPages();
        for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFontSize(8); doc.setTextColor(140); doc.text("Alterna IA", M, 289); doc.text("Página " + p + " de " + n, W - M, 289, { align: "right" }); }
        doc.save(nombreArchivo("pdf")); toast("PDF descargado");
    } catch (e) { toast(e.message || "No se pudo generar el PDF."); }
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

function pintarCuotas(cont) {
    const q = adFiltro.trim().toLowerCase();
    const us = adDatos.usuarios.filter(u => !q || (u.nombre + " " + u.correo).toLowerCase().includes(q));
    const n = k => adDatos.usuarios.filter(u => k(u.cuota || {})).length;
    cont.innerHTML =
        `<div class="ad-stats"><div><b>${adDatos.usuarios.length}</b><span>Usuarios</span></div><div><b>${n(c => c.ilimitado)}</b><span>Ilimitados</span></div><div><b>${n(c => !c.ilimitado && c.tokens_restantes === 0)}</b><span>En su límite</span></div><div><b>${n(c => c.bloqueado)}</b><span>Pausados</span></div></div>` +
        `<div class="ad-bar-top"><input type="search" id="adBuscar" placeholder="Buscar usuario" value="${esc(adFiltro)}" autocomplete="off"></div>` +
        `<div class="tw"><table><thead><tr><th>Usuario</th><th>Plan</th><th>Consumo del periodo</th><th>Imágenes</th><th>Se restablece</th><th>Estado</th><th></th></tr></thead><tbody>` +
        (us.map(u => { const c = u.cuota; return `<tr><td>${esc(u.nombre || "—")}<br><small>${esc(u.correo || "")}</small></td>` +
            `<td>${esc(c?.plan_nombre || "—")}${c?.personalizado ? ' <small title="Tiene ajustes propios">· personalizado</small>' : ""}</td>` +
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
            (h.uso.length ? `<div class="tw"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Modelo</th><th>Entrada</th><th>Salida</th></tr></thead><tbody>${h.uso.map(x => `<tr><td>${fecha(x.created_at)}</td><td>${x.tipo === "imagen" ? "Imagen" : "Mensaje"}</td><td>${esc(x.modelo || "—")}</td><td>${x.tipo === "imagen" ? "—" : (x.tokens_entrada ?? 0).toLocaleString("es")}</td><td>${x.tipo === "imagen" ? "—" : (x.tokens_salida ?? 0).toLocaleString("es")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="ad-nota">Aún no ha usado la IA.</p>`);
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
document.addEventListener("keydown", e => { if (e.key === "Escape") { cerrarMenu(); $("lb").classList.remove("open"); } });

/* ── Tema (comparte la preferencia del dashboard) ── */
function aplicarTema() {
    const t = localStorage.getItem("alterna_tema") || "claro";
    const oscuro = t === "oscuro" || (t === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("dark", oscuro);
    $("btnTema").innerHTML = oscuro ? I.sun : I.moon;
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
    pintarAdjuntos(); estadoBoton(); inicio(); pintarLista(); cargarCuota();
    const preguntaInicial = new URLSearchParams(location.search).get("q");
    if (preguntaInicial) { history.replaceState(null, "", location.pathname + location.hash); setTimeout(() => ejecutar({ texto: preguntaInicial.slice(0, 2000) }), 300); }
    try {
        convs = (await api("listar")).conversaciones; pintarLista();
        const id = location.hash.slice(1);
        if (id && convs.some(c => c.id === id)) abrir(id);
    } catch (e) { if (e.message !== "Sesión no válida") toast(e.message); }
})();

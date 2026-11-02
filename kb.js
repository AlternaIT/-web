/* ═══════════════════════════════════════════
   BASE DE CONOCIMIENTO — visor web
   Lee el espejo en la nube de la bóveda de Obsidian (solo lectura).
   Para agregar, editar o quitar artículos: hazlo en Obsidian y sincroniza.
═══════════════════════════════════════════ */
const SUPABASE_URL = "https://nxbncqixxlmdvepapuqe.supabase.co";
const SUPABASE_KEY = "sb_publishable_2nsr-fPUd1FJYLyWJf_UiQ_N7kaYKFv";
const ENDPOINT = SUPABASE_URL + "/functions/v1/alterna-ai";

let usuario = null;
try { usuario = JSON.parse(localStorage.getItem("usuario")); } catch { /* sin sesión */ }
if (!usuario?.id || !usuario?.token) { localStorage.removeItem("usuario"); window.location.replace("index.html"); throw new Error("Sin sesión"); }

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const svg = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICO = {
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>'),
    book: svg('<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14zM20 17v4H6.5A2.5 2.5 0 014 18.5"/>', 26),
    lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>', 12),
    spark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z"/></svg>',
};
function toast(t) { const e = $("toast"); e.textContent = t; e.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("show"), 2200); }

async function api(accion, extra = {}) {
    const r = await fetch(ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ accion, usuario_id: usuario.id, correo: usuario.correo, token: usuario.token, ...extra })
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { localStorage.removeItem("usuario"); window.location.replace("index.html"); throw new Error("Sesión no válida"); }
    if (!r.ok) throw new Error(d.error || "No fue posible conectar.");
    return d;
}

/* ── Markdown de Obsidian (seguro: todo se escapa antes de dar formato) ── */
let porTitulo = new Map(), porRuta = new Map();
const resolverEnlace = t => { const k = t.toLowerCase(); return porRuta.get(k) || porTitulo.get(k.split("/").pop()); };
function inline(s) {
    const codes = [];
    s = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = s.replace(/!\[\[[^\]]*\]\]/g, "")                                                     // incrustaciones de Obsidian
         .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t, alias) => `<a href="#" class="wl" data-wl="${t.trim()}">${alias || t.trim().split("/").pop()}</a>`)
         .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/==(.+?)==/g, "<mark>$1</mark>")
         .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
         .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
         .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => "<code>" + codes[i] + "</code>");
}
const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
function bloques(texto) {
    const L = texto.split("\n"); let out = "", i = 0;
    const tabla = k => /\|/.test(L[k] || "") && SEP.test(L[k + 1] || "");
    const celdas = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    while (i < L.length) {
        const l = L[i]; if (!l.trim()) { i++; continue; }
        let m;
        if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out += `<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`; i++; continue; }
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out += "<hr>"; i++; continue; }
        if (tabla(i)) {
            const cab = celdas(l); i += 2; let filas = "";
            while (i < L.length && /\|/.test(L[i]) && L[i].trim()) { filas += "<tr>" + celdas(L[i]).map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>"; i++; }
            out += '<div class="tw"><table><thead><tr>' + cab.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" + filas + "</tbody></table></div>"; continue;
        }
        if (/^>\s?/.test(l)) { const q = []; while (i < L.length && /^>\s?/.test(L[i])) q.push(L[i++].replace(/^>\s?/, "").replace(/^\[![^\]]*\][+-]?\s*/, "")); out += "<blockquote>" + inline(q.join(" ")) + "</blockquote>"; continue; }
        if (/^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
            const ord = /^\s*\d+[.)]\s+/.test(l); let items = "";
            while (i < L.length && (ord ? /^\s*\d+[.)]\s+/.test(L[i]) : /^\s*[-*•]\s+/.test(L[i]))) {
                let t = L[i].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""), cls = "";
                if (/^\[[ xX]\]\s/.test(t)) { cls = ' class="chk"'; t = (/^\[[xX]\]/.test(t) ? "☑ " : "☐ ") + t.slice(4); }
                items += `<li${cls}>` + inline(t) + "</li>"; i++;
            }
            out += (ord ? "<ol>" : "<ul>") + items + (ord ? "</ol>" : "</ul>"); continue;
        }
        const p = [];
        while (i < L.length && L[i].trim() && !/^(#{1,4}\s|>\s?|\s*[-*•]\s+|\s*\d+[.)]\s+)/.test(L[i]) && !tabla(i)) p.push(L[i++]);
        out += "<p>" + inline(p.join("\n")).replace(/\n/g, "<br>") + "</p>";
    }
    return out;
}
function md(src) {
    src = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    return src.split("```").map((seg, k) => {
        if (k % 2 === 0) return bloques(seg);
        const nl = seg.indexOf("\n"), code = nl >= 0 ? seg.slice(nl + 1).replace(/\n$/, "") : seg;
        return `<pre><code>${esc(code)}</code></pre>`;
    }).join("");
}

/* ── Estado ── */
let notas = [], actual = null, abiertas = new Set();
const cat = n => n.categoria || (n.audiencia === "Solo TI" ? "Interno (TI)" : "General");
const nombre1 = (usuario.nombre || "").trim().split(/\s+/)[0] || "";

/* ── Árbol lateral ── */
function pintarArbol(filtro = "") {
    const q = filtro.trim().toLowerCase();
    const lista = notas.filter(n => !q || n.titulo.toLowerCase().includes(q) || cat(n).toLowerCase().includes(q));
    if (!lista.length) { $("arbol").innerHTML = `<div class="empty-list">${q ? "Sin coincidencias.<br>Pulsa Enter para búsqueda inteligente." : "Aún no hay artículos."}</div>`; return; }
    const grupos = new Map();
    lista.forEach(n => { const c = cat(n); (grupos.get(c) ?? grupos.set(c, []).get(c)).push(n); });
    $("arbol").innerHTML = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([c, ns]) => {
        const abierto = q || abiertas.has(c) || ns.some(n => n.id === actual);
        return `<div class="grp cat" data-cat="${esc(c)}"><span>${esc(c)}</span><i>${abierto ? "▾" : "▸"} ${ns.length}</i></div>` +
            (abierto ? ns.map(n => `<div class="conv sub${n.id === actual ? " act" : ""}" data-id="${n.id}"><span class="t">${esc(n.titulo)}</span></div>`).join("") : "");
    }).join("");
}
$("arbol").addEventListener("click", e => {
    const g = e.target.closest(".cat"); if (g) { const c = g.dataset.cat; abiertas.has(c) ? abiertas.delete(c) : abiertas.add(c); return pintarArbol($("buscar").value); }
    const f = e.target.closest(".conv"); if (f) { abrir(f.dataset.id); cerrarMenu(); }
});

/* ── Vistas ── */
function inicio() {
    actual = null; history.replaceState(null, "", location.pathname); $("titulo").textContent = "Base de conocimiento"; pintarArbol($("buscar").value);
    const grupos = new Map(); notas.forEach(n => grupos.set(cat(n), (grupos.get(cat(n)) ?? 0) + 1));
    const recientes = [...notas].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 5);
    $("vista").innerHTML = `<div class="kb-wrap"><div class="kb-hero"><div class="logo">${ICO.book}</div>` +
        `<h1>${nombre1 ? "Hola, " + esc(nombre1) + ". " : ""}¿Qué necesitas saber?</h1>` +
        `<p>Guías y procedimientos de Alterna, siempre actualizados. Busca por tema o pregúntale a Alterna IA.</p>` +
        `<form class="kb-search" id="formBuscar"><input id="qGrande" placeholder="Ej.: programar un correo, firmar un documento…" autocomplete="off"><button>Buscar</button></form></div>` +
        (notas.length ? `<div class="kb-cats">${[...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([c, n]) => `<button class="kb-cat" data-cat="${esc(c)}"><b>${esc(c)}</b><span>${n} artículo${n === 1 ? "" : "s"}</span></button>`).join("")}</div>` +
            `<div class="kb-h">Actualizados recientemente</div>${recientes.map(itemNota).join("")}`
            : `<div class="kb-vacio">Todavía no hay artículos publicados en la nube.<br>${usuario.rol === "admin" ? "Sincroniza tu bóveda de Obsidian con <b>sync.cmd</b>." : "Vuelve más tarde."}</div>`) +
        `</div>`;
    $("formBuscar").onsubmit = e => { e.preventDefault(); buscarInteligente($("qGrande").value); };
}
const fecha = f => f ? new Date(f).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "";
const itemNota = (n, snippet) => `<button class="kb-item" data-id="${n.id}"><div class="t">${esc(n.titulo)}</div><div class="m">${esc(cat(n))}${n.estado && !/^publicad/i.test(n.estado) ? " · " + esc(n.estado) : ""}${n.audiencia === "Solo TI" ? " · Solo TI" : ""}</div>${snippet ? `<div class="s">${esc(snippet)}</div>` : ""}</button>`;

$("vista").addEventListener("click", e => {
    const wl = e.target.closest("[data-wl]"); if (wl) { e.preventDefault(); const n = resolverEnlace(wl.dataset.wl); return n ? abrir(n.id) : toast("Esa nota no está disponible (puede ser privada)."); }
    const it = e.target.closest(".kb-item"); if (it) return abrir(it.dataset.id);
    const c = e.target.closest(".kb-cat"); if (c) { abiertas.add(c.dataset.cat); pintarArbol(); $("arbol").scrollTop = 0; return mostrarCategoria(c.dataset.cat); }
    const ia = e.target.closest("[data-ia]"); if (ia) return (window.location.href = "ia.html?q=" + encodeURIComponent(ia.dataset.ia));
    if (e.target.closest("[data-inicio]")) return inicio();
});

function mostrarCategoria(c) {
    actual = null; $("titulo").textContent = c;
    $("vista").innerHTML = `<div class="kb-wrap"><div class="kb-h" style="margin-top:0">${esc(c)}</div>${notas.filter(n => cat(n) === c).map(n => itemNota(n)).join("")}<div class="kb-actions"><button data-inicio>← Volver al inicio</button></div></div>`;
}

async function buscarInteligente(q) {
    q = (q || "").trim(); if (!q) return;
    $("titulo").textContent = "Resultados"; $("vista").innerHTML = '<div class="kb-wrap"><div class="dots"><i></i><i></i><i></i></div></div>';
    try {
        const { resultados } = await api("kb_buscar", { q });
        const vistos = new Map();
        for (const r of resultados) if (!vistos.has(r.nota_id)) vistos.set(r.nota_id, r);
        const filas = [...vistos.values()].map(r => { const n = notas.find(x => x.id === r.nota_id); return n ? itemNota(n, r.texto.replace(/^[^\n]*\n/, "").replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").slice(0, 170) + "…") : ""; }).join("");
        $("vista").innerHTML = `<div class="kb-wrap"><div class="kb-h" style="margin-top:0">Resultados para «${esc(q)}»</div>` +
            (filas || `<div class="kb-vacio">No encontré artículos sobre eso.<br>Prueba con otras palabras o pregúntale a Alterna IA.</div>`) +
            `<div class="kb-actions"><button class="pri" data-ia="${esc(q)}">${ICO.spark} Preguntar a Alterna IA</button><button data-inicio>← Inicio</button></div></div>`;
    } catch (e) { $("vista").innerHTML = `<div class="kb-wrap"><div class="err">${esc(e.message)}</div></div>`; }
}

async function abrir(id) {
    actual = id; history.replaceState(null, "", "#" + id); pintarArbol($("buscar").value);
    $("vista").innerHTML = '<div class="kb-wrap"><div class="dots"><i></i><i></i><i></i></div></div>';
    try {
        const { nota } = await api("kb_leer", { id }); if (actual !== id) return;
        $("titulo").textContent = nota.titulo;
        const est = nota.estado ? (/^publicad/i.test(nota.estado) ? `<span class="kb-b ok">✓ ${esc(nota.estado)}</span>` : `<span class="kb-b warn">⚠ ${esc(nota.estado)}</span>`) : "";
        $("vista").innerHTML = `<div class="kb-wrap kb-art"><h1 class="kb-title">${esc(nota.titulo)}</h1><div class="kb-badges">${est}` +
            `<span class="kb-b">${esc(cat(nota))}</span>${nota.audiencia === "Solo TI" ? `<span class="kb-b ti">${ICO.lock} Solo TI</span>` : ""}<span class="kb-b">Actualizado ${fecha(nota.updated_at)}</span></div>` +
            `<div class="md">${md(nota.contenido)}</div>` +
            `<div class="kb-actions"><button class="pri" data-ia="${esc("Ayúdame con este artículo: " + nota.titulo)}">${ICO.spark} Preguntar a Alterna IA sobre esto</button><button data-inicio>← Todas las guías</button></div>` +
            `<div class="kb-nota">Este contenido se edita en Obsidian y se sincroniza con la nube.</div></div>`;
        $("scroll").scrollTop = 0;
    } catch (e) { $("vista").innerHTML = `<div class="kb-wrap"><div class="err">${esc(e.message)}</div></div>`; }
}

/* ── Eventos y tema ── */
$("buscar").addEventListener("input", e => pintarArbol(e.target.value));
$("buscar").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); buscarInteligente($("buscar").value); cerrarMenu(); } });
$("btnInicio").onclick = () => { $("buscar").value = ""; inicio(); cerrarMenu(); };
$("btnIA").onclick = () => { window.location.href = "ia.html"; };
$("btnVolver").onclick = () => { window.location.href = "dashboard.html"; };
const cerrarMenu = () => $("app").classList.remove("open");
$("btnMenu").onclick = () => $("app").classList.add("open");
$("overlay").onclick = cerrarMenu;
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarMenu(); });
function aplicarTema() {
    const t = localStorage.getItem("alterna_tema") || "claro";
    const oscuro = t === "oscuro" || (t === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("dark", oscuro); $("btnTema").innerHTML = oscuro ? ICO.sun : ICO.moon;
}
$("btnTema").onclick = () => { localStorage.setItem("alterna_tema", document.body.classList.contains("dark") ? "claro" : "oscuro"); aplicarTema(); };

(async function init() {
    aplicarTema();
    const ini = (usuario.nombre || "?").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    $("meAv").textContent = ini; $("meNm").textContent = usuario.nombre || usuario.correo; $("meRl").textContent = usuario.rol || "";
    $("vista").innerHTML = '<div class="kb-wrap"><div class="dots"><i></i><i></i><i></i></div></div>';
    try {
        notas = (await api("kb_listar")).notas;
        porTitulo = new Map(notas.map(n => [n.titulo.toLowerCase(), n]));
        porRuta = new Map(notas.map(n => [n.ruta.replace(/.md$/i, "").toLowerCase(), n]));
        const ult = notas.reduce((m, n) => (String(n.updated_at) > m ? String(n.updated_at) : m), "");
        $("badgeSync").textContent = notas.length + " artículos" + (ult ? " · sync " + fecha(ult) : "");
        const id = location.hash.slice(1);
        if (id && notas.some(n => n.id === id)) abrir(id); else inicio();
    } catch (e) { $("vista").innerHTML = `<div class="kb-wrap"><div class="err">${esc(e.message)}</div></div>`; }
})();

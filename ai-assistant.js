/* Alterna IA — mini chat compacto: el botón flotante abre una ventanita de chat sobre la página.
   Usa el mismo backend que ia.html (Edge Function "alterna-ai"); la conversación queda guardada
   y se puede continuar en la página completa. */
(async function () {
    const SUPABASE_URL = "https://nxbncqixxlmdvepapuqe.supabase.co";
    const SUPABASE_KEY = "sb_publishable_2nsr-fPUd1FJYLyWJf_UiQ_N7kaYKFv";
    const ENDPOINT = SUPABASE_URL + "/functions/v1/alterna-ai";
    const CLAVE = "aai_mini"; // conversación del mini chat en esta pestaña

    let usuario = null;
    try { usuario = JSON.parse(localStorage.getItem("usuario")); } catch { /* sin sesión */ }
    if (!usuario?.id) return;

    // Sin acceso a la aplicación de IA (tabla usuarios_aplicaciones) no se muestra el botón
    try {
        const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/app_tiene_acceso", {
            method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, "x-app-token": usuario.token || "" },
            body: JSON.stringify({ p_clave: "ia" })
        });
        if (!r.ok || (await r.json()) !== true) return;
    } catch { return; }

    const ICONO = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zm7 11l.9 2.6L22.5 16.5l-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13zM5 14l.7 2 2 .7-2 .7L5 19.5l-.7-2.1-2-.7 2-.7L5 14z"/></svg>';
    const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const I = {
        cerrar: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
        nueva:  svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
        abrir:  svg('<path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>'),
        enviar: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
        parar:  '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
    };
    const SUGERENCIAS = [
        "Ayúdame a redactar un correo",
        "Resume un texto que te voy a pegar",
        "Ayúdame a preparar una reunión",
    ];

    /* ── Estructura ── */
    const fab = document.createElement("button");
    fab.type = "button"; fab.className = "aai-fab"; fab.title = "Alterna IA";
    fab.setAttribute("aria-label", "Abrir Alterna IA"); fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = `<span class="aai-ic-abrir">${ICONO}</span><span class="aai-ic-cerrar">${I.cerrar}</span>`;

    const caja = document.createElement("section");
    caja.className = "aai-chat"; caja.setAttribute("aria-label", "Alterna IA"); caja.hidden = true;
    caja.innerHTML = `
        <header class="aai-head">
            <span class="aai-logo">${ICONO}</span>
            <div class="aai-titulo"><b>Alterna IA</b><small>Tu asistente para el día a día</small></div>
            <button type="button" class="aai-btn" data-nueva title="Nueva conversación" aria-label="Nueva conversación">${I.nueva}</button>
            <a class="aai-btn" data-completa href="ia.html" title="Abrir en Alterna IA" aria-label="Abrir en Alterna IA">${I.abrir}</a>
            <button type="button" class="aai-btn" data-cerrar title="Cerrar" aria-label="Cerrar">${I.cerrar}</button>
        </header>
        <div class="aai-msgs" aria-live="polite"></div>
        <form class="aai-form">
            <textarea rows="1" maxlength="4000" placeholder="Escribe tu pregunta…" aria-label="Mensaje para Alterna IA"></textarea>
            <button type="submit" class="aai-send" title="Enviar" aria-label="Enviar" disabled>${I.enviar}</button>
        </form>`;
    document.body.append(caja, fab);

    const $ = s => caja.querySelector(s);
    const msgs = $(".aai-msgs"), entrada = $("textarea"), btnEnviar = $(".aai-send"), linkCompleta = $("[data-completa]");

    /* ── Estado (sobrevive a cambiar de página dentro de la pestaña) ── */
    let estado = { id: null, mensajes: [] };
    try { estado = JSON.parse(sessionStorage.getItem(CLAVE)) || estado; } catch { /* nuevo */ }
    const guardar = () => { try { sessionStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin almacenamiento */ } };
    let abortar = null;

    /* ── Texto con formato básico ── */
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    function inline(s) {
        return esc(s)
            .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener"><img src="$2" alt="$1" loading="lazy"></a>')
            .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    }
    function formato(texto, enCurso) {
        let t = texto.replace(/⟦fuentes:[^⟧]*⟧?/g, "");
        // Acciones e imágenes se gestionan mejor en la página completa
        const accion = /⟦accion:[0-9a-f-]{36}⟧/.test(t);
        const marca = enCurso && (t.match(/⟦(imagen|buscando|ejecutando)⟧\s*$/) || [])[1];
        const generando = marca && { imagen: "Generando imagen…", buscando: "Buscando en internet…", ejecutando: "Ejecutando código…" }[marca];
        t = t.replace(/⟦[^⟧]*⟧?/g, "").trim();

        let html = "", lista = null;
        const cerrarLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
        const L = t.split("\n");
        for (let i = 0; i < L.length; i++) {
            const l = L[i];
            if (/^```/.test(l)) {
                cerrarLista(); const code = [];
                while (++i < L.length && !/^```/.test(L[i])) code.push(L[i]);
                html += `<pre><code>${esc(code.join("\n"))}</code></pre>`; continue;
            }
            if (/^\s*\|.*\|\s*$/.test(l)) {
                cerrarLista(); const filas = [];
                for (; i < L.length && /^\s*\|.*\|\s*$/.test(L[i]); i++) if (!/^\s*\|[\s:|-]+\|\s*$/.test(L[i])) filas.push(L[i].trim().slice(1, -1).split("|"));
                i--;
                // Cuadrícula en vez de <table>: el dashboard fuerza estilos de td con !important
                const cols = Math.max(...filas.map(f => f.length));
                html += `<div class="aai-tabla"><div class="aai-grid" style="--cols:${cols}">${filas.map((f, n) =>
                    f.map(c => `<div class="${n ? "" : "aai-th"}">${inline(c.trim())}</div>`).join("")).join("")}</div></div>`;
                continue;
            }
            const ul = l.match(/^\s*[-*•]\s+(.*)/), ol = l.match(/^\s*\d+[.)]\s+(.*)/);
            if (ul || ol) {
                const tipo = ul ? "ul" : "ol";
                if (lista !== tipo) { cerrarLista(); html += `<${tipo}>`; lista = tipo; }
                html += `<li>${inline((ul || ol)[1])}</li>`; continue;
            }
            cerrarLista();
            const h = l.match(/^#{1,4}\s+(.*)/);
            if (h) html += `<p class="aai-h">${inline(h[1])}</p>`;
            else if (l.trim()) html += `<p>${inline(l)}</p>`;
        }
        cerrarLista();
        if (generando) html += `<p class="aai-nota">${generando}</p>`;
        if (accion) html += `<a class="aai-accion" data-ver-completa href="ia.html">La IA propone un cambio que necesita tu confirmación. Revísalo en Alterna IA →</a>`;
        return html;
    }

    /* ── Pintado ── */
    function burbuja(rol, texto) {
        const d = document.createElement("div");
        d.className = "aai-msg aai-" + rol;
        if (rol === "user") d.textContent = texto; else d.innerHTML = formato(texto);
        msgs.appendChild(d); return d;
    }
    function bajar() { msgs.scrollTop = msgs.scrollHeight; }
    function pintar() {
        msgs.innerHTML = "";
        if (!estado.mensajes.length) {
            const nombre = (usuario.nombre || "").split(" ")[0];
            msgs.innerHTML = `<div class="aai-vacio"><p>Hola${nombre ? ", " + esc(nombre) : ""}. ¿En qué te ayudo?</p>
                ${SUGERENCIAS.map(s => `<button type="button" class="aai-sug">${esc(s)}</button>`).join("")}</div>`;
        } else estado.mensajes.forEach(m => burbuja(m.rol, m.contenido));
        linkCompleta.href = "ia.html" + (estado.id ? "#" + estado.id : "");
        bajar();
    }
    function botonEnviar() {
        btnEnviar.classList.toggle("aai-parar", !!abortar);
        btnEnviar.innerHTML = abortar ? I.parar : I.enviar;
        btnEnviar.title = abortar ? "Detener" : "Enviar";
        btnEnviar.disabled = !abortar && !entrada.value.trim();
    }

    /* ── Envío (respuesta en streaming) ── */
    async function enviar(texto) {
        texto = texto.trim();
        if (!texto || abortar) return;
        if (!estado.mensajes.length) msgs.innerHTML = "";
        estado.mensajes.push({ rol: "user", contenido: texto }); guardar();
        burbuja("user", texto);
        entrada.value = ""; ajustarAltura();

        const nodo = burbuja("assistant", "");
        nodo.innerHTML = '<span class="aai-dots"><i></i><i></i><i></i></span>'; bajar();
        abortar = new AbortController(); botonEnviar();
        let acumulado = "";
        try {
            const r = await fetch(ENDPOINT, {
                method: "POST", signal: abortar.signal,
                headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
                body: JSON.stringify({ accion: "chat", usuario_id: usuario.id, correo: usuario.correo, token: usuario.token, nivel: (() => { try { return localStorage.getItem("ia_nivel") || "medio"; } catch { return "medio"; } })(), conversacion_id: estado.id, mensaje: texto, regenerar: false, adjuntos: [] })
            });
            if (r.status === 401) { localStorage.removeItem("usuario"); window.location.href = "index.html"; return; }
            if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "No fue posible conectar con Alterna IA."); }
            const id = r.headers.get("X-Conversacion-Id");
            if (id && !estado.id) { estado.id = id; linkCompleta.href = "ia.html#" + id; }
            const rd = r.body.getReader(), dec = new TextDecoder();
            while (true) {
                const { done, value } = await rd.read(); if (done) break;
                acumulado += dec.decode(value, { stream: true });
                nodo.innerHTML = formato(acumulado, true); bajar();
            }
            if (!acumulado.trim()) throw new Error("La IA no devolvió respuesta. Intenta de nuevo.");
        } catch (e) {
            if (e.name !== "AbortError" && !acumulado) nodo.innerHTML = `<p class="aai-error">${esc(e.message)}</p>`;
        } finally {
            if (acumulado.trim()) {
                nodo.innerHTML = formato(acumulado);
                estado.mensajes.push({ rol: "assistant", contenido: acumulado }); guardar();
            } else if (!nodo.querySelector(".aai-error")) nodo.remove();
            abortar = null; botonEnviar(); bajar(); entrada.focus();
        }
    }

    /* ── Abrir / cerrar ── */
    function abrir() {
        caja.hidden = false; requestAnimationFrame(() => caja.classList.add("open"));
        fab.classList.add("activo"); fab.setAttribute("aria-expanded", "true"); fab.setAttribute("aria-label", "Cerrar Alterna IA");
        pintar(); setTimeout(() => entrada.focus(), 150);
    }
    function cerrar() {
        caja.classList.remove("open"); setTimeout(() => { if (!caja.classList.contains("open")) caja.hidden = true; }, 180);
        fab.classList.remove("activo"); fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-label", "Abrir Alterna IA");
    }
    const abierto = () => caja.classList.contains("open");

    function ajustarAltura() { entrada.style.height = "auto"; entrada.style.height = Math.min(entrada.scrollHeight, 110) + "px"; botonEnviar(); }

    fab.addEventListener("click", () => abierto() ? cerrar() : abrir());
    $("[data-cerrar]").addEventListener("click", () => { cerrar(); fab.focus(); });
    $("[data-nueva]").addEventListener("click", () => {
        abortar?.abort(); estado = { id: null, mensajes: [] }; guardar(); pintar(); entrada.focus();
    });
    caja.addEventListener("click", e => {
        const s = e.target.closest(".aai-sug"); if (s) return enviar(s.textContent);
        const v = e.target.closest("[data-ver-completa]"); if (v) v.href = linkCompleta.href;
    });
    $(".aai-form").addEventListener("submit", e => { e.preventDefault(); if (abortar) abortar.abort(); else enviar(entrada.value); });
    entrada.addEventListener("input", ajustarAltura);
    entrada.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(entrada.value); } });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && abierto()) { cerrar(); fab.focus(); } });
})();

/* Alterna — acceso directo al servidor Ubuntu (panel de estadísticas y escritorio remoto).
   • El servidor se publica por Tailscale: desde otra red, la PC necesita Tailscale conectado.
   • "Probar conexión" solo comprueba que la dirección responde (petición sin cookies ni datos);
     el inicio de sesión lo pide el propio panel con su contraseña.
   Para cambiar de servidor basta con editar SERVIDOR_URL. */
(() => {
    const SERVIDOR_URL = "https://srv.tailbbc6ef.ts.net/";
    const ESPERA_MS = 7000;

    const $ = id => document.getElementById(id);
    let revisando = false;

    function pintarEstado(estado, texto) {
        const st = $("srvStatus");
        if (st) st.dataset.estado = estado;
        if ($("srvStatusText")) $("srvStatusText").textContent = texto;
        const dot = $("srvMenuDot");
        if (dot) dot.dataset.estado = estado;
        const aviso = $("srvAviso");
        if (aviso) aviso.hidden = estado !== "caido";
    }

    async function revisarServidor() {
        if (revisando) return;
        revisando = true;
        pintarEstado("revisando", "Comprobando conexión…");
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ESPERA_MS);
        const inicio = performance.now();
        try {
            // no-cors: la respuesta es opaca, pero si llega significa que el servidor es alcanzable
            await fetch(SERVIDOR_URL + "?ping=" + Date.now(), {
                mode: "no-cors", cache: "no-store", credentials: "omit", signal: ctrl.signal
            });
            const ms = Math.round(performance.now() - inicio);
            pintarEstado("ok", `En línea · ${ms} ms`);
        } catch {
            pintarEstado("caido", ctrl.signal.aborted ? "Sin respuesta" : "Sin conexión");
        } finally {
            clearTimeout(t);
            revisando = false;
        }
    }

    async function copiarUrlServidor() {
        const btn = $("srvUrlBtn");
        try {
            await navigator.clipboard.writeText(SERVIDOR_URL);
        } catch {
            // HTTP o navegador sin portapapeles: se selecciona el texto para copiarlo a mano
            const r = document.createRange();
            r.selectNodeContents($("srvUrlText"));
            const s = getSelection(); s.removeAllRanges(); s.addRange(r);
            return;
        }
        btn?.classList.add("copiado");
        setTimeout(() => btn?.classList.remove("copiado"), 1600);
    }

    function abrirServidor() {
        if (typeof navegar === "function") navegar("servidor");
        if ($("topbarTitle"))    $("topbarTitle").textContent    = "Servidor";
        if ($("topbarSubtitle")) $("topbarSubtitle").textContent = "Panel y escritorio remoto del Ubuntu";
        revisarServidor();
    }

    // Enlaces y dirección visibles
    const host = SERVIDOR_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if ($("srvUrlText")) $("srvUrlText").textContent = host;
    ["srvAbrir", "srvCardPanel", "srvCardRemoto"].forEach(id => { if ($(id)) $(id).href = SERVIDOR_URL; });

    window.abrirServidor = abrirServidor;
    window.revisarServidor = revisarServidor;
    window.copiarUrlServidor = copiarUrlServidor;
})();

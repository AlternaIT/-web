/* Alterna — acceso directo al servidor Ubuntu (panel de estadísticas y escritorio remoto).
   • Los botones van a servidor.html, que abre el servidor con la sesión de Alterna (sin contraseña).
   • "Probar conexión" solo comprueba que la dirección responde (petición sin cookies ni datos).
   Para cambiar de servidor: SERVIDOR_URL aquí y en servidor.html. */
(() => {
    // Panel del servidor Ubuntu (en /panel/). Si esta web ya la sirve el propio servidor, es la misma dirección
    const SERVIDOR_URL = (location.hostname.endsWith("github.io") || !location.protocol.startsWith("http") ? "https://srv.tailbbc6ef.ts.net" : location.origin) + "/panel/";
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
    // Se abre por el puente servidor.html, que le pasa la sesión de Alterna al servidor (sin contraseña)
    ["srvAbrir", "srvCardPanel", "srvCardRemoto"].forEach(id => { if ($(id)) $(id).href = "servidor.html"; });

    window.abrirServidor = abrirServidor;
    window.revisarServidor = revisarServidor;
    window.copiarUrlServidor = copiarUrlServidor;
})();

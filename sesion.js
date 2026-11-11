/* Alterna — sesión de las páginas abiertas (apps, IT, IA).
   • Latido: mientras la página está visible avisa cada minuto que el usuario sigue aquí
     (latido() marca sesiones_app.ultima_actividad; el panel de usuarios lo muestra "En línea").
   • Si un admin cerró las sesiones del usuario o lo bloqueó, latido() devuelve null: se borra la
     sesión del navegador y se vuelve al login con aviso.
   Un error de red no expulsa a nadie. */
(() => {
    const SUPABASE_URL = "https://nxbncqixxlmdvepapuqe.supabase.co";
    const SUPABASE_KEY = "sb_publishable_2nsr-fPUd1FJYLyWJf_UiQ_N7kaYKFv";
    let token = "";
    try { token = JSON.parse(localStorage.getItem("usuario"))?.token || ""; } catch { /* sin sesión */ }
    if (!token) return;

    async function latido() {
        try {
            const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/latido", {
                method: "POST", body: "{}",
                headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, "x-app-token": token }
            });
            if (!r.ok) return;
            if ((await r.json()) == null) {
                localStorage.removeItem("usuario");
                // Enlace directo de IT (QR de equipo o ticket): se retoma después de volver a iniciar sesión
                if (/(^|\/)it\.html$/.test(location.pathname) && /^#(equipo|ticket)=[\w-]{1,40}$/.test(location.hash)) {
                    try { sessionStorage.setItem("alterna_volver", "it.html" + location.hash); } catch { /* sin almacenamiento */ }
                }
                location.replace("index.html?sesion=cerrada");
            }
        } catch { /* sin conexión: se vuelve a intentar después */ }
    }

    // Zona horaria de esta computadora: la sesión vence a las 00:00 (12:00 a. m.) de su hora local.
    // Si el navegador no da el nombre, se arma con la diferencia horaria (360 min → "Etc/GMT+6" = UTC−6).
    function zonaHoraria() {
        try {
            const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (z && z !== "Etc/Unknown") return z;
        } catch { /* navegador sin Intl */ }
        const min = new Date().getTimezoneOffset();
        if (min % 60 !== 0 || Math.abs(min) > 14 * 60) return null;
        return min === 0 ? "Etc/UTC" : "Etc/GMT" + (min > 0 ? "+" : "-") + Math.abs(min / 60);
    }
    // Una vez por sesión (el servidor también lo acepta solo una vez)
    (async () => {
        const zona = zonaHoraria(), marca = "alterna_zona_" + token.slice(0, 8);
        try { if (!zona || sessionStorage.getItem(marca)) return; } catch { /* sin almacenamiento */ }
        try {
            const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/fijar_zona_sesion", {
                method: "POST", body: JSON.stringify({ p_zona: zona }),
                headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, "x-app-token": token }
            });
            if (r.ok) { try { sessionStorage.setItem(marca, "1"); } catch { /* sin almacenamiento */ } latido(); }
        } catch { /* sin conexión: se intenta en la próxima página */ }
    })();

    latido();
    // Solo con la pestaña visible: "En línea" = la está usando; en segundo plano pasa a "Visto hace…"
    setInterval(() => { if (document.visibilityState === "visible") latido(); }, 60_000);

    // Medianoche de la computadora: el servidor vence la sesión a las 00:00 (12:00 a. m.) locales, así
    // que justo después se revisa aunque la pestaña esté en segundo plano. Se calcula con la fecha
    // (día siguiente a las 0:00:05), nunca leyendo la hora en texto: 12 p. m. (mediodía) no cuenta.
    function revisarAMedianoche() {
        const ahora = new Date();
        const medianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 5);
        setTimeout(() => { latido(); revisarAMedianoche(); }, Math.min(medianoche - ahora, 2 ** 31 - 1));
    }
    revisarAMedianoche();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") latido(); });
})();

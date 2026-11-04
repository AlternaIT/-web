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

    latido();
    // Solo con la pestaña visible: "En línea" = la está usando; en segundo plano pasa a "Visto hace…"
    setInterval(() => { if (document.visibilityState === "visible") latido(); }, 60_000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") latido(); });
})();

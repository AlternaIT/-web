/* Alterna — vigila que la sesión siga viva en las páginas abiertas (apps, IT, IA).
   Si un admin cerró las sesiones del usuario o lo bloqueó, app_usuario_id() deja de reconocer el
   token: se borra la sesión del navegador y se vuelve al login con aviso.
   Se revisa al cargar, cada minuto y al volver a la pestaña. Un error de red no expulsa a nadie. */
(() => {
    const SUPABASE_URL = "https://nxbncqixxlmdvepapuqe.supabase.co";
    const SUPABASE_KEY = "sb_publishable_2nsr-fPUd1FJYLyWJf_UiQ_N7kaYKFv";
    let token = "";
    try { token = JSON.parse(localStorage.getItem("usuario"))?.token || ""; } catch { /* sin sesión */ }
    if (!token) return;

    async function revisar() {
        try {
            const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/app_usuario_id", {
                method: "POST", body: "{}",
                headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, "x-app-token": token }
            });
            if (!r.ok) return;
            if ((await r.json()) == null) {
                localStorage.removeItem("usuario");
                location.replace("index.html?sesion=cerrada");
            }
        } catch { /* sin conexión: se vuelve a intentar después */ }
    }

    revisar();
    setInterval(revisar, 60_000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") revisar(); });
})();

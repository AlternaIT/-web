/* ═══════════════════════════════════════════
       SUPABASE
    ═══════════════════════════════════════════ */
    const SUPABASE_URL = "https://nxbncqixxlmdvepapuqe.supabase.co";
    const SUPABASE_KEY = "sb_publishable_2nsr-fPUd1FJYLyWJf_UiQ_N7kaYKFv";
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


    /* ═══════════════════════════════════════════
       SESIÓN
    ═══════════════════════════════════════════ */
    const usuarioGuardado = localStorage.getItem("usuario");
    if (!usuarioGuardado) window.location.href = "index.html";

    let usuario = null;
    try {
        usuario = JSON.parse(usuarioGuardado);
    } catch {
        localStorage.removeItem("usuario");
        window.location.href = "index.html";
    }


    /* ═══════════════════════════════════════════
       ESTADO GLOBAL
    ═══════════════════════════════════════════ */
    let todasActividades = [];
    let paginaActual = "dashboard";


    /* ═══════════════════════════════════════════
       NAVEGACIÓN SPA
       navegar(pagina, filtroEstadoOpcional)
    ═══════════════════════════════════════════ */
    const metaPaginas = {
        dashboard:          { titulo: "Dashboard",           subtitulo: "Panel de control — Alterna TI" },
        "nueva-tarea":      { titulo: "Nueva Tarea",         subtitulo: "Registrar una nueva actividad" },
        actividades:        { titulo: "Actividades",         subtitulo: "Gestión de actividades del equipo" },
        usuarios:           { titulo: "Usuarios",            subtitulo: "Administración de accesos" },
        equipos:            { titulo: "Equipos",             subtitulo: "Gestión de hardware e inventario" },
        reportes:           { titulo: "Reportes",            subtitulo: "Análisis y estadísticas" },
        configuracion:      { titulo: "Configuración",       subtitulo: "Ajustes del sistema" },
        "licencias-office": { titulo: "Licencias — Office",  subtitulo: "Gestión de licencias Microsoft 365" },
        "licencias-kanva":  { titulo: "Licencias — Canva",   subtitulo: "Gestión de licencias de diseño Canva" },
        mantenimientos:     { titulo: "Mantenimientos",      subtitulo: "Calendario y tickets de mantenimiento de equipos" },
    };

    function navegar(pagina, filtroEstado) {
        // Ocultar página actual
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("active"));

        // Mostrar nueva página
        const nuevaPagina = document.getElementById("page-" + pagina);
        if (!nuevaPagina) return;
        nuevaPagina.classList.add("active");

        // Marcar menú activo — nueva-tarea pertenece al grupo Actividades
        const menuPage = pagina === "nueva-tarea" ? "actividades" : pagina;
        const menuItem = document.querySelector(`.menu-item[data-page="${menuPage}"]`);
        if (menuItem) menuItem.classList.add("active");

        // Mantener submenú de actividades abierto para páginas hijas
        if (pagina === "nueva-tarea") {
            const sub = document.getElementById("submenu-actividades");
            if (sub) { sub.classList.add("open"); menuItem && menuItem.classList.add("open"); }
        }

        // Actualizar topbar
        const meta = metaPaginas[pagina] || {};
        document.getElementById("topbarTitle").textContent    = meta.titulo    || pagina;
        document.getElementById("topbarSubtitle").textContent = meta.subtitulo || "";

        paginaActual = pagina;

        // Scroll top
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Acciones por página
        if (pagina === "actividades") {
            if (filtroEstado) {
                document.getElementById("filtroEstado").value = filtroEstado;
            }
            paginaTabla = 1;
            const vista = getVistaActividades();
            aplicarVistaActividades(vista);
            if (vista === "kanban") renderKanban();
            else renderTabla();
        }

        if (pagina === "usuarios")         cargarTablaUsuarios();
        if (pagina === "equipos")          cargarEquipos();
        if (pagina === "reportes")         renderReportes();
        if (pagina === "configuracion")    renderConfiguracion();
        if (pagina === "licencias-office") cargarLicenciasOffice();
        if (pagina === "licencias-kanva")  cargarLicenciasKanva();
        if (pagina === "mantenimientos")   cargarMantenimientos();
    }


    /* ═══════════════════════════════════════════
       CARGAR USUARIO
    ═══════════════════════════════════════════ */
    async function cargarUsuario() {
        if (!usuario?.id) return;

        const { data, error } = await supabaseClient
            .from("usuarios")
            .select("id, correo, nombre, rol, activo")
            .eq("id", usuario.id)
            .single();

        if (error) { console.error("Error usuario:", error); return; }

        if (!data.activo) {
            localStorage.removeItem("usuario");
            alert("Tu usuario se encuentra desactivado.");
            window.location.href = "index.html";
            return;
        }

        usuario = data;
        localStorage.setItem("usuario", JSON.stringify(usuario));
        mostrarUsuario();
    }


    /* ═══════════════════════════════════════════
       MOSTRAR USUARIO EN SIDEBAR
    ═══════════════════════════════════════════ */
    function mostrarUsuario() {
        const nombre = usuario.nombre || "Usuario";
        const rol    = usuario.rol    || "usuario";

        document.getElementById("sidebarName").textContent    = nombre;
        document.getElementById("sidebarRole").textContent    = rol;
        document.getElementById("welcomeMessage").textContent = "Bienvenido, " + nombre;

        const partes = nombre.trim().split(/\s+/);
        const iniciales = partes.length >= 2
            ? partes[0].charAt(0) + partes[1].charAt(0)
            : partes[0].substring(0, 2);
        document.getElementById("avatar").textContent = iniciales.toUpperCase();
    }


    /* ═══════════════════════════════════════════
       CARGAR TOTAL USUARIOS (card)
    ═══════════════════════════════════════════ */
    async function cargarTotalUsuarios() {
        const { count, error } = await supabaseClient
            .from("usuarios")
            .select("*", { count: "exact", head: true });
        if (!error) document.getElementById("totalUsuarios").textContent = count ?? 0;
    }


    /* ═══════════════════════════════════════════
       CARGAR ACTIVIDADES
    ═══════════════════════════════════════════ */
    async function cargarActividades() {
        const { data, error } = await supabaseClient
            .from("actividades")
            .select("*")
            .order("id", { ascending: false });

        if (error) {
            console.error("Error actividades:", error);
            document.getElementById("tablaBody").innerHTML =
                `<tr><td colspan="6" style="color:#ef4444;padding:20px 16px">
                    Error al cargar datos. Verifica que la tabla exista en Supabase.
                 </td></tr>`;
            return;
        }

        todasActividades = data || [];
        actualizarMetricCards();
        renderActividadReciente();
        renderPanelPendientes();
        poblarFiltroArea();
        renderTabla();
        renderReportes();
        renderNotificaciones();
    }


    /* ═══════════════════════════════════════════
       METRIC CARDS
    ═══════════════════════════════════════════ */
    function actualizarMetricCards() {
        const enProceso  = todasActividades.filter(a => a.estado === "En proceso").length;
        const noIniciado = todasActividades.filter(a => a.estado === "No iniciado").length;
        const terminado  = todasActividades.filter(a => a.estado === "Terminado").length;
        document.getElementById("cntEnProceso").textContent  = enProceso;
        document.getElementById("cntNoIniciado").textContent = noIniciado;
        document.getElementById("cntTerminado").textContent  = terminado;
    }


    /* ═══════════════════════════════════════════
       DASHBOARD — COMPLETADAS RECIENTES
    ═══════════════════════════════════════════ */
    function renderActividadReciente() {
        const iconos = { TI:"💻", Proyectos:"📋", Pipeline:"🔄", Talento:"👥",
                         MELI:"🏪", Devela:"🏢", Adquisiciones:"🛒",
                         Administración:"📁", Cultivación:"🌱" };

        const n = Number(preferenciasUsuario.completadas_dashboard) || 0;
        const container = document.getElementById("actividadReciente");
        const panel = container?.closest(".panel");
        if (panel) panel.style.display = n ? "" : "none";
        if (!n) return;

        const recientes = todasActividades
            .filter(a => a.estado === "Terminado" && a.fecha_finalizacion)
            .sort((a,b) => new Date(b.fecha_finalizacion) - new Date(a.fecha_finalizacion))
            .slice(0, n);

        if (!recientes.length) {
            container.innerHTML = `<div class="activity"><div class="activity-text">
                <div class="activity-title" style="color:#9ca3af">Sin completadas recientes</div>
            </div></div>`;
            return;
        }

        container.innerHTML = recientes.map(a => `
            <div class="activity">
                <div class="activity-icon">${iconos[a.area] || "✓"}</div>
                <div class="activity-text">
                    <div class="activity-title" title="${esc(a.actividad)}">${esc(truncar(a.actividad, 55))}</div>
                    <div class="activity-meta">${esc(a.proyecto_macro||"")} · ${formatFecha(a.fecha_finalizacion)} · ${esc(a.asignado||"")}</div>
                </div>
            </div>`).join("");
    }


    /* ═══════════════════════════════════════════
       DASHBOARD — EN PROCESO
    ═══════════════════════════════════════════ */
    function renderPanelPendientes() {
        const orden = { "Alta":0, "Media":1, "Baja":2 };
        const activas = todasActividades
            .filter(a => a.estado === "En proceso")
            .sort((a,b) => (orden[a.prioridad]??3) - (orden[b.prioridad]??3))
            .slice(0, 6);

        const container = document.getElementById("panelPendientes");

        if (!activas.length) {
            container.innerHTML = `<div class="task"><div class="task-name" style="color:#9ca3af">Sin actividades en proceso</div></div>`;
            return;
        }

        container.innerHTML = activas.map(a => `
            <div class="task">
                <div class="task-name" title="${esc(a.actividad)}">${esc(truncar(a.actividad, 42))}</div>
                <div class="task-footer">
                    ${badgePrioridad(a.prioridad)}
                    <span style="font-size:11px;color:#9ca3af">${esc(a.asignado||"")}</span>
                </div>
            </div>`).join("");
    }


    /* ═══════════════════════════════════════════
       ACTIVIDADES — FILTROS + TABLA
    ═══════════════════════════════════════════ */
    let paginaTabla    = 1;
    let POR_PAGINA     = 25;
    let sortCol        = null;
    let sortDir        = "asc";
    // historial y comentarios — almacenados en localStorage
    const HIST_KEY     = "alterna_historial";
    const COMM_KEY     = "alterna_comentarios";

    function getHistorial() {
        try { return JSON.parse(localStorage.getItem(HIST_KEY) || "{}"); } catch { return {}; }
    }
    function saveHistorial(h) { localStorage.setItem(HIST_KEY, JSON.stringify(h)); }
    function getComentarios() {
        try { return JSON.parse(localStorage.getItem(COMM_KEY) || "{}"); } catch { return {}; }
    }
    function saveComentarios(c) { localStorage.setItem(COMM_KEY, JSON.stringify(c)); }

    function registrarCambioEstado(id, estadoAnterior, estadoNuevo) {
        const h = getHistorial();
        if (!h[id]) h[id] = [];
        h[id].unshift({
            tipo: "estado",
            de: estadoAnterior,
            a: estadoNuevo,
            quien: usuario?.nombre || "Usuario",
            cuando: new Date().toISOString()
        });
        saveHistorial(h);
    }

    function poblarFiltroArea() {
        const areas = [...new Set(todasActividades.map(a => a.area).filter(Boolean))].sort();
        const sel = document.getElementById("filtroArea");
        sel.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());
        areas.forEach(area => {
            const opt = document.createElement("option");
            opt.value = area; opt.textContent = area;
            sel.appendChild(opt);
        });
    }

    function sortTabla(col) {
        if (sortCol === col) {
            sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
            sortCol = col; sortDir = "asc";
        }
        document.querySelectorAll("thead th.sortable").forEach(th => {
            th.classList.remove("sort-asc","sort-desc");
            if (th.dataset.col === col) th.classList.add("sort-" + sortDir);
        });
        paginaTabla = 1;
        renderTabla();
    }


    /* ═══════════════════════════════════════════
       GRÁFICAS DE REPORTES
    ═══════════════════════════════════════════ */
    let chartEstadoInst = null, chartPrioridadInst = null,
        chartAreaInst   = null, chartAsignadoInst  = null;

    function renderReportes() {
        if (!todasActividades.length) return;

        sincronizarBotonesPeriodo();
        const actividades = filtrarActividadesPorPeriodo();

        // ── Estado ──
        const estados = { "En proceso": 0, "No iniciado": 0, "Terminado": 0 };
        actividades.forEach(a => { if (estados[a.estado] !== undefined) estados[a.estado]++; });

        if (chartEstadoInst) chartEstadoInst.destroy();
        chartEstadoInst = new Chart(document.getElementById("chartEstado"), {
            type: "doughnut",
            data: {
                labels: Object.keys(estados),
                datasets: [{ data: Object.values(estados),
                    backgroundColor: ["#fef3c7","#f3f4f6","#d1fae5"],
                    borderColor:     ["#f59e0b","#9ca3af","#10b981"],
                    borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { font: { size: 12 } } } } }
        });

        // ── Prioridad ──
        const prios = { "Alta": 0, "Media": 0, "Baja": 0 };
        actividades.forEach(a => { if (prios[a.prioridad] !== undefined) prios[a.prioridad]++; });

        if (chartPrioridadInst) chartPrioridadInst.destroy();
        chartPrioridadInst = new Chart(document.getElementById("chartPrioridad"), {
            type: "doughnut",
            data: {
                labels: Object.keys(prios),
                datasets: [{ data: Object.values(prios),
                    backgroundColor: ["#fee2e2","#fef3c7","#f0fdf4"],
                    borderColor:     ["#ef4444","#f59e0b","#10b981"],
                    borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { font: { size: 12 } } } } }
        });

        // ── Por área ──
        const areas = {};
        actividades.forEach(a => {
            if (!a.area) return;
            if (!areas[a.area]) areas[a.area] = { total: 0, terminado: 0 };
            areas[a.area].total++;
            if (a.estado === "Terminado") areas[a.area].terminado++;
        });
        const areaLabels = Object.keys(areas).sort((a,b) => areas[b].total - areas[a].total);

        if (chartAreaInst) chartAreaInst.destroy();
        chartAreaInst = new Chart(document.getElementById("chartArea"), {
            type: "bar",
            data: {
                labels: areaLabels,
                datasets: [
                    { label: "Total",     data: areaLabels.map(k => areas[k].total),     backgroundColor: "#c7d2fe", borderRadius: 5 },
                    { label: "Terminado", data: areaLabels.map(k => areas[k].terminado), backgroundColor: "#6366f1", borderRadius: 5 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "top" } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });

        // ── Por responsable ──
        const asigs = {};
        actividades.forEach(a => {
            const nombre = a.asignado || "Sin asignar";
            if (!asigs[nombre]) asigs[nombre] = { total: 0, terminado: 0 };
            asigs[nombre].total++;
            if (a.estado === "Terminado") asigs[nombre].terminado++;
        });
        const asigLabels = Object.keys(asigs).sort((a,b) => asigs[b].total - asigs[a].total);

        if (chartAsignadoInst) chartAsignadoInst.destroy();
        chartAsignadoInst = new Chart(document.getElementById("chartAsignado"), {
            type: "bar",
            data: {
                labels: asigLabels,
                datasets: [
                    { label: "Total",     data: asigLabels.map(k => asigs[k].total),     backgroundColor: "#a7f3d0", borderRadius: 5 },
                    { label: "Terminado", data: asigLabels.map(k => asigs[k].terminado), backgroundColor: "#10b981", borderRadius: 5 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "top" } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }


    /* ═══════════════════════════════════════════
       HISTORIAL DE CAMBIOS — SUPABASE
    ═══════════════════════════════════════════ */
    async function registrarHistorial(actividad_id, accion, cambios) {
        // cambios: array de { campo, anterior, nuevo }
        const nombre = usuario?.nombre || "Usuario";
        if (!cambios || !cambios.length) return;

        const rows = cambios.map(c => ({
            actividad_id,
            usuario:        nombre,
            accion,
            campo:          c.campo        || null,
            valor_anterior: c.anterior     || null,
            valor_nuevo:    c.nuevo        || null,
        }));

        await supabaseClient.from("historial_actividades").insert(rows);
    }

    async function cargarHistorialDrawer(actividad_id) {
        const dHist = document.getElementById("dHistorial");
        dHist.innerHTML = `<div style="font-size:12px;color:#9ca3af">Cargando...</div>`;

        const { data, error } = await supabaseClient
            .from("historial_actividades")
            .select("*")
            .eq("actividad_id", actividad_id)
            .order("created_at", { ascending: false })
            .limit(30);

        if (error || !data?.length) {
            dHist.innerHTML = `<div style="font-size:12px;color:#9ca3af">Sin historial registrado.</div>`;
            return;
        }

        dHist.innerHTML = data.map(h => `
            <div class="history-item">
                <div class="history-dot"></div>
                <div class="history-text">
                    <strong>${esc(h.usuario)}</strong> ${esc(h.accion)}
                    ${h.campo ? `· <em>${esc(h.campo)}</em>` : ""}
                    ${h.valor_anterior && h.valor_nuevo
                        ? `<br><span style="color:#9ca3af;font-size:11px">"${esc(h.valor_anterior)}" → "${esc(h.valor_nuevo)}"</span>`
                        : ""}
                </div>
                <div class="history-time">${formatFechaHora(h.created_at)}</div>
            </div>`).join("");
    }


    /* ═══════════════════════════════════════════
       DATOS VISIBLES (filtros actuales)
    ═══════════════════════════════════════════ */
    function getDatosVisibles() {
        const busq      = document.getElementById("busqueda").value.toLowerCase();
        const estado    = document.getElementById("filtroEstado").value;
        const asignado  = document.getElementById("filtroAsignado").value;
        const prioridad = document.getElementById("filtroPrioridad").value;
        const area      = document.getElementById("filtroArea").value;
        const fechaDesde = document.getElementById("filtroFechaDesde").value;
        const fechaHasta = document.getElementById("filtroFechaHasta").value;

        return todasActividades.filter(a => {
            if (estado    && a.estado    !== estado)    return false;
            if (prioridad && a.prioridad !== prioridad) return false;
            if (area      && a.area      !== area)      return false;
            if (asignado && !(a.asignado||"").toLowerCase().includes(asignado.toLowerCase())) return false;
            if (busq) {
                const h = `${a.actividad} ${a.proyecto_macro} ${a.area} ${a.asignado} ${a.notas}`.toLowerCase();
                if (!h.includes(busq)) return false;
            }
            if (fechaDesde && a.fecha_limite && a.fecha_limite < fechaDesde) return false;
            if (fechaHasta && a.fecha_limite && a.fecha_limite > fechaHasta) return false;
            return true;
        });
    }


    /* ═══════════════════════════════════════════
       EXPORTAR (Excel / PDF / predeterminado)
    ═══════════════════════════════════════════ */
    function nombreArchivo(ext) {
        const prefijo = (preferenciasUsuario.export_prefijo || "actividades")
            .replace(/[\\/:*?"<>|]/g, "").trim() || "actividades";
        return `${prefijo}_${new Date().toISOString().slice(0,10)}.${ext}`;
    }

    function exportarPredeterminado() {
        if (preferenciasUsuario.export_formato === "pdf") exportarPDF();
        else exportarExcel();
    }

    function exportarExcel() {
        const conNotas = preferenciasUsuario.export_notas !== false;
        const filas = getDatosVisibles().map(a => {
            const fila = {
                "Actividad":    a.actividad      || "",
                "Proyecto":     a.proyecto_macro || "",
                "Área":         a.area           || "",
                "Prioridad":    a.prioridad      || "",
                "Estado":       a.estado         || "",
                "Asignado":     a.asignado       || "",
                "Fecha límite": a.fecha_limite   || "",
                "Finalización": a.fecha_finalizacion || "",
            };
            if (conNotas) fila["Notas"] = a.notas || "";
            return fila;
        });

        const ws = XLSX.utils.json_to_sheet(filas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Actividades");

        const anchos = [45, 30, 18, 12, 14, 20, 14, 14];
        if (conNotas) anchos.push(40);
        ws["!cols"] = anchos.map(wch => ({ wch }));

        XLSX.writeFile(wb, nombreArchivo("xlsx"));
    }

    function exportarPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        const datos    = getDatosVisibles();
        const conNotas = preferenciasUsuario.export_notas !== false;
        const fecha    = new Date().toLocaleDateString("es-GT");

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Reporte de Actividades — Alterna", 14, 16);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120);
        doc.text(`Generado el ${fecha} · ${datos.length} actividades`, 14, 22);
        doc.setTextColor(0);

        const head   = ["Actividad", "Proyecto", "Área", "Prioridad", "Estado", "Asignado", "Fecha límite"];
        const anchos = [60, 40, 25, 22, 22, 28, 24];
        if (conNotas) { head.push("Notas"); anchos.push(48); }

        const body = datos.map(a => {
            const fila = [a.actividad||"", a.proyecto_macro||"", a.area||"", a.prioridad||"",
                          a.estado||"", a.asignado||"", a.fecha_limite||""];
            if (conNotas) fila.push(a.notas || "");
            return fila;
        });

        const columnStyles = {};
        anchos.forEach((w, i) => { columnStyles[i] = { cellWidth: w }; });

        doc.autoTable({
            startY: 27,
            head: [head],
            body,
            styles:     { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            columnStyles
        });

        doc.save(nombreArchivo("pdf"));
    }


    /* ═══════════════════════════════════════════
       FILTROS DE FECHA Y TABLA
    ═══════════════════════════════════════════ */
    function limpiarFiltrosFecha() {
        document.getElementById("filtroFechaDesde").value = "";
        document.getElementById("filtroFechaHasta").value = "";
        paginaTabla = 1;
        renderTabla();
    }

    function fechaRelativa(isoFecha, estado) {
        if (!isoFecha) return { texto: "—", clase: "" };
        const hoy  = new Date(); hoy.setHours(0,0,0,0);
        const d    = new Date(isoFecha + "T00:00:00");
        const diff = Math.round((d - hoy) / 86400000); // días
        const terminado = estado === "Terminado";

        if (terminado) {
            return { texto: formatFecha(isoFecha), clase: "" };
        }
        if (diff < 0)   return { texto: `Vencida hace ${Math.abs(diff)} día${Math.abs(diff)!==1?"s":""}`, clase: "fecha-vencida" };
        if (diff === 0) return { texto: "Vence hoy",    clase: "fecha-proxima" };
        if (diff <= 3)  return { texto: `Vence en ${diff} día${diff!==1?"s":""}`, clase: "fecha-proxima" };
        return { texto: `Vence en ${diff} días`, clase: "fecha-ok" };
    }

    function renderTabla() {
        if (getVistaActividades() === "kanban") { renderKanban(); return; }
        const busq      = document.getElementById("busqueda").value.toLowerCase();
        const estado    = document.getElementById("filtroEstado").value;
        const asignado  = document.getElementById("filtroAsignado").value;
        const prioridad = document.getElementById("filtroPrioridad").value;
        const area      = document.getElementById("filtroArea").value;

        const ordenPrio   = { "Alta":0, "Media":1, "Baja":2 };
        const ordenEstado = { "En proceso":0, "No iniciado":1, "Terminado":2 };

        const fechaDesde = document.getElementById("filtroFechaDesde").value;
        const fechaHasta = document.getElementById("filtroFechaHasta").value;

        let filtradas = todasActividades.filter(a => {
            if (estado    && a.estado    !== estado)    return false;
            if (prioridad && a.prioridad !== prioridad) return false;
            if (area      && a.area      !== area)      return false;
            if (asignado && !(a.asignado||"").toLowerCase().includes(asignado.toLowerCase())) return false;
            if (busq) {
                const h = `${a.actividad} ${a.proyecto_macro} ${a.area} ${a.asignado} ${a.notas}`.toLowerCase();
                if (!h.includes(busq)) return false;
            }
            if (fechaDesde && a.fecha_limite && a.fecha_limite < fechaDesde) return false;
            if (fechaHasta && a.fecha_limite && a.fecha_limite > fechaHasta) return false;
            return true;
        });

        // Si el filtro es "Terminado", ordenar de más reciente a más antiguo
        if (estado === "Terminado") {
            filtradas.sort((a,b) => {
                const fa = a.fecha_finalizacion || a.updated_at || "";
                const fb = b.fecha_finalizacion || b.updated_at || "";
                return fb.localeCompare(fa);
            });
        } else if (sortCol) {
            filtradas.sort((a,b) => {
                let va = a[sortCol]||"", vb = b[sortCol]||"";
                if (sortCol === "prioridad") { va = ordenPrio[va]??3; vb = ordenPrio[vb]??3; }
                else if (sortCol === "estado") { va = ordenEstado[va]??3; vb = ordenEstado[vb]??3; }
                const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
                return sortDir === "asc" ? cmp : -cmp;
            });
        } else {
            filtradas.sort((a,b) => {
                const es = (ordenEstado[a.estado]??3) - (ordenEstado[b.estado]??3);
                if (es !== 0) return es;
                return (ordenPrio[a.prioridad]??3) - (ordenPrio[b.prioridad]??3);
            });
        }

        document.getElementById("filterCount").textContent =
            `${filtradas.length} de ${todasActividades.length} actividades`;

        const tbody = document.getElementById("tablaBody");

        if (!filtradas.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No se encontraron actividades con los filtros aplicados.</div></td></tr>`;
            document.getElementById("paginacion").innerHTML = "";
            return;
        }

        // Paginación
        const totalPags = Math.ceil(filtradas.length / POR_PAGINA);
        if (paginaTabla > totalPags) paginaTabla = totalPags;
        const inicio = (paginaTabla - 1) * POR_PAGINA;
        const pagina = filtradas.slice(inicio, inicio + POR_PAGINA);

        const hoy = new Date(); hoy.setHours(0,0,0,0);

        tbody.innerHTML = pagina.map(a => {
            const vencida  = a.fecha_limite && new Date(a.fecha_limite+"T00:00:00") < hoy && a.estado !== "Terminado";
            const rowClass = vencida ? "clickable-row row-vencida" : "clickable-row";

            const estadoMap = { "Terminado":"badge-terminado","En proceso":"badge-en-proceso","No iniciado":"badge-no-iniciado" };
            const eClass    = estadoMap[a.estado] || "badge-no-iniciado";

            const esTerminado = a.estado === "Terminado";
            const { texto: fechaTxt, clase: fechaClass } = esTerminado
                ? { texto: formatFecha(a.fecha_finalizacion) || "—", clase: "" }
                : fechaRelativa(a.fecha_limite, a.estado);

            return `<tr class="${rowClass}" onclick="abrirDrawer(${a.id})">
                <td data-label="Actividad" class="td-actividad">
                    <span class="td-actividad-text" title="${esc(a.actividad)}">${esc(a.actividad)}</span>
                    <div class="td-proyecto">${esc(a.proyecto_macro||"")}</div>
                </td>
                <td data-label="Área">${esc(a.area||"—")}</td>
                <td data-label="Prioridad">${badgePrioridad(a.prioridad)}</td>
                <td data-label="Estado" onclick="event.stopPropagation()">
                    <select class="inline-estado ${eClass}" onchange="cambiarEstadoInline(${a.id}, this)">
                        <option value="No iniciado" ${a.estado==="No iniciado"?"selected":""}>No iniciado</option>
                        <option value="En proceso"  ${a.estado==="En proceso"?"selected":""}>En proceso</option>
                        <option value="Terminado"   ${a.estado==="Terminado"?"selected":""}>Terminado</option>
                    </select>
                </td>
                <td data-label="Asignado"><span class="asignado-chip">${esc(a.asignado||"—")}</span></td>
                <td data-label="Fecha" style="white-space:nowrap" class="${fechaClass}">${esc(fechaTxt)}</td>
                <td data-label="" onclick="event.stopPropagation()">
                    <button class="btn-edit" onclick="abrirEditarTarea(${a.id})">✏</button>
                </td>
            </tr>`;
        }).join("");

        // Actualizar encabezado de columna fecha según filtro
        const thFecha = document.getElementById("thFecha");
        if (thFecha) {
            thFecha.innerHTML = (estado === "Terminado" ? "Finalización" : "Fecha límite") + '<span class="sort-icon"></span>';
        }

        renderPaginacion(filtradas.length, totalPags);
    }

    function renderPaginacion(total, totalPags) {
        const div = document.getElementById("paginacion");
        if (totalPags <= 1) { div.innerHTML = ""; return; }

        const inicio = (paginaTabla - 1) * POR_PAGINA + 1;
        const fin    = Math.min(paginaTabla * POR_PAGINA, total);

        let btns = "";
        btns += `<button class="pg-btn" onclick="irPagina(${paginaTabla-1})" ${paginaTabla===1?"disabled":""}>‹</button>`;

        for (let i = 1; i <= totalPags; i++) {
            if (totalPags > 7 && Math.abs(i - paginaTabla) > 2 && i !== 1 && i !== totalPags) {
                if (i === 2 || i === totalPags - 1) btns += `<button class="pg-btn" disabled>…</button>`;
                continue;
            }
            btns += `<button class="pg-btn ${i===paginaTabla?"active":""}" onclick="irPagina(${i})">${i}</button>`;
        }
        btns += `<button class="pg-btn" onclick="irPagina(${paginaTabla+1})" ${paginaTabla===totalPags?"disabled":""}>›</button>`;

        div.innerHTML = `
            <span class="pagination-info">Mostrando ${inicio}–${fin} de ${total}</span>
            <div class="pagination-btns">${btns}</div>`;
    }

    function irPagina(n) {
        paginaTabla = n;
        renderTabla();
        document.getElementById("page-actividades").scrollIntoView({ behavior:"smooth", block:"start" });
    }

    async function cambiarEstadoInline(id, sel) {
        const nuevoEstado = sel.value;
        const a = todasActividades.find(x => x.id === id);
        if (!a) return;
        const estadoAnterior = a.estado;
        if (estadoAnterior === nuevoEstado) return;

        const eMap = {"Terminado":"badge-terminado","En proceso":"badge-en-proceso","No iniciado":"badge-no-iniciado"};
        sel.className = `inline-estado ${eMap[nuevoEstado]||"badge-no-iniciado"}`;

        const payload = { estado: nuevoEstado };
        if (nuevoEstado === "Terminado" && !a.fecha_finalizacion) {
            payload.fecha_finalizacion = new Date().toISOString().split("T")[0];
        }

        const { error } = await supabaseClient.from("actividades").update(payload).eq("id", id);
        if (error) {
            alert("Error al actualizar: " + error.message);
            sel.value = estadoAnterior;
            sel.className = `inline-estado ${eMap[estadoAnterior]||"badge-no-iniciado"}`;
            return;
        }

        await registrarHistorial(id, "editó", [{ campo: "Estado", anterior: estadoAnterior, nuevo: nuevoEstado }]);
        await cargarActividades();
    }


    /* ═══════════════════════════════════════════
       DRAWER DETALLE
    ═══════════════════════════════════════════ */
    let drawerIdActual = null;

    function abrirDrawer(id) {
        const a = todasActividades.find(x => x.id === id);
        if (!a) return;
        drawerIdActual = id;

        document.getElementById("drawerTitulo").textContent   = a.actividad || "—";
        document.getElementById("drawerProyecto").textContent = a.proyecto_macro || "";
        document.getElementById("dArea").innerHTML      = esc(a.area || "—");
        document.getElementById("dPrioridad").innerHTML = badgePrioridad(a.prioridad);
        document.getElementById("dEstado").innerHTML    = badgeEstado(a.estado);
        document.getElementById("dAsignado").innerHTML  = `<span class="asignado-chip">${esc(a.asignado||"—")}</span>`;

        const { texto: ftxt, clase: fcls } = fechaRelativa(a.fecha_limite, a.estado);
        document.getElementById("dFechaLimite").innerHTML = `<span class="${fcls}">${esc(ftxt)}</span>`;
        document.getElementById("dFechaFin").textContent  = formatFecha(a.fecha_finalizacion);

        const notasSec = document.getElementById("dNotasSection");
        if (a.notas) {
            notasSec.style.display = "";
            document.getElementById("dNotas").textContent = a.notas;
        } else {
            notasSec.style.display = "none";
        }

        cargarHistorialDrawer(id);
        renderComentariosDrawer(id);

        document.getElementById("drawerOverlay").classList.add("open");
        document.getElementById("drawerDetalle").classList.add("open");
    }

    function cerrarDrawer() {
        document.getElementById("drawerOverlay").classList.remove("open");
        document.getElementById("drawerDetalle").classList.remove("open");
        drawerIdActual = null;
    }

    function abrirEditarDesdeDrawer() {
        const id = drawerIdActual;
        if (!id) return;
        cerrarDrawer();
        setTimeout(() => abrirEditarTarea(id), 50);
    }

    function renderComentariosDrawer(id) {
        const comms = getComentarios();
        const lista = comms[id] || [];
        const dComm = document.getElementById("dComentarios");
        if (!lista.length) {
            dComm.innerHTML = `<div style="font-size:12px;color:#9ca3af;margin-bottom:8px">Sin comentarios aún.</div>`;
        } else {
            dComm.innerHTML = lista.map(c => `
                <div class="comment-item">
                    <div>${esc(c.texto)}</div>
                    <div class="comment-meta">${esc(c.quien)} · ${formatFechaHora(c.cuando)}</div>
                </div>`).join("");
        }
    }

    function agregarComentario() {
        if (!drawerIdActual) return;
        const inp  = document.getElementById("dCommentInput");
        const txt  = inp.value.trim();
        if (!txt) return;
        const comms = getComentarios();
        if (!comms[drawerIdActual]) comms[drawerIdActual] = [];
        comms[drawerIdActual].push({
            texto: txt,
            quien: usuario?.nombre || "Usuario",
            cuando: new Date().toISOString()
        });
        saveComentarios(comms);
        inp.value = "";
        renderComentariosDrawer(drawerIdActual);
    }

    function formatFechaHora(iso) {
        if (!iso) return "—";
        try {
            const d = new Date(iso);
            return d.toLocaleDateString("es-GT", { day:"2-digit", month:"short", year:"numeric" })
                 + " " + d.toLocaleTimeString("es-GT", { hour:"2-digit", minute:"2-digit" });
        } catch { return iso; }
    }


    /* ═══════════════════════════════════════════
       USUARIOS — TABLA
    ═══════════════════════════════════════════ */
    let todosUsuarios = [];

    async function cargarTablaUsuarios() {
        const tbody = document.getElementById("usuariosBody");
        tbody.innerHTML = `<tr class="loading-row"><td colspan="4">Cargando...</td></tr>`;

        const { data, error } = await supabaseClient
            .from("usuarios")
            .select("id, nombre, correo, rol, activo, contraseña")
            .order("nombre");

        if (error) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444;padding:20px 16px">Error al cargar usuarios.</td></tr>`;
            return;
        }

        if (!data || !data.length) {
            tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No hay usuarios registrados.</div></td></tr>`;
            return;
        }

        todosUsuarios = data;

        tbody.innerHTML = data.map(u => `
            <tr class="clickable-row" onclick="abrirFichaUsuario(${u.id})" style="cursor:pointer">
                <td data-label="Nombre"><strong>${esc(u.nombre||"—")}</strong></td>
                <td data-label="Correo" style="color:#6b7280">${esc(u.correo||"—")}</td>
                <td data-label="Rol"><span class="asignado-chip">${esc(u.rol||"—")}</span></td>
                <td data-label="Estado">
                    <span class="status-dot ${u.activo ? 'dot-active' : 'dot-inactive'}"></span>
                    ${u.activo ? "Activo" : "Inactivo"}
                </td>
            </tr>`).join("");
    }

    /* ═══════════════════════════════════════════
       NUEVO USUARIO
    ═══════════════════════════════════════════ */
    function abrirModalNuevoUsuario() {
        document.getElementById("nuNombre").value   = "";
        document.getElementById("nuCorreo").value   = "";
        document.getElementById("nuPassword").value = "";
        document.getElementById("nuRol").value      = "usuario";
        document.getElementById("nuMsg").textContent = "";
        document.getElementById("nuGuardar").disabled = false;
        document.getElementById("modalNuevoUsuario").classList.add("open");
    }

    function cerrarModalNuevoUsuario() {
        document.getElementById("modalNuevoUsuario").classList.remove("open");
    }

    async function guardarNuevoUsuario() {
        const nombre   = document.getElementById("nuNombre").value.trim();
        const correo   = document.getElementById("nuCorreo").value.trim();
        const password = document.getElementById("nuPassword").value.trim();
        const rol      = document.getElementById("nuRol").value;

        if (!nombre || !correo || !password) {
            document.getElementById("nuMsg").textContent = "⚠ Nombre, correo y contraseña son obligatorios.";
            document.getElementById("nuMsg").style.color = "#ef4444";
            return;
        }

        const btn = document.getElementById("nuGuardar");
        btn.disabled = true;
        document.getElementById("nuMsg").textContent = "Guardando...";
        document.getElementById("nuMsg").style.color = "#6b7280";

        const { error } = await supabaseClient.from("usuarios").insert([{
            nombre, correo, contraseña: password, rol, activo: true
        }]);

        if (error) {
            document.getElementById("nuMsg").textContent = "❌ " + error.message;
            document.getElementById("nuMsg").style.color = "#ef4444";
            btn.disabled = false;
            return;
        }

        document.getElementById("nuMsg").textContent = "✅ Usuario creado correctamente.";
        document.getElementById("nuMsg").style.color = "#10b981";
        await cargarTablaUsuarios();
        await cargarTotalUsuarios();
        setTimeout(() => cerrarModalNuevoUsuario(), 700);
    }

    document.getElementById("modalNuevoUsuario").addEventListener("click", function(e) {
        if (e.target === this) cerrarModalNuevoUsuario();
    });

    /* ═══════════════════════════════════════════
       FICHA USUARIO
    ═══════════════════════════════════════════ */
    function abrirFichaUsuario(id) {
        const u = todosUsuarios.find(x => x.id === id);
        if (!u) return;
        document.getElementById("fuId").value                = u.id;
        document.getElementById("fuNombreTitle").textContent = u.nombre || "—";
        document.getElementById("fuNombre").value            = u.nombre    || "";
        document.getElementById("fuCorreo").value            = u.correo    || "";
        document.getElementById("fuPassword").value          = "";
        document.getElementById("fuRol").value               = u.rol       || "usuario";
        document.getElementById("fuActivo").value            = String(u.activo ?? true);
        document.getElementById("fuMsg").textContent         = "";
        document.getElementById("fuGuardar").disabled        = false;
        document.getElementById("modalFichaUsuario").classList.add("open");
    }

    function cerrarModalFichaUsuario() {
        document.getElementById("modalFichaUsuario").classList.remove("open");
    }

    async function guardarFichaUsuario() {
        const id     = parseInt(document.getElementById("fuId").value);
        const nombre = document.getElementById("fuNombre").value.trim();
        const correo = document.getElementById("fuCorreo").value.trim();
        const rol    = document.getElementById("fuRol").value;
        const activo = document.getElementById("fuActivo").value === "true";
        const pass   = document.getElementById("fuPassword").value.trim();

        if (!nombre || !correo) {
            document.getElementById("fuMsg").textContent = "⚠ Nombre y correo son obligatorios.";
            document.getElementById("fuMsg").style.color = "#ef4444";
            return;
        }

        const btn = document.getElementById("fuGuardar");
        btn.disabled = true;
        document.getElementById("fuMsg").textContent = "Guardando...";
        document.getElementById("fuMsg").style.color = "#6b7280";

        const payload = { nombre, correo, rol, activo };
        if (pass) payload.contraseña = pass;

        const { error } = await supabaseClient.from("usuarios").update(payload).eq("id", id);

        if (error) {
            document.getElementById("fuMsg").textContent = "❌ " + error.message;
            document.getElementById("fuMsg").style.color = "#ef4444";
            btn.disabled = false;
            return;
        }

        document.getElementById("fuMsg").textContent = "✅ Guardado correctamente.";
        document.getElementById("fuMsg").style.color = "#10b981";
        await cargarTablaUsuarios();
        await cargarTotalUsuarios();
        setTimeout(() => cerrarModalFichaUsuario(), 700);
    }

    async function eliminarUsuario() {
        const id = parseInt(document.getElementById("fuId").value);
        if (id === usuario?.id) {
            alert("No puedes eliminar tu propio usuario.");
            return;
        }
        if (!confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) return;
        const { error } = await supabaseClient.from("usuarios").delete().eq("id", id);
        if (error) { alert("Error al eliminar: " + error.message); return; }
        cerrarModalFichaUsuario();
        await cargarTablaUsuarios();
        await cargarTotalUsuarios();
    }

    document.getElementById("modalFichaUsuario").addEventListener("click", function(e) {
        if (e.target === this) cerrarModalFichaUsuario();
    });


    /* ═══════════════════════════════════════════
       VISTA DE ACTIVIDADES (tabla | kanban)
    ═══════════════════════════════════════════ */
    const VISTA_KEY = "alterna_vista_actividades";

    function getVistaActividades() {
        return preferenciasUsuario.vista_actividades || localStorage.getItem(VISTA_KEY) || "tabla";
    }

    function setVistaActividades(modo) {
        localStorage.setItem(VISTA_KEY, modo);
        preferenciasUsuario.vista_actividades = modo;
        aplicarVistaActividades(modo);
        if (modo === "kanban") renderKanban();
        else { paginaTabla = 1; renderTabla(); }
        guardarConfiguracionUsuario(false);
    }

    function aplicarVistaActividades(modo) {
        const tablaWrap  = document.getElementById("actividadesTablaWrap");
        const kanbanWrap = document.getElementById("actividadesKanbanWrap");
        if (!tablaWrap || !kanbanWrap) return;

        if (modo === "kanban") {
            tablaWrap.style.display  = "none";
            kanbanWrap.classList.add("active");
        } else {
            tablaWrap.style.display  = "";
            kanbanWrap.classList.remove("active");
        }

        const btnTabla  = document.getElementById("btnVistaTabla");
        const btnKanban = document.getElementById("btnVistaKanban");
        if (btnTabla)  btnTabla.classList.toggle("active",  modo === "tabla");
        if (btnKanban) btnKanban.classList.toggle("active", modo === "kanban");

        document.querySelectorAll(".vista-cfg-btn").forEach(btn => {
            const activo = btn.dataset.vista === modo;
            btn.style.borderColor = activo ? "#6366f1" : "#e5e7eb";
            btn.style.background  = activo ? "#f5f3ff" : "white";
            btn.style.color       = activo ? "#4f46e5" : "#374151";
        });

        const cfgLabel = document.getElementById("cfgVistaLabel");
        if (cfgLabel) cfgLabel.textContent = modo === "kanban" ? "Kanban" : "Tabla";
    }

    function renderKanban() {
        const busq       = (document.getElementById("busqueda")?.value || "").toLowerCase();
        const asignado   = document.getElementById("filtroAsignado")?.value || "";
        const prioridad  = document.getElementById("filtroPrioridad")?.value || "";
        const area       = document.getElementById("filtroArea")?.value || "";
        const fechaDesde = document.getElementById("filtroFechaDesde")?.value || "";
        const fechaHasta = document.getElementById("filtroFechaHasta")?.value || "";

        const ordenPrio = { "Alta":0, "Media":1, "Baja":2 };
        const hoy = new Date(); hoy.setHours(0,0,0,0);

        let filtradas = todasActividades.filter(a => {
            if (prioridad && a.prioridad !== prioridad) return false;
            if (area      && a.area      !== area)      return false;
            if (asignado && !(a.asignado||"").toLowerCase().includes(asignado.toLowerCase())) return false;
            if (busq) {
                const h = `${a.actividad} ${a.proyecto_macro} ${a.area} ${a.asignado} ${a.notas}`.toLowerCase();
                if (!h.includes(busq)) return false;
            }
            if (fechaDesde && a.fecha_limite && a.fecha_limite < fechaDesde) return false;
            if (fechaHasta && a.fecha_limite && a.fecha_limite > fechaHasta) return false;
            return true;
        });

        filtradas.sort((a,b) => (ordenPrio[a.prioridad]??3) - (ordenPrio[b.prioridad]??3));

        const cols = {
            "No iniciado": { id: "kColNoIniciado", cnt: "kCntNoIniciado", items: [] },
            "En proceso":  { id: "kColEnProceso",  cnt: "kCntEnProceso",  items: [] },
            "Terminado":   { id: "kColTerminado",  cnt: "kCntTerminado",  items: [] },
        };

        filtradas.forEach(a => {
            if (cols[a.estado]) cols[a.estado].items.push(a);
        });

        document.getElementById("filterCount").textContent =
            `${filtradas.length} de ${todasActividades.length} actividades`;

        Object.values(cols).forEach(col => {
            document.getElementById(col.cnt).textContent = col.items.length;

            if (!col.items.length) {
                document.getElementById(col.id).innerHTML =
                    `<div class="kanban-empty">Sin actividades</div>`;
                return;
            }

            document.getElementById(col.id).innerHTML = col.items.map(a => {
                const vencida = a.fecha_limite && new Date(a.fecha_limite+"T00:00:00") < hoy && a.estado !== "Terminado";
                const { texto: fechaTxt } = a.estado === "Terminado"
                    ? { texto: formatFecha(a.fecha_finalizacion) || "—" }
                    : fechaRelativa(a.fecha_limite, a.estado);

                return `<div class="kanban-card" onclick="abrirDrawer(${a.id})">
                    <div class="kanban-card-title">${esc(a.actividad)}</div>
                    <div class="kanban-card-meta">${esc(a.proyecto_macro || a.area || "")}</div>
                    <div class="kanban-card-footer">
                        ${badgePrioridad(a.prioridad)}
                        <span class="asignado-chip" style="font-size:10px">${esc(a.asignado||"—")}</span>
                        ${a.fecha_limite || a.fecha_finalizacion
                            ? `<span style="font-size:10px;color:${vencida?"#ef4444":"#9ca3af"};white-space:nowrap">${esc(fechaTxt)}</span>`
                            : ""}
                    </div>
                </div>`;
            }).join("");
        });
    }


    /* ═══════════════════════════════════════════
       PERÍODO DE REPORTES
    ═══════════════════════════════════════════ */
    const PERIODO_KEY = "alterna_periodo_reportes";

    function getPeriodo() {
        if (preferenciasUsuario.periodo_reportes !== undefined && preferenciasUsuario.periodo_reportes !== null) return Number(preferenciasUsuario.periodo_reportes) || 0;
        const val = localStorage.getItem(PERIODO_KEY);
        return val !== null ? parseInt(val) : 0;
    }

    const PERIODO_LABELS = { 0: "Todas", 7: "1 semana", 14: "2 semanas", 30: "1 mes", 90: "3 meses" };

    function setPeriodo(dias) {
        localStorage.setItem(PERIODO_KEY, dias);
        preferenciasUsuario.periodo_reportes = Number(dias);
        sincronizarBotonesPeriodo();
        renderReportes();
        guardarConfiguracionUsuario(false);
    }

    function filtrarActividadesPorPeriodo() {
        const dias = getPeriodo();
        if (!dias) return todasActividades;
        const corte = new Date();
        corte.setDate(corte.getDate() - dias);
        return todasActividades.filter(a => {
            const fecha = a.fecha_inicio || a.created_at || a.fecha_limite;
            if (!fecha) return true;
            return new Date(fecha) >= corte;
        });
    }

    function sincronizarBotonesPeriodo() {
        const periodo = getPeriodo();
        const label   = PERIODO_LABELS[periodo] || "Todas";

        document.querySelectorAll("#reportePeriodoButtons .periodo-btn").forEach(btn => {
            btn.classList.toggle("active", parseInt(btn.dataset.periodo) === periodo);
        });
        const badge = document.getElementById("reportePeriodoBadge");
        if (badge) badge.textContent = label;
        const cfgLabel = document.getElementById("cfgPeriodoLabel");
        if (cfgLabel) cfgLabel.textContent = label;
    }


    /* ═══════════════════════════════════════════
       PREFERENCIAS Y CONFIGURACIÓN
    ═══════════════════════════════════════════ */
    const SETTINGS_TABLE = "configuraciones_usuario";
    const PREFS_KEY      = "alterna_prefs";

    let prefsLocales = {};
    try { prefsLocales = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); } catch { prefsLocales = {}; }

    let preferenciasUsuario = {
        // Originales
        vista_actividades: localStorage.getItem(VISTA_KEY) || "tabla",
        periodo_reportes: Number(localStorage.getItem(PERIODO_KEY) ?? 0),
        tema: localStorage.getItem("alterna_tema") || "claro",
        notif_vencidas: true, notif_proximas: true, notif_resumen: true,
        // Apariencia
        tamano_texto: "normal",          // compacto | normal | grande
        densidad: "comoda",              // comoda | compacta
        pagina_inicio: "dashboard",      // dashboard | actividades | mantenimientos
        // Actividades
        registros_pagina: 25,            // 10 | 25 | 50 | 100
        dias_alerta: 3,                  // 1 | 3 | 5 | 7
        completadas_dashboard: 6,        // 0 = ocultar panel
        // Notificaciones
        notif_navegador: true,
        notif_frecuencia: 0,             // 0 = solo al abrir; si no, minutos entre recordatorios
        notif_sonido: false,
        // Mantenimientos
        mant_vista: "cal",               // cal | list
        mant_primer_dia: 0,              // 0 = domingo, 1 = lunes
        mant_ocultar_cancelados: false,
        // Exportación
        export_formato: "xlsx",          // xlsx | pdf
        export_notas: true,
        export_prefijo: "actividades",
        // Seguridad
        inactividad_min: 0,              // 0 = desactivado
        ...prefsLocales                  // lo guardado en este navegador tiene prioridad
    };
    let settingsSyncReady = false;
    let settingsSaveTimer = null;

    /* Navegación interna del panel de Configuración (sidebar izquierda) */
    function cfgNavegar(panel) {
        document.querySelectorAll(".cfg-nav-item").forEach(i =>
            i.classList.toggle("active", i.dataset.panel === panel));
        document.querySelectorAll(".cfg-panel").forEach(p =>
            p.classList.toggle("active", p.id === "cfg-panel-" + panel));
    }

    function renderConfiguracion() {
        const nombre = usuario?.nombre || "—", correo = usuario?.correo || "—", rol = usuario?.rol || "—";
        ["cfgNombre", "cfgNombreRow"].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=nombre; });
        ["cfgCorreo", "cfgCorreoRow"].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=correo; });
        const rolHero=document.getElementById("cfgRolBadge"), rolRow=document.getElementById("cfgRol");
        if(rolHero) rolHero.textContent=rol; if(rolRow) rolRow.textContent=rol;
        const urlChip=document.getElementById("cfgUrl"); if(urlChip) urlChip.textContent=SUPABASE_URL;
        const total=document.getElementById("cfgTotal"); if(total) total.textContent=todasActividades.length+" registros";
        aplicarPreferenciasEnControles();
        probarConexionSupabase();
        cargarConfiguracionUsuario();
    }

    /* Copia las preferencias a los controles del HTML (los que tienen data-pref) */
    function sincronizarControles() {
        document.querySelectorAll("[data-pref]").forEach(el => {
            const v = preferenciasUsuario[el.dataset.pref];
            if (el.type === "checkbox") el.checked = !!v;
            else el.value = String(v ?? "");
        });
    }

    function aplicarPreferenciasEnControles() {
        sincronizarControles();
        aplicarAjustes();
    }

    function aplicarTema(tema) {
        const dark = tema === "oscuro" || (tema === "sistema" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.body.classList.toggle("cfg-dark", !!dark);
        localStorage.setItem("alterna_tema", tema || "claro");
    }

    async function obtenerUsuarioAuth() {
        try { const {data,error}=await supabaseClient.auth.getUser(); if(error) return null; return data?.user || null; }
        catch(_) { return null; }
    }

    async function cargarConfiguracionUsuario() {
        const sync = document.getElementById("cfgSyncEstado");
        const authUser = await obtenerUsuarioAuth();
        if (!authUser) {
            settingsSyncReady = false;
            if (sync) sync.textContent = "Sin sesión de Supabase Auth";
            mostrarEstadoAjustes("Preferencias locales activas. Para sincronizarlas entre dispositivos, la sesión de usuario debe autenticarse con Supabase Auth y habilitar la tabla de ajustes.");
            return;
        }
        const { data, error } = await supabaseClient.from(SETTINGS_TABLE).select("preferencias,updated_at").eq("user_id", authUser.id).maybeSingle();
        if (error) {
            settingsSyncReady = false;
            if (sync) sync.textContent = "Tabla no disponible";
            mostrarEstadoAjustes("No se pudo leer la configuración remota. Ejecuta el SQL de instalación incluido y verifica las políticas RLS.");
            console.warn("Configuración remota:", error.message); return;
        }
        if (data?.preferencias && typeof data.preferencias === "object") {
            preferenciasUsuario = { ...preferenciasUsuario, ...data.preferencias };
        }
        settingsSyncReady = true;
        if (sync) sync.textContent = "Sincronizado";
        aplicarPreferenciasEnControles();
        if (data?.updated_at) mostrarEstadoAjustes("Sincronizado · último guardado: " + new Date(data.updated_at).toLocaleString("es-GT"));
        else mostrarEstadoAjustes("Preferencias sincronizadas con Supabase.");
    }

    function mostrarEstadoAjustes(texto, panel) {
        // Si se pasa un panel específico, actualiza solo ese; de lo contrario,
        // actualiza todos los paneles que no tengan cambios pendientes.
        if (panel) {
            const el = document.getElementById("cfgSaveStatus-" + panel);
            if (el) el.textContent = texto;
        } else {
            document.querySelectorAll(".cfg-save-status").forEach(el => {
                // Solo sobreescribe si no está marcado como "con cambios"
                if (!el.classList.contains("dirty")) el.textContent = texto;
            });
        }
    }

    async function guardarConfiguracionUsuario(manual = false) {
        localStorage.setItem(PREFS_KEY, JSON.stringify(preferenciasUsuario));
        localStorage.setItem(VISTA_KEY, preferenciasUsuario.vista_actividades || "tabla");
        localStorage.setItem(PERIODO_KEY, String(preferenciasUsuario.periodo_reportes ?? 0));
        localStorage.setItem("alterna_tema", preferenciasUsuario.tema || "claro");

        if (!manual && settingsSaveTimer) clearTimeout(settingsSaveTimer);
        if (!manual) { settingsSaveTimer = setTimeout(() => guardarConfiguracionUsuario(true), 700); return; }

        const authUser = await obtenerUsuarioAuth();
        if (!authUser) {
            // Guardado solo local; guardarSeccion mostrará su propio mensaje
            return;
        }
        const { error } = await supabaseClient.from(SETTINGS_TABLE).upsert(
            { user_id: authUser.id, preferencias: preferenciasUsuario, updated_at: new Date().toISOString() },
            { onConflict: "user_id" });
        if (error) {
            mostrarEstadoAjustes("No se pudo sincronizar: " + error.message);
            console.error("Guardar configuración:", error);
            return;
        }
        settingsSyncReady = true;
        const sync = document.getElementById("cfgSyncEstado");
        if (sync) sync.textContent = "Sincronizado";
        // No sobreescribimos el status aquí; guardarSeccion lo hace con
        // formato de hora y contexto de sección.
    }

    async function probarConexionSupabase() {
        const badge = document.getElementById("cfgEstado"), last = document.getElementById("cfgUltimaPrueba");
        if (badge) { badge.className = "cfg-status-badge"; badge.innerHTML = '<span class="dot"></span> Comprobando…'; }
        let ok = false, detalle = "";
        try { const { error } = await supabaseClient.from("actividades").select("id", { head: true, count: "exact" }); ok = !error; detalle = error?.message || "OK"; }
        catch (e) { detalle = e?.message || "Error de conexión"; }
        if (badge) { badge.className = "cfg-status-badge " + (ok ? "ok" : "err"); badge.innerHTML = '<span class="dot"></span> ' + (ok ? "Conectado" : "Sin conexión"); badge.title = detalle; }
        if (last) last.textContent = new Date().toLocaleString("es-GT") + (ok ? " · OK" : " · Error");
        return ok;
    }

    function exportarActividadesCSV() {
        if (!Array.isArray(todasActividades) || !todasActividades.length) { alert("No hay actividades cargadas para exportar."); return; }
        const cols = ["id","actividad","proyecto_macro","area","asignado","prioridad","estado","fecha_limite","fecha_finalizacion","notas"];
        const cell = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
        const csv  = "\uFEFF" + [cols.join(","), ...todasActividades.map(a => cols.map(c => cell(a[c])).join(","))].join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }), url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = "alterna-actividades-" + new Date().toISOString().slice(0,10) + ".csv";
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }


    /* ═══════════════════════════════════════════
       APLICACIÓN DE AJUSTES
    ═══════════════════════════════════════════ */
    function setPref(clave, valor) {
        preferenciasUsuario[clave] = valor;
        aplicarAjustes();
        // NO se guarda aquí. guardarSeccion() lo hace cuando el usuario
        // pulsa el botón explícito de cada panel.
    }

    function aplicarAjustes() {
        const p = preferenciasUsuario;
        const html = document.documentElement;

        html.classList.toggle("texto-compacto", p.tamano_texto === "compacto");
        html.classList.toggle("texto-grande",   p.tamano_texto === "grande");
        document.body.classList.toggle("tabla-compacta", p.densidad === "compacta");
        aplicarTema(p.tema || "claro");

        POR_PAGINA  = Number(p.registros_pagina) || 25;
        paginaTabla = 1;

        // Auditoría solo visible para administradores
        const navAud = document.querySelector('.cfg-nav-item[data-panel="auditoria"]');
        if (navAud) navAud.style.display = usuario?.rol === "admin" ? "" : "none";

        aplicarVistaActividades(getVistaActividades());
        sincronizarBotonesPeriodo();
        switchMantView(p.mant_vista || "cal");

        if (todasActividades.length) {
            renderActividadReciente();
            renderTabla();
            renderReportes();
            renderNotificaciones();
        }

        sincronizarControles();
        programarRecordatorios();
    }

    /* ═══════════════════════════════════════════
       GUARDADO POR SECCIÓN
       Cada panel de configuración tiene su propio
       botón de guardar. cfgCambio marca la sección
       como sucia; guardarSeccion la persiste.
    ═══════════════════════════════════════════ */

    // Mapeo: qué claves de preferencia pertenecen a cada sección
    const PREFS_POR_SECCION = {
        general:       ["tema", "tamano_texto", "densidad", "pagina_inicio"],
        actividades:   ["vista_actividades", "registros_pagina", "completadas_dashboard", "periodo_reportes"],
        mantenimientos:["mant_vista", "mant_primer_dia", "mant_ocultar_cancelados"],
        exportacion:   ["export_formato", "export_notas", "export_prefijo"],
        seguridad:     ["inactividad_min"],
        notificaciones:["notif_vencidas", "notif_proximas", "dias_alerta", "notif_navegador", "notif_resumen", "notif_frecuencia", "notif_sonido"],
    };

    // Detecta a qué panel pertenece un elemento y activa su botón de guardar
    function cfgCambio(el) {
        const panel = el.closest(".cfg-panel");
        if (!panel) return;
        const id = panel.id.replace("cfg-panel-", "");
        const btn    = document.getElementById("cfgSaveBtn-" + id);
        const status = document.getElementById("cfgSaveStatus-" + id);
        if (btn) { btn.disabled = false; btn.classList.add("has-changes"); }
        if (status) {
            status.textContent = "Tienes cambios sin guardar.";
            status.classList.add("dirty");
        }
    }

    // Guarda todas las preferencias y marca esa sección como limpia
    async function guardarSeccion(panel) {
        const btn    = document.getElementById("cfgSaveBtn-" + panel);
        const status = document.getElementById("cfgSaveStatus-" + panel);

        // Deshabilitar mientras guarda
        if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; btn.classList.remove("has-changes"); }
        if (status) { status.textContent = "Guardando…"; status.classList.remove("dirty"); }

        // Guardar en localStorage + Supabase
        await guardarConfiguracionUsuario(true);

        // Actualizar estado del botón según resultado
        const sincrono = document.getElementById("cfgSyncEstado");
        const ok = sincrono ? sincrono.textContent.toLowerCase().includes("sincroniz") : true;

        if (btn) { btn.disabled = true; btn.textContent = "Guardar preferencias"; }
        if (status) {
            status.textContent = ok
                ? "✓ Guardado · " + new Date().toLocaleTimeString("es-GT", { hour:"2-digit", minute:"2-digit" })
                : "Guardado localmente (sin conexión a Supabase).";
            status.classList.remove("dirty");
        }
    }

    let timerRecordatorios = null;
    function programarRecordatorios() {
        if (timerRecordatorios) clearInterval(timerRecordatorios);
        timerRecordatorios = null;
        const min = Number(preferenciasUsuario.notif_frecuencia) || 0;
        if (!min) return;
        timerRecordatorios = setInterval(() => {
            renderNotificaciones();
            dispararNotifNavegador(notifsVisibles());
        }, min * 60000);
    }

    function reproducirSonidoAlerta() {
        try {
            const ctx  = new (window.AudioContext || window.webkitAudioContext)();
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.08;
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        } catch { /* el navegador puede bloquear audio sin interacción previa */ }
    }

    async function cambiarContrasena() {
        const actual = document.getElementById("cpActual").value;
        const nueva  = document.getElementById("cpNueva").value;
        const conf   = document.getElementById("cpConfirmar").value;
        const msg    = document.getElementById("cpMsg");
        msg.style.color = "#ef4444";

        if (!actual || !nueva || !conf) { msg.textContent = "Completa los tres campos."; return; }
        if (nueva.length < 8)           { msg.textContent = "La nueva contraseña debe tener al menos 8 caracteres."; return; }
        if (nueva !== conf)             { msg.textContent = "La confirmación no coincide."; return; }

        const { data, error } = await supabaseClient
            .from("usuarios").select("contraseña").eq("id", usuario.id).single();
        if (error || !data) { msg.textContent = "No se pudo verificar la contraseña actual."; return; }
        if (data.contraseña !== actual) { msg.textContent = "La contraseña actual no es correcta."; return; }

        const { error: errUpd } = await supabaseClient
            .from("usuarios").update({ contraseña: nueva }).eq("id", usuario.id);
        if (errUpd) { msg.textContent = "❌ " + errUpd.message; return; }

        msg.style.color = "#10b981";
        msg.textContent = "✅ Contraseña actualizada.";
        ["cpActual","cpNueva","cpConfirmar"].forEach(id => document.getElementById(id).value = "");
    }

    // Cierre de sesión por inactividad
    let ultimaActividad = Date.now();
    ["mousemove","keydown","click","scroll","touchstart"].forEach(ev =>
        document.addEventListener(ev, () => { ultimaActividad = Date.now(); }, { passive: true }));

    setInterval(() => {
        const min = Number(preferenciasUsuario.inactividad_min) || 0;
        if (min && Date.now() - ultimaActividad >= min * 60000) {
            localStorage.removeItem("usuario");
            alert("Tu sesión se cerró por inactividad.");
            window.location.href = "index.html";
        }
    }, 15000);


    /* ═══════════════════════════════════════════
       NOTIFICACIONES
    ═══════════════════════════════════════════ */
    function calcularNotificaciones() {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const diasAviso = Number(preferenciasUsuario.dias_alerta) || 3;
        const notifs = [];

        todasActividades.forEach(a => {
            if (!a.fecha_limite || a.estado === "Terminado") return;
            const limite = new Date(a.fecha_limite + "T00:00:00");
            const diff   = Math.round((limite - hoy) / 86400000);

            if (diff < 0) {
                notifs.push({ id: a.id, titulo: a.actividad, tipo: "vencida",
                    meta: `Venció hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? "s" : ""} · ${a.asignado || "Sin asignar"}` });
            } else if (diff <= diasAviso) {
                notifs.push({ id: a.id, titulo: a.actividad, tipo: "proxima",
                    meta: `Vence ${diff === 0 ? "hoy" : `en ${diff} día${diff !== 1 ? "s" : ""}`} · ${a.asignado || "Sin asignar"}` });
            }
        });

        notifs.sort((a,b) => (a.tipo === "vencida" ? -1 : 1));
        return notifs;
    }

    function notifsVisibles() {
        let notifs = calcularNotificaciones();
        if (preferenciasUsuario.notif_vencidas === false) notifs = notifs.filter(n => n.tipo !== "vencida");
        if (preferenciasUsuario.notif_proximas === false) notifs = notifs.filter(n => n.tipo !== "proxima");
        return notifs;
    }

    function renderNotificaciones() {
        const notifs = notifsVisibles();
        const badge  = document.getElementById("notifBadge");
        const list   = document.getElementById("notifList");
        const count  = document.getElementById("notifCount");

        if (notifs.length) {
            badge.textContent   = notifs.length > 9 ? "9+" : notifs.length;
            badge.style.display = "flex";
            count.textContent   = `${notifs.length} pendiente${notifs.length !== 1 ? "s" : ""}`;
            list.innerHTML = notifs.map(n => `
                <div class="notif-item ${n.tipo}" onclick="navegar('actividades');cerrarNotifDropdown()">
                    <div class="notif-item-title">${esc(n.titulo)}</div>
                    <div class="notif-item-meta">${n.tipo === "vencida" ? "🔴" : "🟡"} ${n.meta}</div>
                </div>`).join("");
        } else {
            badge.style.display = "none";
            count.textContent   = "";
            list.innerHTML      = `<div class="notif-empty">✅ Sin actividades vencidas o próximas a vencer</div>`;
        }

        // Con recordatorios periódicos, el temporizador es quien avisa
        const periodica = Number(preferenciasUsuario.notif_frecuencia) > 0;
        if (!periodica && preferenciasUsuario.notif_resumen !== false) dispararNotifNavegador(notifs);
    }

    let notifNavegadorDisparada = false;
    function dispararNotifNavegador(notifs) {
        if (preferenciasUsuario.notif_navegador === false || !notifs.length) return;

        const periodica = Number(preferenciasUsuario.notif_frecuencia) > 0;
        if (!periodica && notifNavegadorDisparada) return;
        notifNavegadorDisparada = true;

        if (preferenciasUsuario.notif_sonido) reproducirSonidoAlerta();

        const vencidas = notifs.filter(n => n.tipo === "vencida").length;
        const proximas = notifs.filter(n => n.tipo === "proxima").length;
        const partes = [];
        if (vencidas) partes.push(`${vencidas} vencida${vencidas !== 1 ? "s" : ""}`);
        if (proximas) partes.push(`${proximas} próxima${proximas !== 1 ? "s" : ""} a vencer`);
        const mensaje = partes.join(" · ");

        if (!("Notification" in window)) return;

        const mostrar = () => new Notification("Alterna — Actividades", {
            body: mensaje,
            icon: "https://cdn-icons-png.flaticon.com/512/1827/1827392.png"
        });

        if (Notification.permission === "granted") mostrar();
        else if (Notification.permission !== "denied")
            Notification.requestPermission().then(p => { if (p === "granted") mostrar(); });
    }

    function toggleNotifDropdown() {
        document.getElementById("notifDropdown").classList.toggle("open");
    }

    function cerrarNotifDropdown() {
        document.getElementById("notifDropdown").classList.remove("open");
    }

    document.addEventListener("click", function(e) {
        const wrap = document.getElementById("notifWrap");
        if (wrap && !wrap.contains(e.target)) cerrarNotifDropdown();
    });


    /* ═══════════════════════════════════════════
       MODAL NUEVA TAREA
    ═══════════════════════════════════════════ */
    function abrirModalNuevaTarea() {
        document.getElementById("modalNuevaTarea").classList.add("open");
        document.getElementById("ntActividad").value   = "";
        document.getElementById("ntProyecto").value    = "";
        document.getElementById("ntArea").value        = "";
        document.getElementById("ntEstado").value      = "No iniciado";
        document.getElementById("ntPrioridad").value   = "Media";
        document.getElementById("ntAsignado").value    = "";
        document.getElementById("ntFecha").value       = "";
        document.getElementById("ntDescripcion").value = "";
        document.getElementById("ntMsg").textContent   = "";
        document.getElementById("ntMsg").style.color   = "";
        document.getElementById("ntGuardar").disabled  = false;
        navegar("actividades");
    }

    function cerrarModal() {
        document.getElementById("modalNuevaTarea").classList.remove("open");
    }

    async function guardarNuevaTarea() {
        const actividad = document.getElementById("ntActividad").value.trim();
        if (!actividad) {
            document.getElementById("ntMsg").textContent = "⚠ El nombre de la actividad es obligatorio.";
            document.getElementById("ntMsg").style.color = "#ef4444";
            return;
        }
        const btn = document.getElementById("ntGuardar");
        btn.disabled = true;
        document.getElementById("ntMsg").textContent = "Guardando...";
        document.getElementById("ntMsg").style.color = "#6b7280";

        const payload = {
            actividad,
            proyecto_macro: document.getElementById("ntProyecto").value.trim()    || null,
            area:           document.getElementById("ntArea").value.trim()        || null,
            estado:         document.getElementById("ntEstado").value,
            prioridad:      document.getElementById("ntPrioridad").value,
            asignado:       document.getElementById("ntAsignado").value.trim()    || null,
            notas:          document.getElementById("ntDescripcion").value.trim() || null,
        };

        const { error } = await supabaseClient.from("actividades").insert([payload]);

        if (error) {
            document.getElementById("ntMsg").textContent = "❌ Error al guardar: " + error.message;
            document.getElementById("ntMsg").style.color = "#ef4444";
            btn.disabled = false;
            return;
        }

        document.getElementById("ntMsg").textContent = "✅ Tarea guardada correctamente.";
        document.getElementById("ntMsg").style.color = "#10b981";
        await cargarActividades();
        setTimeout(() => cerrarModal(), 800);
    }

    document.getElementById("modalNuevaTarea").addEventListener("click", function(e) {
        if (e.target === this) cerrarModal();
    });


    /* ═══════════════════════════════════════════
       PÁGINA NUEVA TAREA
    ═══════════════════════════════════════════ */
    function limpiarNuevaTarea() {
        document.getElementById("pntActividad").value  = "";
        document.getElementById("pntProyecto").value   = "";
        document.getElementById("pntArea").value       = "";
        document.getElementById("pntEstado").value     = "No iniciado";
        document.getElementById("pntPrioridad").value  = "Media";
        document.getElementById("pntAsignado").value   = "";
        document.getElementById("pntFecha").value      = "";
        document.getElementById("pntFechaFin").value   = "";
        document.getElementById("pntNotas").value      = "";
        document.getElementById("pntMsg").textContent  = "";
        document.getElementById("pntMsg").style.color  = "";
        document.getElementById("pntGuardar").disabled = false;
        document.getElementById("pntActividad").focus();
    }

    async function guardarPaginaNuevaTarea() {
        const actividad = document.getElementById("pntActividad").value.trim();
        if (!actividad) {
            document.getElementById("pntMsg").textContent = "⚠ El nombre de la actividad es obligatorio.";
            document.getElementById("pntMsg").style.color = "#ef4444";
            document.getElementById("pntActividad").focus();
            return;
        }
        const btn = document.getElementById("pntGuardar");
        btn.disabled = true;
        document.getElementById("pntMsg").textContent = "Guardando...";
        document.getElementById("pntMsg").style.color = "#6b7280";

        const payload = {
            actividad,
            proyecto_macro:     document.getElementById("pntProyecto").value.trim()   || null,
            area:               document.getElementById("pntArea").value.trim()       || null,
            estado:             document.getElementById("pntEstado").value,
            prioridad:          document.getElementById("pntPrioridad").value,
            asignado:           document.getElementById("pntAsignado").value.trim()   || null,
            fecha_limite:       document.getElementById("pntFecha").value             || null,
            fecha_finalizacion: document.getElementById("pntFechaFin").value          || null,
            notas:              document.getElementById("pntNotas").value.trim()      || null,
        };

        const { error } = await supabaseClient.from("actividades").insert([payload]);
        if (error) {
            document.getElementById("pntMsg").textContent = "❌ Error: " + error.message;
            document.getElementById("pntMsg").style.color = "#ef4444";
            btn.disabled = false;
            return;
        }

        document.getElementById("pntMsg").textContent = "✅ Tarea guardada correctamente.";
        document.getElementById("pntMsg").style.color = "#10b981";
        await cargarActividades();
        setTimeout(() => limpiarNuevaTarea(), 1200);
    }


    /* ═══════════════════════════════════════════
       EDITAR TAREA
    ═══════════════════════════════════════════ */
    function abrirEditarTarea(id) {
        const a = todasActividades.find(x => x.id === id);
        if (!a) return;
        document.getElementById("etId").value         = a.id;
        document.getElementById("etActividad").value  = a.actividad        || "";
        document.getElementById("etProyecto").value   = a.proyecto_macro   || "";
        document.getElementById("etArea").value       = a.area             || "";
        document.getElementById("etEstado").value     = a.estado           || "No iniciado";
        document.getElementById("etPrioridad").value  = a.prioridad        || "Media";
        const etSel = document.getElementById("etAsignado");
        const asignadoVal = a.asignado || "";
        if (asignadoVal && ![...etSel.options].some(o => o.value === asignadoVal)) {
            const opt = document.createElement("option");
            opt.value = asignadoVal; opt.textContent = asignadoVal;
            etSel.appendChild(opt);
        }
        etSel.value = asignadoVal;
        document.getElementById("etFecha").value      = a.fecha_limite       || "";
        document.getElementById("etFechaFin").value   = a.fecha_finalizacion || "";
        document.getElementById("etNotas").value      = a.notas            || "";
        document.getElementById("etMsg").textContent  = "";
        document.getElementById("etMsg").style.color  = "";
        document.getElementById("etGuardar").disabled = false;
        document.getElementById("modalEditarTarea").classList.add("open");
    }

    function cerrarModalEditar() {
        document.getElementById("modalEditarTarea").classList.remove("open");
    }

    async function guardarEditarTarea() {
        const id = parseInt(document.getElementById("etId").value);
        const actividad = document.getElementById("etActividad").value.trim();
        if (!actividad) {
            document.getElementById("etMsg").textContent = "⚠ El nombre es obligatorio.";
            document.getElementById("etMsg").style.color = "#ef4444";
            return;
        }
        const btn = document.getElementById("etGuardar");
        btn.disabled = true;
        document.getElementById("etMsg").textContent = "Guardando...";
        document.getElementById("etMsg").style.color = "#6b7280";

        const payload = {
            actividad,
            proyecto_macro:     document.getElementById("etProyecto").value.trim()  || null,
            area:               document.getElementById("etArea").value.trim()      || null,
            estado:             document.getElementById("etEstado").value,
            prioridad:          document.getElementById("etPrioridad").value,
            asignado:           document.getElementById("etAsignado").value.trim()  || null,
            fecha_limite:       document.getElementById("etFecha").value            || null,
            fecha_finalizacion: document.getElementById("etFechaFin").value         || null,
            notas:              document.getElementById("etNotas").value.trim()     || null,
        };

        const anterior = todasActividades.find(x => x.id === id) || {};
        const camposLabel = {
            actividad: "Actividad", proyecto_macro: "Proyecto", area: "Área",
            estado: "Estado", prioridad: "Prioridad", asignado: "Asignado",
            fecha_limite: "Fecha límite", fecha_finalizacion: "Finalización", notas: "Notas"
        };
        const cambios = Object.keys(payload)
            .filter(k => (payload[k]||"") !== (anterior[k]||""))
            .map(k => ({ campo: camposLabel[k]||k, anterior: anterior[k]||"—", nuevo: payload[k]||"—" }));

        const { error } = await supabaseClient.from("actividades").update(payload).eq("id", id);
        if (error) {
            document.getElementById("etMsg").textContent = "❌ " + error.message;
            document.getElementById("etMsg").style.color = "#ef4444";
            btn.disabled = false;
            return;
        }

        if (cambios.length) await registrarHistorial(id, "editó", cambios);

        document.getElementById("etMsg").textContent = "✅ Guardado correctamente.";
        document.getElementById("etMsg").style.color = "#10b981";
        await cargarActividades();
        setTimeout(() => cerrarModalEditar(), 700);
    }

    async function eliminarTarea() {
        const id = parseInt(document.getElementById("etId").value);
        if (!confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
        const anterior = todasActividades.find(x => x.id === id);
        await registrarHistorial(id, "eliminó", [{ campo: "Actividad", anterior: anterior?.actividad || "—", nuevo: "—" }]);
        const { error } = await supabaseClient.from("actividades").delete().eq("id", id);
        if (error) { alert("Error al eliminar: " + error.message); return; }
        cerrarModalEditar();
        await cargarActividades();
    }

    document.getElementById("modalEditarTarea").addEventListener("click", function(e) {
        if (e.target === this) cerrarModalEditar();
    });


    /* ═══════════════════════════════════════════
       LICENCIAS — OFFICE
    ═══════════════════════════════════════════ */
    let todasLicenciasOffice = [];

    async function cargarLicenciasOffice() {
        const tbody = document.getElementById("officeBody");
        if (!tbody) return;
        tbody.innerHTML = `<tr class="loading-row"><td colspan="9">Cargando...</td></tr>`;

        const { data, error } = await supabaseClient
            .from("licencias_office")
            .select("*")
            .order("numero_licencia, slot");

        if (error) {
            tbody.innerHTML = `<tr><td colspan="9" style="color:#ef4444;padding:20px 16px">Error al cargar: ${error.message}</td></tr>`;
            return;
        }

        todasLicenciasOffice = data || [];
        poblarFiltroLicencia();
        renderTablaOffice();
    }

    function poblarFiltroLicencia() {
        const lics = [...new Set(todasLicenciasOffice.map(r => r.numero_licencia).filter(Boolean))].sort();
        const sel = document.getElementById("officeFiltroLic");
        sel.innerHTML = `<option value="">Todas las licencias</option>` +
            lics.map(l => `<option value="${l}">Licencia ${l}</option>`).join("");
    }

    function renderTablaOffice() {
        const tbody = document.getElementById("officeBody");
        if (!tbody) return;
        const q    = (document.getElementById("officeBusqueda")?.value || "").toLowerCase();
        const flic = document.getElementById("officeFiltroLic")?.value || "";

        const rows = todasLicenciasOffice.filter(r => {
            const matchLic = !flic || String(r.numero_licencia) === flic;
            const matchQ   = !q ||
                (r.nombre||"").toLowerCase().includes(q) ||
                (r.correo||"").toLowerCase().includes(q) ||
                (r.nombre_cuenta||"").toLowerCase().includes(q) ||
                (r.tipo||"").toLowerCase().includes(q);
            return matchLic && matchQ;
        });

        document.getElementById("officeCount").textContent = `${rows.length} registro${rows.length !== 1 ? "s" : ""}`;

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">No se encontraron licencias.</div></td></tr>`;
            return;
        }

        let lastLic = null;
        tbody.innerHTML = rows.map(r => {
            let sep = "";
            if (r.numero_licencia !== lastLic) {
                lastLic = r.numero_licencia;
                sep = `<tr style="background:#f0f4ff">
                    <td colspan="10" style="padding:8px 16px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.06em">
                        📦 Licencia ${esc(String(r.numero_licencia || "—"))}
                    </td>
                </tr>`;
            }
            const expBadge = r.fecha_expiracion
                ? `<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:600">${esc(r.fecha_expiracion)}</span>`
                : `<span style="color:#9ca3af">—</span>`;
            return sep + `<tr>
                <td data-label="Slot" style="color:#9ca3af;font-weight:600">${esc(String(r.slot||"—"))}</td>
                <td data-label="Nombre"><strong>${esc(r.nombre||"—")}</strong></td>
                <td data-label="Tipo"><span class="asignado-chip" style="background:#e0e7ff;color:#3730a3">${esc(r.tipo||"—")}</span></td>
                <td data-label="Correo" style="color:#6b7280;font-size:12px">${esc(r.correo||"—")}</td>
                <td data-label="Cuenta" style="font-size:12px">${esc(r.nombre_cuenta||"—")}</td>
                <td data-label="Expiración">${expBadge}</td>
                <td data-label="País" style="font-size:12px;color:#374151">${esc(r.pais||"—")}</td>
                <td data-label="Contacto" style="font-size:11px;color:#9ca3af">${esc(r.contacto||"—")}</td>
                <td data-label="N° Lic." style="font-size:11px;color:#6366f1;font-weight:600">${esc(String(r.numero_licencia||"—"))}</td>
                <td data-label=""><button class="btn-edit" onclick="abrirEditarOffice(${r.id})">✏ Editar</button></td>
            </tr>`;
        }).join("");
    }

    function abrirEditarOffice(id) {
        const r = todasLicenciasOffice.find(x => x.id === id);
        if (!r) return;
        document.getElementById("eoId").value           = r.id;
        document.getElementById("eoNumLic").value       = r.numero_licencia  || "";
        document.getElementById("eoSlot").value         = r.slot             || "";
        document.getElementById("eoTipo").value         = r.tipo             || "";
        document.getElementById("eoNombre").value       = r.nombre           || "";
        document.getElementById("eoNombreCuenta").value = r.nombre_cuenta    || "";
        document.getElementById("eoCorreo").value       = r.correo           || "";
        document.getElementById("eoPassword").value     = r.password         || "";
        document.getElementById("eoExpiracion").value   = r.fecha_expiracion || "";
        document.getElementById("eoFechaNac").value     = r.fecha_nacimiento || "";
        document.getElementById("eoPais").value         = r.pais             || "";
        document.getElementById("eoContacto").value     = r.contacto         || "";
        document.getElementById("eoPin").value          = r.pin              || "";
        document.getElementById("eoNotas").value        = [r.recuperacion_zoho, r.notas].filter(Boolean).join(" | ") || "";
        document.getElementById("eoMsg").textContent    = "";
        document.getElementById("eoMsg").style.color    = "";
        document.getElementById("eoGuardar").disabled   = false;
        document.getElementById("modalEditarOffice").classList.add("open");
    }

    function cerrarModalEditarOffice() {
        document.getElementById("modalEditarOffice").classList.remove("open");
    }

    async function guardarEditarOffice() {
        const id  = parseInt(document.getElementById("eoId").value);
        const btn = document.getElementById("eoGuardar");
        btn.disabled = true;
        document.getElementById("eoMsg").textContent = "Guardando...";
        document.getElementById("eoMsg").style.color = "#6b7280";

        const notasRaw = document.getElementById("eoNotas").value.trim();
        const payload = {
            numero_licencia:  parseInt(document.getElementById("eoNumLic").value)       || null,
            slot:             document.getElementById("eoSlot").value.trim()            || null,
            tipo:             document.getElementById("eoTipo").value.trim()            || null,
            nombre:           document.getElementById("eoNombre").value.trim()          || null,
            nombre_cuenta:    document.getElementById("eoNombreCuenta").value.trim()    || null,
            correo:           document.getElementById("eoCorreo").value.trim()          || null,
            password:         document.getElementById("eoPassword").value               || null,
            fecha_expiracion: document.getElementById("eoExpiracion").value.trim()      || null,
            fecha_nacimiento: document.getElementById("eoFechaNac").value.trim()        || null,
            pais:             document.getElementById("eoPais").value.trim()            || null,
            contacto:         document.getElementById("eoContacto").value.trim()        || null,
            pin:              document.getElementById("eoPin").value.trim()             || null,
            notas:            notasRaw                                                  || null,
        };

        const { error } = await supabaseClient.from("licencias_office").update(payload).eq("id", id);
        if (error) {
            document.getElementById("eoMsg").textContent = "❌ " + error.message;
            document.getElementById("eoMsg").style.color = "#ef4444";
            btn.disabled = false;
            return;
        }
        document.getElementById("eoMsg").textContent = "✅ Guardado correctamente.";
        document.getElementById("eoMsg").style.color = "#10b981";
        await cargarLicenciasOffice();
        setTimeout(() => cerrarModalEditarOffice(), 700);
    }

    async function eliminarOffice() {
        const id = parseInt(document.getElementById("eoId").value);
        if (!confirm("¿Eliminar este registro de licencia? Esta acción no se puede deshacer.")) return;
        const { error } = await supabaseClient.from("licencias_office").delete().eq("id", id);
        if (error) { alert("Error al eliminar: " + error.message); return; }
        cerrarModalEditarOffice();
        await cargarLicenciasOffice();
    }

    document.getElementById("modalEditarOffice").addEventListener("click", function(e) {
        if (e.target === this) cerrarModalEditarOffice();
    });


    /* ═══════════════════════════════════════════
       INVENTARIO DE EQUIPOS
    ═══════════════════════════════════════════ */
    let todosEquipos = [];

    async function cargarEquipos() {
        const tbody = document.getElementById("equiposBody");
        if (!tbody) return;
        tbody.innerHTML = `<tr class="loading-row"><td colspan="6">Cargando...</td></tr>`;
        ["eqCntTotal","eqCntDisponibles","eqCntAsignados","eqCntMantenimiento"]
            .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = "—"; });

        const { data, error } = await supabaseClient
            .from("inventario_equipos")
            .select("*")
            .order("id", { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;padding:20px 16px">Error al cargar: ${error.message}</td></tr>`;
            return;
        }

        todosEquipos = data || [];
        renderTablaEquipos();
    }

    function badgeEquipoEstado(estado) {
        switch (estado) {
            case "Disponible":       return "badge-terminado";
            case "Asignado":         return "badge-en-proceso";
            case "En mantenimiento": return "badge-media";
            case "Dado de baja":     return "badge-alta";
            default:                 return "badge-no-iniciado";
        }
    }

    function actualizarCardsEquipos() {
        const total         = todosEquipos.length;
        const disponibles   = todosEquipos.filter(r => r.estado === "Disponible").length;
        const asignados     = todosEquipos.filter(r => r.estado === "Asignado").length;
        const mantenimiento = todosEquipos.filter(r =>
            r.estado === "En mantenimiento" || r.estado === "Dado de baja"
        ).length;
        document.getElementById("eqCntTotal").textContent         = total;
        document.getElementById("eqCntDisponibles").textContent   = disponibles;
        document.getElementById("eqCntAsignados").textContent     = asignados;
        document.getElementById("eqCntMantenimiento").textContent = mantenimiento;
    }

    function renderTablaEquipos() {
        const tbody = document.getElementById("equiposBody");
        if (!tbody) return;
        const q       = (document.getElementById("eqBusqueda")?.value || "").toLowerCase();
        const fEstado = document.getElementById("eqFiltroEstado")?.value || "";

        actualizarCardsEquipos();

        const rows = todosEquipos.filter(r => {
            const matchEstado = !fEstado || r.estado === fEstado;
            const matchQ = !q ||
                (r.tipo||"").toLowerCase().includes(q) ||
                (r.numero_serie||"").toLowerCase().includes(q) ||
                (r.modelo||"").toLowerCase().includes(q) ||
                (r.marca||"").toLowerCase().includes(q) ||
                (r.asignado_a||"").toLowerCase().includes(q);
            return matchEstado && matchQ;
        });

        document.getElementById("equiposCount").textContent = `${rows.length} equipo${rows.length !== 1 ? "s" : ""}`;

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No se encontraron equipos.</div></td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const asignadoHtml = r.asignado_a
                ? `<span class="asignado-chip">${esc(r.asignado_a)}</span>`
                : `<span style="color:#d1d5db;font-size:12px">—</span>`;
            return `<tr>
                <td data-label="Tipo"><strong>${esc(r.tipo||"—")}</strong></td>
                <td data-label="Marca/Mod" style="font-size:12px;color:#374151">${esc([r.marca, r.modelo].filter(Boolean).join(" ") || "—")}</td>
                <td data-label="Serie" style="font-size:12px;color:#6b7280;font-family:monospace">${esc(r.numero_serie||"—")}</td>
                <td data-label="Estado"><span class="badge ${badgeEquipoEstado(r.estado)}">${esc(r.estado||"—")}</span></td>
                <td data-label="Asignado a">${asignadoHtml}</td>
                <td data-label=""><button class="btn-edit" onclick="abrirEditarEquipo(${r.id})">✏ Editar</button></td>
            </tr>`;
        }).join("");
    }

    /* ── NUEVO EQUIPO ── */
    function abrirModalNuevoEquipo() {
        document.getElementById("neTipo").value      = "";
        document.getElementById("neSerie").value     = "";
        document.getElementById("neMarca").value     = "";
        document.getElementById("neModelo").value    = "";
        document.getElementById("neEstado").value    = "Disponible";
        document.getElementById("neAsignado").value  = "";
        document.getElementById("neFecha").value     = "";
        document.getElementById("neNotas").value     = "";
        document.getElementById("neMsg").textContent = "";
        document.getElementById("neGuardar").disabled = false;
        document.getElementById("modalNuevoEquipo").classList.add("open");
    }

    function cerrarModalNuevoEquipo() {
        document.getElementById("modalNuevoEquipo").classList.remove("open");
    }

    async function guardarNuevoEquipo() {
        const tipo = document.getElementById("neTipo").value.trim();
        if (!tipo) {
            document.getElementById("neMsg").textContent = "⚠ El tipo de equipo es obligatorio.";
            document.getElementById("neMsg").style.color = "#ef4444";
            return;
        }
        const btn = document.getElementById("neGuardar");
        btn.disabled = true;
        document.getElementById("neMsg").textContent = "Guardando...";
        document.getElementById("neMsg").style.color = "#6b7280";

        const payload = {
            tipo,
            numero_serie: document.getElementById("neSerie").value.trim() || null,
            marca:        document.getElementById("neMarca").value.trim() || null,
            modelo:       document.getElementById("neModelo").value.trim() || null,
            estado:       document.getElementById("neEstado").value,
            asignado_a:   document.getElementById("neAsignado").value.trim() || null,
            fecha_compra: document.getElementById("neFecha").value || null,
            notas:        document.getElementById("neNotas").value.trim() || null
        };

        const { error } = await supabaseClient.from("inventario_equipos").insert([payload]);
        if (error) {
            document.getElementById("neMsg").textContent = "❌ " + error.message;
            document.getElementById("neMsg").style.color = "#ef4444";
            btn.disabled = false;
            return;
        }
        await cargarEquipos();
        cerrarModalNuevoEquipo();
        btn.disabled = false;
    }

    document.getElementById("modalNuevoEquipo").addEventListener("click", function(e) {
        if (e.target === this) cerrarModalNuevoEquipo();
    });

    /* ── EDITAR EQUIPO ── */
    function abrirEditarEquipo(id) {
        const r = todosEquipos.find(x => x.id === id);
        if (!r) return;
        document.getElementById("eeId").value         = r.id;
        document.getElementById("eeTipo").value       = r.tipo || "";
        document.getElementById("eeSerie").value      = r.numero_serie || "";
        document.getElementById("eeMarca").value      = r.marca || "";
        document.getElementById("eeModelo").value     = r.modelo || "";
        document.getElementById("eeEstado").value     = r.estado || "Disponible";
        document.getElementById("eeAsignado").value   = r.asignado_a || "";
        document.getElementById("eeFecha").value      = r.fecha_compra || "";
        document.getElementById("eeNotas").value      = r.notas || "";
        document.getElementById("eeMsg").textContent  = "";
        document.getElementById("eeGuardar").disabled = false;
        document.getElementById("modalEditarEquipo").classList.add("open");
    }

    function cerrarModalEditarEquipo() {
        document.getElementById("modalEditarEquipo").classList.remove("open");
    }

    async function guardarEditarEquipo() {
        const id   = parseInt(document.getElementById("eeId").value);
        const tipo = document.getElementById("eeTipo").value.trim();
        if (!tipo) {
            document.getElementById("eeMsg").textContent = "⚠ El tipo de equipo es obligatorio.";
            document.getElementById("eeMsg").style.color = "#ef4444";
            return;
        }

        const btn = document.getElementById("eeGuardar");
        btn.disabled = true;
        document.getElementById("eeMsg").textContent = "Guardando...";
        document.getElementById("eeMsg").style.color = "#6b7280";

        const payload = {
            tipo,
            numero_serie: document.getElementById("eeSerie").value.trim() || null,
            marca:        document.getElementById("eeMarca").value.trim() || null,
            modelo:       document.getElementById("eeModelo").value.trim() || null,
            estado:       document.getElementById("eeEstado").value,
            asignado_a:   document.getElementById("eeAsignado").value.trim() || null,
            fecha_compra: document.getElementById("eeFecha").value || null,
            notas:        document.getElementById("eeNotas").value.trim() || null
        };

        const { error } = await supabaseClient.from("inventario_equipos").update(payload).eq("id", id);
        if (error) {
            document.getElementById("eeMsg").textContent = "❌ " + error.message;
            document.getElementById("eeMsg").style.color = "#ef4444";
            btn.disabled = false;
            return;
        }
        await cargarEquipos();
        cerrarModalEditarEquipo();
    }

    async function eliminarEquipo() {
        const id = parseInt(document.getElementById("eeId").value);
        if (!confirm("¿Eliminar este equipo del inventario? Esta acción no se puede deshacer.")) return;
        const { error } = await supabaseClient.from("inventario_equipos").delete().eq("id", id);
        if (error) { alert("Error al eliminar: " + error.message); return; }
        cerrarModalEditarEquipo();
        await cargarEquipos();
    }

    document.getElementById("modalEditarEquipo").addEventListener("click", function(e) {
        if (e.target === this) cerrarModalEditarEquipo();
    });


    /* ═══════════════════════════════════════════
       CERRAR SESIÓN
    ═══════════════════════════════════════════ */
    function cerrarSesion() {
        localStorage.removeItem("usuario");
        window.location.href = "index.html";
    }


    /* ═══════════════════════════════════════════
       USUARIOS EN SELECTS DE ASIGNADO
    ═══════════════════════════════════════════ */
    async function cargarUsuariosEnSelects() {
        const { data, error } = await supabaseClient
            .from("usuarios")
            .select("id, nombre")
            .eq("activo", true)
            .order("nombre");

        if (error || !data) return;

        const opciones = data.map(u =>
            `<option value="${esc(u.nombre)}">${esc(u.nombre)}</option>`
        ).join("");

        const base = `<option value="">— Sin asignar —</option>` + opciones;

        const pntSel = document.getElementById("pntAsignado");
        if (pntSel) pntSel.innerHTML = base;

        const ntSel = document.getElementById("ntAsignado");
        if (ntSel) ntSel.innerHTML = base;

        const etSel = document.getElementById("etAsignado");
        if (etSel) {
            const valActual = etSel.value;
            etSel.innerHTML = base;
            if (valActual) etSel.value = valActual;
        }

        const filtroSel = document.getElementById("filtroAsignado");
        if (filtroSel) {
            const valFiltro = filtroSel.value;
            filtroSel.innerHTML = `<option value="">Todos los asignados</option>` + opciones;
            if (valFiltro) filtroSel.value = valFiltro;
        }
    }


    /* ═══════════════════════════════════════════
       DASHBOARD — LICENCIAS PRÓXIMAS A VENCER (7 días)
    ═══════════════════════════════════════════ */
    async function renderExpiringTickets() {
        const panel = document.getElementById("expiringPanel");
        const list  = document.getElementById("expiringList");
        if (!panel || !list) return;

        const { data, error } = await supabaseClient
            .from("licencias_office")
            .select("id, nombre, tipo, correo, fecha_expiracion, nombre_cuenta")
            .order("fecha_expiracion", { ascending: true });

        if (error || !data) { panel.style.display = "none"; return; }

        const hoy     = new Date(); hoy.setHours(0,0,0,0);
        const en7Dias = new Date(hoy); en7Dias.setDate(en7Dias.getDate() + 7);

        function parsearFecha(str) {
            if (!str) return null;
            const iso = new Date(str);
            if (!isNaN(iso)) return iso;
            const p = str.split("/");
            if (p.length === 3) {
                let yr = parseInt(p[2]);
                if (yr < 100) yr += 2000;
                return new Date(yr, parseInt(p[1]) - 1, parseInt(p[0]));
            }
            return null;
        }

        const proximas = data.filter(lic => {
            const f = parsearFecha(lic.fecha_expiracion);
            if (!f || isNaN(f)) return false;
            f.setHours(0,0,0,0);
            return f >= hoy && f <= en7Dias;
        });

        if (!proximas.length) { panel.style.display = "none"; return; }

        panel.style.display = "";

        list.innerHTML = proximas.map(lic => {
            const f    = parsearFecha(lic.fecha_expiracion);
            f.setHours(0,0,0,0);
            const diff = Math.round((f - hoy) / 86400000);
            let daysLabel, daysClass;
            if (diff === 0)      { daysLabel = "Vence hoy";    daysClass = "today"; }
            else if (diff === 1) { daysLabel = "Mañana";       daysClass = "day1"; }
            else if (diff <= 3)  { daysLabel = `${diff} días`; daysClass = "day2-3"; }
            else                 { daysLabel = `${diff} días`; daysClass = "day4-7"; }

            return `<div class="expiring-item" onclick="navegar('licencias-office')">
                <div class="expiring-item-left">
                    <div class="expiring-item-name">${esc(lic.nombre || lic.nombre_cuenta || "—")}</div>
                    <div class="expiring-item-meta">${esc(lic.tipo||"")} ${lic.correo ? "· " + esc(lic.correo) : ""} · Exp: ${esc(lic.fecha_expiracion||"")}</div>
                </div>
                <span class="expiring-days ${daysClass}">${daysLabel}</span>
            </div>`;
        }).join("");
    }


    /* ═══════════════════════════════════════════
       LICENCIAS — CANVA
    ═══════════════════════════════════════════ */
    let todasLicenciasKanva = [];

    async function cargarLicenciasKanva() {
        const tbody = document.getElementById("kanvaBody");
        tbody.innerHTML = `<tr class="loading-row"><td colspan="8">Cargando...</td></tr>`;

        const { data, error } = await supabaseClient
            .from("licencias_canva")
            .select("*")
            .order("id", { ascending: true });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="8" style="color:#ef4444;padding:20px">Error: ${esc(error.message)}</td></tr>`;
            return;
        }

        todasLicenciasKanva = data || [];
        renderTablaKanva();
        actualizarCardsKanva();
    }

    function parsearFechaKanva(str) {
        if (!str) return null;
        const iso = new Date(str);
        if (!isNaN(iso)) return iso;
        const p = str.split("/");
        if (p.length === 3) {
            let yr = parseInt(p[2]); if (yr < 100) yr += 2000;
            return new Date(yr, parseInt(p[1])-1, parseInt(p[0]));
        }
        return null;
    }

    function estadoKanva(lic) {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7);
        const f = parsearFechaKanva(lic.expiracion);
        if (!f || isNaN(f)) return "Activa";
        f.setHours(0,0,0,0);
        if (f < hoy) return "Vencida";
        if (f <= en7) return "Por vencer";
        return "Activa";
    }

    function actualizarCardsKanva() {
        let alertas = 0;
        todasLicenciasKanva.forEach(l => {
            const e = estadoKanva(l);
            if (e === "Vencida" || e === "Por vencer") alertas++;
        });

        const total = todasLicenciasKanva.length;
        const cntT = document.getElementById("kanvaCntTotal");
        const cntA = document.getElementById("kanvaCntActiva");
        const cntR = document.getElementById("kanvaCntAlerta");
        if (cntT) cntT.textContent = total;
        if (cntA) cntA.textContent = total - alertas;
        if (cntR) cntR.textContent = alertas;
    }

    function renderTablaKanva() {
        const tbody   = document.getElementById("kanvaBody");
        const busq    = (document.getElementById("kanvaBusqueda")?.value || "").toLowerCase();
        const fEstado = document.getElementById("kanvaFiltroEstado")?.value || "";

        const filtradas = todasLicenciasKanva.filter(l => {
            if (fEstado && estadoKanva(l) !== fEstado) return false;
            if (busq) {
                const h = `${l.nombre||""} ${l.correo||""} ${l.plan||""}`.toLowerCase();
                if (!h.includes(busq)) return false;
            }
            return true;
        });

        const cnt = document.getElementById("kanvaCount");
        if (cnt) cnt.textContent = `${filtradas.length} de ${todasLicenciasKanva.length}`;

        if (!filtradas.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No hay licencias Canva registradas.</div></td></tr>`;
            return;
        }

        tbody.innerHTML = filtradas.map((l, i) => {
            const estado = estadoKanva(l);
            const estadoBadge = {
                "Activa":     `<span class="badge badge-terminado">Activa</span>`,
                "Por vencer": `<span class="badge badge-en-proceso">Por vencer</span>`,
                "Vencida":    `<span class="badge badge-alta">Vencida</span>`,
            }[estado] || "";

            return `<tr class="clickable-row" onclick="abrirEditarKanva(${l.id})">
                <td data-label="#">${i + 1}</td>
                <td data-label="Nombre"><strong>${esc(l.nombre||"—")}</strong></td>
                <td data-label="Correo" style="color:#6b7280">${esc(l.correo||"—")}</td>
                <td data-label="Plan"><span class="asignado-chip" style="background:#f5f3ff;color:#6d28d9">${esc(l.plan||"—")}</span></td>
                <td data-label="Expiración">${esc(l.expiracion||"—")}</td>
                <td data-label="Estado">${estadoBadge}</td>
                <td data-label="Notas" style="color:#9ca3af;font-size:11px">${esc((l.notas||"").substring(0,50))}</td>
                <td data-label=""><button class="btn-edit" onclick="event.stopPropagation();abrirEditarKanva(${l.id})">✏</button></td>
            </tr>`;
        }).join("");
    }

    function abrirModalNuevaLicenciaKanva() {
        ["nkNombre","nkCorreo","nkNotas"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        const plan = document.getElementById("nkPlan"); if (plan) plan.value = "Pro";
        const exp  = document.getElementById("nkExpiracion"); if (exp) exp.value = "";
        const msg  = document.getElementById("nkMsg"); if (msg) msg.textContent = "";
        const btn  = document.getElementById("nkGuardar"); if (btn) btn.disabled = false;
        document.getElementById("modalNuevaLicenciaKanva").classList.add("open");
    }

    function cerrarModalNuevaLicenciaKanva() {
        document.getElementById("modalNuevaLicenciaKanva").classList.remove("open");
    }

    async function guardarNuevaLicenciaKanva() {
        const nombre = document.getElementById("nkNombre").value.trim();
        const correo = document.getElementById("nkCorreo").value.trim();
        if (!nombre || !correo) {
            document.getElementById("nkMsg").textContent = "⚠ Nombre y correo son obligatorios.";
            document.getElementById("nkMsg").style.color = "#ef4444"; return;
        }
        const btn = document.getElementById("nkGuardar"); btn.disabled = true;
        document.getElementById("nkMsg").textContent = "Guardando...";
        document.getElementById("nkMsg").style.color = "#6b7280";

        const payload = {
            nombre, correo,
            plan:       document.getElementById("nkPlan").value,
            expiracion: document.getElementById("nkExpiracion").value || null,
            notas:      document.getElementById("nkNotas").value.trim() || null,
        };

        const { error } = await supabaseClient.from("licencias_canva").insert([payload]);
        if (error) {
            document.getElementById("nkMsg").textContent = "❌ " + error.message;
            document.getElementById("nkMsg").style.color = "#ef4444";
            btn.disabled = false; return;
        }
        document.getElementById("nkMsg").textContent = "✅ Licencia creada.";
        document.getElementById("nkMsg").style.color = "#10b981";
        await cargarLicenciasKanva();
        setTimeout(() => cerrarModalNuevaLicenciaKanva(), 600);
    }

    document.getElementById("modalNuevaLicenciaKanva").addEventListener("click", function(e) {
        if (e.target === this) cerrarModalNuevaLicenciaKanva();
    });

    function abrirEditarKanva(id) {
        const l = todasLicenciasKanva.find(x => x.id === id);
        if (!l) return;
        document.getElementById("ekId").value         = l.id;
        document.getElementById("ekNombre").value     = l.nombre     || "";
        document.getElementById("ekCorreo").value     = l.correo     || "";
        document.getElementById("ekPlan").value       = l.plan       || "Pro";
        document.getElementById("ekExpiracion").value = l.expiracion || "";
        document.getElementById("ekNotas").value      = l.notas      || "";
        document.getElementById("ekMsg").textContent  = "";
        document.getElementById("ekGuardar").disabled = false;
        document.getElementById("modalEditarKanva").classList.add("open");
    }

    function cerrarModalEditarKanva() {
        document.getElementById("modalEditarKanva").classList.remove("open");
    }

    async function guardarEditarKanva() {
        const id     = parseInt(document.getElementById("ekId").value);
        const nombre = document.getElementById("ekNombre").value.trim();
        if (!nombre) {
            document.getElementById("ekMsg").textContent = "⚠ El nombre es obligatorio.";
            document.getElementById("ekMsg").style.color = "#ef4444"; return;
        }
        const btn = document.getElementById("ekGuardar"); btn.disabled = true;
        document.getElementById("ekMsg").textContent = "Guardando...";
        document.getElementById("ekMsg").style.color = "#6b7280";

        const payload = {
            nombre,
            correo:     document.getElementById("ekCorreo").value.trim() || null,
            plan:       document.getElementById("ekPlan").value,
            expiracion: document.getElementById("ekExpiracion").value || null,
            notas:      document.getElementById("ekNotas").value.trim() || null,
        };

        const { error } = await supabaseClient.from("licencias_canva").update(payload).eq("id", id);
        if (error) {
            document.getElementById("ekMsg").textContent = "❌ " + error.message;
            document.getElementById("ekMsg").style.color = "#ef4444";
            btn.disabled = false; return;
        }
        await cargarLicenciasKanva();
        cerrarModalEditarKanva();
    }

    async function eliminarLicenciaKanva() {
        const id = parseInt(document.getElementById("ekId").value);
        if (!confirm("¿Eliminar esta licencia Canva? Esta acción no se puede deshacer.")) return;
        const { error } = await supabaseClient.from("licencias_canva").delete().eq("id", id);
        if (error) { alert("Error al eliminar: " + error.message); return; }
        cerrarModalEditarKanva();
        await cargarLicenciasKanva();
    }

    document.getElementById("modalEditarKanva").addEventListener("click", function(e) {
        if (e.target === this) cerrarModalEditarKanva();
    });


    /* ═══════════════════════════════════════════
       MANTENIMIENTOS
    ═══════════════════════════════════════════ */
    let todosMantenimientos = [];
    let todosEquipos_mant   = [];
    let todosUsuarios_mant  = [];
    let calFechaActual      = new Date();
    let mantVistaActual     = "cal";
    let ticketActualId      = null;

    async function cargarMantenimientos() {
        const [mRes, eRes, uRes] = await Promise.all([
            supabaseClient.from("mantenimientos").select("*").order("fecha_programada"),
            supabaseClient.from("equipos").select("*").order("asignado_a"),
            supabaseClient.from("usuarios").select("id,nombre,correo").order("nombre"),
        ]);
        todosMantenimientos = mRes.data || [];
        todosEquipos_mant   = eRes.data || [];
        todosUsuarios_mant  = uRes.data || [];

        poblarSelectUsuariosMant();
        actualizarStatsMant();
        renderMantCurrentView();
        checkHashTicket();
    }

    function actualizarStatsMant() {
        const d = todosMantenimientos;
        const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
        set("mantCntTotal",      d.length);
        set("mantCntProgramado", d.filter(t=>t.estado==="Programado").length);
        set("mantCntProceso",    d.filter(t=>t.estado==="En proceso").length);
        set("mantCntCompletado", d.filter(t=>t.estado==="Completado").length);
    }

    function switchMantView(v) {
        mantVistaActual = v;
        document.getElementById("mantBtnCal").classList.toggle("active", v==="cal");
        document.getElementById("mantBtnList").classList.toggle("active", v==="list");
        document.getElementById("mantViewCal").style.display  = v==="cal"  ? "" : "none";
        document.getElementById("mantViewList").style.display = v==="list" ? "" : "none";
        renderMantCurrentView();
    }

    function renderMantCurrentView() {
        if (mantVistaActual === "cal") renderCalendario();
        else renderTablaMantenimientos();
    }

    function filteredMantenimientos() {
        const q   = (document.getElementById("mantBusqueda")?.value   || "").toLowerCase();
        const est = document.getElementById("mantFiltroEstado")?.value || "";
        const tip = document.getElementById("mantFiltroTipo")?.value   || "";
        return todosMantenimientos.filter(t => {
            if (preferenciasUsuario.mant_ocultar_cancelados && t.estado === "Cancelado") return false;
            const matchEst = !est || t.estado === est;
            const matchTip = !tip || t.tipo   === tip;
            const uSearch  = todosUsuarios_mant.find(u => u.id === t.usuario_id);
            const matchQ   = !q ||
                (t.numero_ticket||"").toLowerCase().includes(q) ||
                (t.titulo||"").toLowerCase().includes(q) ||
                (uSearch?.nombre||"").toLowerCase().includes(q) ||
                (t.tecnico||"").toLowerCase().includes(q);
            return matchEst && matchTip && matchQ;
        });
    }

    /* ── CALENDARIO ── */
    function calMes(delta) {
        calFechaActual = new Date(calFechaActual.getFullYear(), calFechaActual.getMonth() + delta, 1);
        renderCalendario();
    }

    function renderCalendario() {
        const hoy   = new Date(); hoy.setHours(0,0,0,0);
        const año   = calFechaActual.getFullYear();
        const mes   = calFechaActual.getMonth();
        const label = document.getElementById("calMonthLabel");
        const grid  = document.getElementById("calGrid");
        if (!label || !grid) return;

        label.textContent = new Date(año, mes, 1)
            .toLocaleDateString("es-GT", { month:"long", year:"numeric" })
            .replace(/^\w/, c => c.toUpperCase());

        // Primer día de la semana: 0 = domingo, 1 = lunes
        const offset  = Number(preferenciasUsuario.mant_primer_dia) === 1 ? 1 : 0;
        const nombres = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
        const cabeceras = [...nombres.slice(offset), ...nombres.slice(0, offset)];
        let html = cabeceras.map(d => `<div class="cal-weekday">${d}</div>`).join("");

        const primero      = (new Date(año, mes, 1).getDay() - offset + 7) % 7;
        const diasMes      = new Date(año, mes + 1, 0).getDate();
        const mesFiltrados = filteredMantenimientos();

        const byDate = {};
        mesFiltrados.forEach(t => {
            if (!t.fecha_programada) return;
            byDate[t.fecha_programada] = byDate[t.fecha_programada] || [];
            byDate[t.fecha_programada].push(t);
        });

        for (let i = 0; i < primero; i++) html += `<div class="cal-day other-month"></div>`;

        for (let d = 1; d <= diasMes; d++) {
            const fecha  = `${año}-${String(mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const isHoy  = (new Date(año, mes, d)).getTime() === hoy.getTime();
            const events = byDate[fecha] || [];
            const maxShow = 3;
            const eventHtml = events.slice(0, maxShow).map(t => {
                const cls = estCalCls(t.estado);
                return `<div class="cal-event ${cls}" title="${esc(t.titulo||t.numero_ticket)}" onclick="event.stopPropagation();verTicket(${t.id})">${esc((t.titulo||t.numero_ticket||"").substring(0,22))}</div>`;
            }).join("") + (events.length > maxShow ? `<div style="font-size:9px;color:#9ca3af;padding:1px 4px">+${events.length-maxShow} más</div>` : "");

            html += `<div class="cal-day${isHoy?" today":""}"><div class="cal-day-num">${d}</div>${eventHtml}</div>`;
        }

        const totalCells = primero + diasMes;
        const resto = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 0; i < resto; i++) html += `<div class="cal-day other-month"></div>`;

        grid.innerHTML = html;
    }

    function estCalCls(estado) {
        return { "Programado":"programado","En proceso":"en-proceso","Completado":"completado","Cancelado":"cancelado" }[estado] || "programado";
    }

    /* ── TABLA LISTA ── */
    function renderTablaMantenimientos() {
        const tbody = document.getElementById("mantTablaBody");
        if (!tbody) return;
        const rows = filteredMantenimientos().sort((a,b) => (a.fecha_programada||"").localeCompare(b.fecha_programada||""));
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No se encontraron tickets.</div></td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map(t => {
            const uN = todosUsuarios_mant.find(u => u.id === t.usuario_id);
            const eN = t.equipo_id ? todosEquipos_mant.find(e => e.id === t.equipo_id) : null;
            const nombreU = uN?.nombre || "—";
            const nombreE = eN ? [eN.tipo,eN.marca,eN.modelo].filter(Boolean).join(" ") : "—";
            return `
            <tr class="ticket-row" onclick="verTicket(${t.id})">
                <td><span style="font-size:11px;font-weight:700;color:#6366f1">${esc(t.numero_ticket||"—")}</span><br><span style="font-size:11px;color:#9ca3af">${esc((t.titulo||"").substring(0,30))}</span></td>
                <td><strong style="font-size:13px">${esc(nombreU)}</strong><br><span style="font-size:11px;color:#9ca3af">${esc(nombreE)}</span></td>
                <td><span class="asignado-chip" style="background:#f0fdf4;color:#166534">${esc(t.tipo||"—")}</span></td>
                <td>${badgePrioridad(t.prioridad)}</td>
                <td>${badgeMantEstado(t.estado)}</td>
                <td style="font-size:12px;white-space:nowrap">${formatFecha(t.fecha_programada)}</td>
                <td style="font-size:12px">${esc(t.tecnico||"—")}</td>
                <td onclick="event.stopPropagation()"><button class="btn-edit" onclick="verTicket(${t.id})">👁 Ver</button></td>
            </tr>`;
        }).join("");
    }

    function badgeMantEstado(est) {
        const map = { "Programado":"badge-programado","En proceso":"badge-en-proceso","Completado":"badge-completado","Cancelado":"badge-cancelado" };
        return `<span class="badge ${map[est]||"badge-programado"}">${esc(est||"—")}</span>`;
    }

    /* ── NUEVO TICKET ── */
    function poblarSelectUsuariosMant() {
        const sel = document.getElementById("ntmUsuario");
        if (!sel) return;
        sel.innerHTML = `<option value="">— Seleccionar usuario —</option>` +
            todosUsuarios_mant.map(u => `<option value="${u.id}" data-nombre="${esc(u.nombre)}" data-correo="${esc(u.correo||"")}">${esc(u.nombre)}</option>`).join("");
    }

    function cargarEquiposDelUsuario() {
        const uid  = document.getElementById("ntmUsuario").value;
        const sel  = document.getElementById("ntmEquipo");
        const wrap = document.getElementById("ntmComponentesWrap");
        if (!sel) return;
        if (!uid) {
            sel.innerHTML = `<option value="">— Primero selecciona usuario —</option>`;
            wrap.style.display = "none"; return;
        }
        const usuObj = todosUsuarios_mant.find(u => String(u.id) === uid);
        const nombre = usuObj?.nombre || "";
        const equipos = todosEquipos_mant.filter(e => (e.asignado_a||"").toLowerCase() === nombre.toLowerCase() || e.usuario_id == uid);
        if (!equipos.length) {
            sel.innerHTML = `<option value="">— Sin equipos asignados —</option>`;
            wrap.style.display = "none"; return;
        }
        sel.innerHTML = `<option value="">— Sin equipo específico —</option>` +
            equipos.map(e => `<option value="${e.id}">${esc([e.tipo,e.marca,e.modelo].filter(Boolean).join(" - "))} (S/N: ${esc(e.numero_serie||"N/A")})</option>`).join("");

        sel.onchange = () => mostrarComponentesEquipo();
    }

    function mostrarComponentesEquipo() {
        const eid  = document.getElementById("ntmEquipo").value;
        const wrap = document.getElementById("ntmComponentesWrap");
        const comp = document.getElementById("ntmComponentes");
        if (!eid) { wrap.style.display="none"; return; }
        const eq = todosEquipos_mant.find(e => String(e.id) === eid);
        if (!eq) { wrap.style.display="none"; return; }
        comp.innerHTML = buildComponentChips(eq) || '<span style="font-size:12px;color:#9ca3af">Sin componentes registrados</span>';
        wrap.style.display = "";
    }

    function buildComponentChips(eq) {
        const campos = [
            {k:"procesador",        l:"CPU"},
            {k:"ram",               l:"RAM"},
            {k:"almacenamiento",    l:"Disco"},
            {k:"sistema_operativo", l:"SO"},
            {k:"tipo",              l:"Tipo"},
            {k:"marca",             l:"Marca"},
            {k:"modelo",            l:"Modelo"},
        ];
        return campos.filter(c => eq[c.k])
            .map(c => `<span class="comp-chip" title="${esc(c.l)}">${esc(c.l)}: <strong>${esc(String(eq[c.k]))}</strong></span>`)
            .join("");
    }

    function abrirModalNuevoTicket() {
        document.getElementById("ntmTitulo").value      = "";
        document.getElementById("ntmTipo").value        = "Preventivo";
        document.getElementById("ntmPrioridad").value   = "Media";
        document.getElementById("ntmTecnico").value     = "";
        document.getElementById("ntmFecha").value       = new Date().toISOString().split("T")[0];
        document.getElementById("ntmHora").value        = "09:00";
        document.getElementById("ntmDescripcion").value = "";
        document.getElementById("ntmMsg").textContent   = "";
        document.getElementById("ntmGuardar").disabled  = false;
        document.getElementById("ntmComponentesWrap").style.display = "none";
        poblarSelectUsuariosMant();
        document.getElementById("ntmUsuario").value = "";
        document.getElementById("ntmEquipo").innerHTML = `<option value="">— Primero selecciona usuario —</option>`;
        document.getElementById("modalNuevoTicket").classList.add("open");
    }

    function cerrarModalNuevoTicket() {
        document.getElementById("modalNuevoTicket").classList.remove("open");
    }

    async function guardarNuevoTicket() {
        const titulo = document.getElementById("ntmTitulo").value.trim();
        const uid    = document.getElementById("ntmUsuario").value;
        const fecha  = document.getElementById("ntmFecha").value;
        if (!titulo || !uid || !fecha) {
            document.getElementById("ntmMsg").textContent = "⚠ Usuario, título y fecha son obligatorios.";
            document.getElementById("ntmMsg").style.color = "#ef4444"; return;
        }
        const btn = document.getElementById("ntmGuardar"); btn.disabled = true;
        document.getElementById("ntmMsg").textContent = "Creando ticket...";
        document.getElementById("ntmMsg").style.color = "#6b7280";

        const eid = document.getElementById("ntmEquipo").value || null;

        const año    = new Date().getFullYear();
        const { count } = await supabaseClient.from("mantenimientos").select("id", { count:"exact", head:true });
        const seq    = String((count||0)+1).padStart(4,"0");
        const numTkt = `MANT-${año}-${seq}`;

        const payload = {
            numero_ticket:    numTkt,
            usuario_id:       parseInt(uid),
            equipo_id:        eid ? parseInt(eid) : null,
            titulo,
            tipo:             document.getElementById("ntmTipo").value,
            prioridad:        document.getElementById("ntmPrioridad").value,
            estado:           "Programado",
            tecnico:          document.getElementById("ntmTecnico").value.trim() || null,
            fecha_programada: fecha,
            descripcion:      document.getElementById("ntmDescripcion").value.trim() || null,
        };

        const { data, error } = await supabaseClient.from("mantenimientos").insert([payload]).select().single();
        if (error) {
            document.getElementById("ntmMsg").textContent = "❌ " + error.message;
            document.getElementById("ntmMsg").style.color = "#ef4444";
            btn.disabled = false; return;
        }

        document.getElementById("ntmMsg").textContent = "✅ Ticket " + numTkt + " creado.";
        document.getElementById("ntmMsg").style.color = "#10b981";
        await cargarMantenimientos();
        setTimeout(() => { cerrarModalNuevoTicket(); verTicket(data.id); }, 800);
    }

    document.getElementById("modalNuevoTicket").addEventListener("click", function(e){ if(e.target===this) cerrarModalNuevoTicket(); });

    /* ── VER TICKET ── */
    function verTicket(id) {
        const t = todosMantenimientos.find(x => x.id === id);
        if (!t) return;
        ticketActualId = id;

        document.getElementById("vtNumero").textContent      = t.numero_ticket || "—";
        document.getElementById("vtTitulo").textContent      = t.titulo || "—";
        const uObjV = todosUsuarios_mant.find(u => u.id === t.usuario_id);
        const eObjV = t.equipo_id ? todosEquipos_mant.find(e => e.id === t.equipo_id) : null;
        document.getElementById("vtMeta").textContent        = formatFecha(t.fecha_programada) || "—";
        document.getElementById("vtEstadoWrap").innerHTML    = badgeMantEstado(t.estado);
        document.getElementById("vtTipo").textContent        = t.tipo || "—";
        document.getElementById("vtPrioridad").innerHTML     = badgePrioridad(t.prioridad);
        document.getElementById("vtTecnico").textContent     = t.tecnico || "Sin asignar";
        document.getElementById("vtFechaProg").textContent   = formatFecha(t.fecha_programada) + (t.hora_programada ? " " + t.hora_programada : "");
        document.getElementById("vtCreadoPor").textContent   = t.creado_por || "—";
        document.getElementById("vtUsuario").textContent     = uObjV?.nombre || "—";
        document.getElementById("vtCorreo").textContent      = uObjV?.correo || "—";
        document.getElementById("vtEquipo").textContent      = eObjV ? [eObjV.tipo, eObjV.marca, eObjV.modelo].filter(Boolean).join(" ") : "Sin equipo asignado";
        document.getElementById("vtDescripcion").textContent = t.descripcion || "Sin descripción.";
        document.getElementById("vtMsgEstado").textContent   = "";
        document.getElementById("vtSerie").textContent       = eObjV?.numero_serie || "—";

        const vtComp = document.getElementById("vtComponentes");
        let compData = {};
        if (eObjV) {
            compData = { tipo:eObjV.tipo, marca:eObjV.marca, modelo:eObjV.modelo,
                procesador:eObjV.procesador, ram:eObjV.ram, almacenamiento:eObjV.almacenamiento,
                sistema_operativo:eObjV.sistema_operativo };
        }
        const chipsCampos = [
            {k:"tipo",l:"Tipo"},{k:"marca",l:"Marca"},{k:"modelo",l:"Modelo"},
            {k:"procesador",l:"CPU"},{k:"ram",l:"RAM"},{k:"almacenamiento",l:"Disco"},
            {k:"sistema_operativo",l:"SO"},
        ];
        const chips = chipsCampos.filter(c=>compData[c.k]).map(c=>`<span class="comp-chip">${esc(c.l)}: <strong>${esc(String(compData[c.k]))}</strong></span>`).join("");
        vtComp.innerHTML = chips || `<span style="font-size:12px;color:#9ca3af">Sin componentes registrados</span>`;

        const link = window.location.href.split("#")[0] + "#ticket=" + encodeURIComponent(t.numero_ticket||id);
        document.getElementById("vtLink").textContent    = link;
        document.getElementById("vtLinkMsg").textContent = "";

        document.getElementById("modalVerTicket").classList.add("open");
    }

    function cerrarModalVerTicket() {
        document.getElementById("modalVerTicket").classList.remove("open");
        ticketActualId = null;
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    document.getElementById("modalVerTicket").addEventListener("click", function(e){ if(e.target===this) cerrarModalVerTicket(); });

    function copiarLinkTicket() {
        const link = document.getElementById("vtLink").textContent;
        navigator.clipboard.writeText(link).then(() => {
            document.getElementById("vtLinkMsg").textContent = "✅ Link copiado al portapapeles";
            setTimeout(() => { document.getElementById("vtLinkMsg").textContent = ""; }, 2000);
        }).catch(() => {
            document.getElementById("vtLinkMsg").textContent = "⚠ No se pudo copiar automáticamente";
        });
    }

    async function cambiarEstadoTicket(nuevoEstado) {
        if (!ticketActualId) return;
        const { error } = await supabaseClient.from("mantenimientos").update({ estado: nuevoEstado }).eq("id", ticketActualId);
        const msg = document.getElementById("vtMsgEstado");
        if (error) { msg.textContent = "❌ Error: " + error.message; msg.style.color = "#ef4444"; return; }
        msg.textContent = "✅ Estado actualizado a: " + nuevoEstado; msg.style.color = "#10b981";
        await cargarMantenimientos();
        const t = todosMantenimientos.find(x => x.id === ticketActualId);
        if (t) document.getElementById("vtEstadoWrap").innerHTML = badgeMantEstado(t.estado);
    }

    /* ── EDITAR TICKET ── */
    function abrirEditarTicket() {
        if (!ticketActualId) return;
        const t = todosMantenimientos.find(x => x.id === ticketActualId);
        if (!t) return;
        document.getElementById("etmId").value          = t.id;
        document.getElementById("etmTitulo").value      = t.titulo           || "";
        document.getElementById("etmTipo").value        = t.tipo             || "Preventivo";
        document.getElementById("etmPrioridad").value   = t.prioridad        || "Media";
        document.getElementById("etmEstado").value      = t.estado           || "Programado";
        document.getElementById("etmFecha").value       = t.fecha_programada || "";
        document.getElementById("etmTecnico").value     = t.tecnico          || "";
        document.getElementById("etmDescripcion").value = t.descripcion      || "";
        document.getElementById("etmMsg").textContent   = "";
        document.getElementById("etmGuardar").disabled  = false;
        cerrarModalVerTicket();
        document.getElementById("modalEditarTicket").classList.add("open");
    }

    function cerrarModalEditarTicket() {
        document.getElementById("modalEditarTicket").classList.remove("open");
    }

    async function guardarEditarTicket() {
        const id     = parseInt(document.getElementById("etmId").value);
        const titulo = document.getElementById("etmTitulo").value.trim();
        if (!titulo) {
            document.getElementById("etmMsg").textContent = "⚠ El título es obligatorio.";
            document.getElementById("etmMsg").style.color = "#ef4444"; return;
        }
        const btn = document.getElementById("etmGuardar"); btn.disabled = true;
        document.getElementById("etmMsg").textContent = "Guardando...";
        document.getElementById("etmMsg").style.color = "#6b7280";

        const payload = {
            titulo,
            tipo:             document.getElementById("etmTipo").value,
            prioridad:        document.getElementById("etmPrioridad").value,
            estado:           document.getElementById("etmEstado").value,
            fecha_programada: document.getElementById("etmFecha").value || null,
            tecnico:          document.getElementById("etmTecnico").value.trim() || null,
            descripcion:      document.getElementById("etmDescripcion").value.trim() || null,
        };

        const { error } = await supabaseClient.from("mantenimientos").update(payload).eq("id", id);
        if (error) {
            document.getElementById("etmMsg").textContent = "❌ " + error.message;
            document.getElementById("etmMsg").style.color = "#ef4444";
            btn.disabled = false; return;
        }
        document.getElementById("etmMsg").textContent = "✅ Ticket actualizado.";
        document.getElementById("etmMsg").style.color = "#10b981";
        await cargarMantenimientos();
        ticketActualId = id;
        setTimeout(() => { cerrarModalEditarTicket(); verTicket(id); }, 700);
    }

    document.getElementById("modalEditarTicket").addEventListener("click", function(e){ if(e.target===this) cerrarModalEditarTicket(); });

    async function eliminarTicket() {
        if (!ticketActualId) return;
        const t = todosMantenimientos.find(x => x.id === ticketActualId);
        if (!confirm(`¿Eliminar el ticket ${t?.numero_ticket||""}? Esta acción no se puede deshacer.`)) return;
        const { error } = await supabaseClient.from("mantenimientos").delete().eq("id", ticketActualId);
        if (error) { alert("Error al eliminar: " + error.message); return; }
        cerrarModalVerTicket();
        await cargarMantenimientos();
    }

    /* ── LINK DIRECTO A TICKET ── */
    function checkHashTicket() {
        const hash = window.location.hash;
        if (!hash.startsWith("#ticket=")) return;
        const numOrId = decodeURIComponent(hash.replace("#ticket=", ""));
        const t = todosMantenimientos.find(x => x.numero_ticket === numOrId || String(x.id) === numOrId);
        if (t) {
            navegar("mantenimientos");
            setTimeout(() => verTicket(t.id), 300);
        }
    }

    window.addEventListener("hashchange", () => {
        const hash = window.location.hash;
        if (hash.startsWith("#ticket=")) checkHashTicket();
    });


    /* ═══════════════════════════════════════════
       HELPERS
    ═══════════════════════════════════════════ */
    function badgeEstado(e) {
        const m = { "Terminado":"badge-terminado", "En proceso":"badge-en-proceso", "No iniciado":"badge-no-iniciado" };
        return `<span class="badge ${m[e]||'badge-no-iniciado'}">${esc(e||"—")}</span>`;
    }
    function badgePrioridad(p) {
        const m = { "Alta":"badge-alta", "Media":"badge-media", "Baja":"badge-baja" };
        return `<span class="badge ${m[p]||'badge-baja'}">${esc(p||"—")}</span>`;
    }
    function esc(str) {
        return String(str??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }
    function truncar(str, max) {
        return str && str.length > max ? str.slice(0, max) + "…" : str;
    }
    function formatFecha(iso) {
        if (!iso) return "—";
        try { const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; }
        catch { return iso; }
    }


    /* ═══════════════════════════════════════════
       SUBMENÚ ACTIVIDADES
    ═══════════════════════════════════════════ */
    function toggleSubmenu(item, pagina) {
        const submenu = document.getElementById("submenu-" + pagina);
        if (!submenu) { navegar(pagina); return; }
        const isOpen = submenu.classList.contains("open");
        submenu.classList.toggle("open", !isOpen);
        item.classList.toggle("open", !isOpen);
    }

    function navegarSubmenu(pagina, filtroEstado) {
        document.querySelectorAll(".submenu-item").forEach(i => i.classList.remove("active"));
        const activo = document.querySelector(`.submenu-item[data-sub="${filtroEstado || pagina.split('-')[1]}"]`);
        if (activo) activo.classList.add("active");
        navegar(pagina, filtroEstado);
    }


    /* ═══════════════════════════════════════════
       INIT
    ═══════════════════════════════════════════ */
    async function iniciarDashboard() {
        await cargarUsuario();
        await cargarConfiguracionUsuario();
        await Promise.all([cargarTotalUsuarios(), cargarActividades(), cargarUsuariosEnSelects(), renderExpiringTickets()]);
        aplicarAjustes();
        const inicio = preferenciasUsuario.pagina_inicio;
        if (inicio && inicio !== "dashboard") navegar(inicio);
    }

    iniciarDashboard();
    if (typeof lucide !== "undefined") lucide.createIcons();

    /* ── MOBILE SIDEBAR ── */
    function toggleSidebar() {
        const sidebar = document.getElementById("sidebar");
        const overlay = document.getElementById("sidebarOverlay");
        sidebar.classList.toggle("mobile-open");
        overlay.classList.toggle("open");
    }
    document.querySelectorAll(".menu-item, .submenu-item").forEach(el => {
        el.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                document.getElementById("sidebar").classList.remove("mobile-open");
                document.getElementById("sidebarOverlay").classList.remove("open");
            }
        });
    });

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data === "SW_ACTIVATED") window.location.reload();
    });
}

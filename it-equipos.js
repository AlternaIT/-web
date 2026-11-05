/* ═══════════════════════════════════════════════════════════════
   IT — Equipos: garantía y antigüedad, ficha con historial, código QR,
   etiquetas, actas de entrega/devolución en PDF y reporte de IT.
   Usa lo que define dashboard.js: supabaseClient, usuario, esc, navegar,
   avisoBreve, formatFecha, formatFechaHora, todosEquipos, cargarEquipos…
═══════════════════════════════════════════════════════════════ */

const ANIOS_RENOVACION = 4;            // a partir de cuántos años de uso se sugiere renovar
let equiposParaAvisos = [];            // equipos cargados al iniciar (avisos de garantía)
let usuariosParaEquipos = [];          // colaboradores activos (asignación y actas)
let fichaEquipoId = null;
let fichaEquipo = null;

const DIA_MS = 86400000;
const codigoEquipo = e => e?.codigo || "EQ-" + String(e?.id ?? 0).padStart(4, "0");
const nombreEquipo = e => [e?.tipo, e?.marca, e?.modelo].filter(Boolean).join(" ") || "Equipo";
const urlFichaEquipo = id => {
    const base = /^https?:/.test(location.protocol) ? location.href.split("#")[0].replace(/[^/]*$/, "") : URL_PUBLICA_APP;
    return `${base}it.html#equipo=${id}`;
};
function hoySinHora() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function fechaLarga(iso) {
    if (!iso) return "—";
    return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric" });
}
function fechaCorta(iso) {
    return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Garantía y antigüedad ── */
function aniosDeUso(e) {
    if (!e?.fecha_compra) return null;
    const ms = hoySinHora() - new Date(e.fecha_compra + "T00:00:00");
    return ms < 0 ? 0 : ms / (365.25 * DIA_MS);
}

function textoAntiguedad(e) {
    const a = aniosDeUso(e);
    if (a === null) return "—";
    const meses = Math.floor(a * 12);
    if (meses < 1) return "Menos de 1 mes";
    if (meses < 12) return `${meses} mes${meses !== 1 ? "es" : ""}`;
    const y = Math.floor(meses / 12), m = meses % 12;
    return `${y} año${y !== 1 ? "s" : ""}${m ? ` ${m} m` : ""}`;
}

function estadoGarantia(e) {
    if (!e?.garantia_hasta) return { clave: "sin-dato", texto: "Sin dato", detalle: "No se registró la garantía" };
    const diff = Math.round((new Date(e.garantia_hasta + "T00:00:00") - hoySinHora()) / DIA_MS);
    if (diff < 0) return { clave: "vencida", texto: "Vencida", detalle: `Venció el ${fechaLarga(e.garantia_hasta)}`, dias: diff };
    if (diff <= 90) return { clave: "por-vencer", texto: diff === 0 ? "Vence hoy" : `Vence en ${diff} d`, detalle: `Vence el ${fechaLarga(e.garantia_hasta)}`, dias: diff };
    return { clave: "vigente", texto: `Hasta ${fechaCorta(e.garantia_hasta)}`, detalle: `Vigente hasta el ${fechaLarga(e.garantia_hasta)}`, dias: diff };
}

/* ── Datos base al iniciar: avisos de garantía y lista de colaboradores ── */
async function cargarDatosEquiposBase() {
    const [eq, us] = await Promise.all([
        supabaseClient.from("inventario_equipos").select("id, tipo, marca, modelo, estado, asignado_a, garantia_hasta, fecha_compra"),
        supabaseClient.from("usuarios").select("id, nombre, correo").eq("activo", true).order("nombre"),
    ]);
    if (!eq.error) equiposParaAvisos = eq.data || [];
    if (!us.error) usuariosParaEquipos = (us.data || []).filter(u => u.nombre);
    llenarListaUsuariosEquipo();
    if (typeof renderNotificaciones === "function" && typeof preferenciasUsuario !== "undefined") renderNotificaciones();
}

function llenarListaUsuariosEquipo() {
    const dl = document.getElementById("listaUsuariosEquipo");
    if (dl) dl.innerHTML = usuariosParaEquipos.map(u => `<option value="${esc(u.nombre)}">`).join("");
}

/* ── Enlaces directos: it.html#equipo=12 (QR) y it.html#ticket=MANT-2026-0001 ── */
function abrirEnlaceDirecto() {
    const h = location.hash;
    const eq = h.match(/^#equipo=(\d{1,9})$/);
    if (eq) { navegar("equipos"); abrirFichaEquipo(Number(eq[1])); return; }
    if (/^#ticket=[\w-]{1,40}$/.test(h) && paginaActual !== "mantenimientos") navegar("mantenimientos");
}
window.addEventListener("hashchange", () => {
    const eq = location.hash.match(/^#equipo=(\d{1,9})$/);
    if (eq && Number(eq[1]) !== fichaEquipoId) abrirFichaEquipo(Number(eq[1]));
});

/* ═══════════════ FICHA DEL EQUIPO ═══════════════ */
const NOMBRE_CAMPO_EQ = {
    asignado_a: "Asignado a", estado: "Estado", tipo: "Tipo", marca: "Marca", modelo: "Modelo", numero_serie: "Número de serie",
    procesador: "Procesador", ram: "RAM", almacenamiento: "Almacenamiento", sistema_operativo: "Sistema operativo",
    fecha_compra: "Fecha de compra", garantia_hasta: "Garantía", notas: "Notas",
};
const ICONO_HIST = {
    "Registrado": "package-plus", "Asignación": "user-check", "Devolución": "user-minus", "Cambio de estado": "refresh-cw",
    "Edición": "pencil", "Acta de entrega": "file-check-2", "Acta de devolución": "file-minus-2", "Etiqueta impresa": "qr-code", "Mantenimiento": "wrench",
};

async function abrirFichaEquipo(id) {
    if (!id) return;
    fichaEquipoId = id;
    const modal = document.getElementById("modalFichaEquipo");
    document.getElementById("fqHistorial").innerHTML = `<div class="fq-vacio">Cargando…</div>`;
    modal.classList.add("open");
    if (location.hash !== `#equipo=${id}`) history.replaceState(null, "", `#equipo=${id}`);

    const [eqRes, hiRes, mtRes] = await Promise.all([
        supabaseClient.from("inventario_equipos").select("*").eq("id", id).maybeSingle(),
        supabaseClient.from("equipos_historial").select("*").eq("equipo_id", id).order("created_at", { ascending: false }).limit(200),
        supabaseClient.from("mantenimientos").select("id, numero_ticket, titulo, tipo, estado, fecha_programada, tecnico, created_at").eq("equipo_id", id),
    ]);
    if (fichaEquipoId !== id) return; // se abrió otra ficha mientras cargaba
    if (eqRes.error || !eqRes.data) {
        document.getElementById("fqTitulo").textContent = "Equipo no encontrado";
        document.getElementById("fqSub").textContent = eqRes.error ? eqRes.error.message : "Puede que lo hayan eliminado del inventario.";
        ["fqCodigo", "fqAlertas", "fqDatos", "fqQr"].forEach(x => document.getElementById(x).innerHTML = "");
        document.getElementById("fqHistorial").innerHTML = "";
        return;
    }
    fichaEquipo = eqRes.data;
    pintarFicha(fichaEquipo, hiRes.data || [], mtRes.data || [], !!hiRes.error);
}

function pintarFicha(e, historial, mants, errorHist) {
    const g = estadoGarantia(e);
    const anios = aniosDeUso(e);
    document.getElementById("fqCodigo").textContent = codigoEquipo(e);
    document.getElementById("fqTitulo").textContent = nombreEquipo(e);
    document.getElementById("fqSub").innerHTML =
        `<span class="badge ${badgeEquipoEstado(e.estado)}">${esc(e.estado || "—")}</span>` +
        (e.asignado_a ? ` <span class="fq-asig"><i data-lucide="user"></i> ${esc(e.asignado_a)}</span>` : ` <span class="fq-asig muted">Sin asignar</span>`);

    const alertas = [];
    if (g.clave === "vencida") alertas.push(["error", "shield-off", `Garantía vencida: ${g.detalle.toLowerCase()}.`]);
    if (g.clave === "por-vencer") alertas.push(["aviso", "shield-alert", `La garantía vence pronto: ${g.detalle.toLowerCase()}.`]);
    if (anios !== null && anios >= ANIOS_RENOVACION && e.estado !== "Dado de baja")
        alertas.push(["aviso", "history", `Tiene ${textoAntiguedad(e)} de uso. Considera renovarlo.`]);
    const pendientes = mants.filter(m => m.estado === "Programado" || m.estado === "En proceso");
    if (pendientes.length) alertas.push(["info", "wrench", `${pendientes.length} mantenimiento${pendientes.length !== 1 ? "s" : ""} pendiente${pendientes.length !== 1 ? "s" : ""}.`]);
    document.getElementById("fqAlertas").innerHTML = alertas.map(([t, i, txt]) =>
        `<div class="fq-alerta ${t}"><i data-lucide="${i}"></i><span>${esc(txt)}</span></div>`).join("");

    const fila = (k, v, mono) => `<div><dt>${k}</dt><dd${mono ? ' class="mono"' : ""}>${v}</dd></div>`;
    const t = v => v ? esc(v) : `<span class="muted">—</span>`;
    document.getElementById("fqDatos").innerHTML = [
        fila("Número de serie", t(e.numero_serie), true),
        fila("Procesador", t(e.procesador)),
        fila("Memoria RAM", t(e.ram)),
        fila("Almacenamiento", t(e.almacenamiento)),
        fila("Sistema operativo", t(e.sistema_operativo)),
        fila("Fecha de compra", e.fecha_compra ? `${esc(fechaLarga(e.fecha_compra))} <span class="muted">· ${esc(textoAntiguedad(e))}</span>` : t("")),
        fila("Garantía", `<span class="eq-gar ${g.clave}">${esc(g.texto)}</span>${e.garantia_hasta ? ` <span class="muted">${esc(fechaLarga(e.garantia_hasta))}</span>` : ""}`),
        e.notas ? `<div class="fq-ancho"><dt>Notas</dt><dd style="white-space:pre-wrap">${esc(e.notas)}</dd></div>` : "",
    ].join("");

    pintarQR(document.getElementById("fqQr"), urlFichaEquipo(e.id));
    document.getElementById("fqBtnDevolucion").disabled = !e.asignado_a;
    document.getElementById("fqBtnDevolucion").title = e.asignado_a ? "" : "El equipo no está asignado a nadie";

    // Línea de tiempo: cambios del equipo + mantenimientos
    const eventos = historial.map(h => ({ fecha: h.created_at, accion: h.accion, h }))
        .concat(mants.map(m => ({ fecha: (m.fecha_programada || m.created_at?.slice(0, 10)) + "T12:00:00", accion: "Mantenimiento", m })))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const cont = document.getElementById("fqHistorial");
    if (errorHist) { cont.innerHTML = `<div class="fq-vacio">No se pudo cargar el historial.</div>`; return; }
    if (!eventos.length) { cont.innerHTML = `<div class="fq-vacio">Sin movimientos registrados.</div>`; return; }
    cont.innerHTML = eventos.map(ev => {
        const icono = ICONO_HIST[ev.accion] || "dot";
        let titulo, detalle = "";
        if (ev.m) {
            const m = ev.m;
            titulo = `<a href="#" onclick="verTicketDesdeFicha(${m.id});return false">${esc(m.numero_ticket || "Ticket")}</a> · ${esc(m.tipo || "Mantenimiento")}`;
            detalle = `${esc(m.titulo || "")} ${badgeMantEstado(m.estado)}${m.tecnico ? ` <span class="muted">· ${esc(m.tecnico)}</span>` : ""}`;
            return itemHist(icono, titulo, detalle, fechaLarga(m.fecha_programada || m.created_at), "mant");
        }
        const h = ev.h, campo = NOMBRE_CAMPO_EQ[h.campo] || h.campo;
        const val = (c, v) => c === "fecha_compra" || c === "garantia_hasta" ? (v ? fechaLarga(v) : "—") : (v || "—");
        if (h.accion === "Registrado") titulo = "Registrado en el inventario";
        else if (h.accion === "Asignación") titulo = `Asignado a <strong>${esc(h.valor_nuevo)}</strong>`;
        else if (h.accion === "Devolución") titulo = `Devuelto por <strong>${esc(h.valor_anterior || "—")}</strong>`;
        else if (h.accion === "Cambio de estado") titulo = `Estado: ${esc(h.valor_anterior || "—")} → <strong>${esc(h.valor_nuevo || "—")}</strong>`;
        else if (h.accion === "Acta de entrega" || h.accion === "Acta de devolución") titulo = `${esc(h.accion)} · ${esc(h.valor_nuevo || "")}`;
        else if (h.accion === "Etiqueta impresa") titulo = "Etiqueta QR impresa";
        else { titulo = `${esc(campo)} actualizado`; detalle = `${esc(truncar(val(h.campo, h.valor_anterior), 60))} → ${esc(truncar(val(h.campo, h.valor_nuevo), 60))}`; }
        if (h.accion === "Asignación" && h.valor_anterior) detalle = `Antes: ${esc(h.valor_anterior)}`;
        return itemHist(icono, titulo, detalle, formatFechaHora(h.created_at) + (h.usuario_nombre ? ` · ${esc(h.usuario_nombre)}` : ""), "");
    }).join("");
}

function itemHist(icono, titulo, detalle, meta, clase) {
    return `<div class="fq-ev ${clase}"><span class="fq-ev-ico"><i data-lucide="${icono}"></i></span>
        <div class="fq-ev-txt"><div class="fq-ev-tit">${titulo}</div>${detalle ? `<div class="fq-ev-det">${detalle}</div>` : ""}<div class="fq-ev-meta">${meta}</div></div></div>`;
}

function cerrarFichaEquipo() {
    document.getElementById("modalFichaEquipo").classList.remove("open");
    fichaEquipoId = null; fichaEquipo = null;
    if (/^#equipo=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
}

function verTicketDesdeFicha(id) {
    cerrarFichaEquipo();
    history.replaceState(null, "", `#ticket=${id}`);
    navegar("mantenimientos");
}

document.getElementById("modalFichaEquipo").addEventListener("click", function (e) { if (e.target === this) cerrarFichaEquipo(); });
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (document.getElementById("modalActa").classList.contains("open")) cerrarActa();
    else if (document.getElementById("modalEtiquetas").classList.contains("open")) document.getElementById("modalEtiquetas").classList.remove("open");
    else if (document.getElementById("modalFichaEquipo").classList.contains("open")) cerrarFichaEquipo();
});

/* ═══════════════ CÓDIGO QR ═══════════════ */
function crearQR(texto) {
    if (typeof qrcode !== "function") return null;
    const qr = qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    return qr;
}

function pintarQR(el, texto) {
    const qr = crearQR(texto);
    el.innerHTML = qr ? qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) : `<div class="fq-vacio">No se pudo generar el QR.</div>`;
}

// QR como imagen PNG (para el PDF del acta)
function qrComoPNG(texto, px = 240) {
    const qr = crearQR(texto);
    if (!qr) return null;
    const n = qr.getModuleCount(), margen = 2, celda = Math.floor(px / (n + margen * 2));
    const c = document.createElement("canvas");
    c.width = c.height = celda * (n + margen * 2);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) ctx.fillRect((k + margen) * celda, (r + margen) * celda, celda, celda);
    return c.toDataURL("image/png");
}

/* ═══════════════ ETIQUETAS ═══════════════ */
function abrirEtiquetas() {
    const lista = todosEquipos.filter(e => e.estado !== "Dado de baja");
    document.getElementById("etqLista").innerHTML = lista.length
        ? lista.map(e => `<label class="etq-item"><input type="checkbox" value="${e.id}" checked onchange="contarEtiquetas()">
            <span class="eq-codigo">${codigoEquipo(e)}</span><span>${esc(nombreEquipo(e))}</span><span class="muted">${esc(e.asignado_a || "")}</span></label>`).join("")
        : `<div class="fq-vacio">No hay equipos activos en el inventario.</div>`;
    document.getElementById("etqTodos").checked = true;
    document.getElementById("etqMsg").textContent = "";
    contarEtiquetas();
    document.getElementById("modalEtiquetas").classList.add("open");
}
function marcarTodasEtiquetas(v) { document.querySelectorAll("#etqLista input").forEach(c => c.checked = v); contarEtiquetas(); }
function contarEtiquetas() {
    const n = document.querySelectorAll("#etqLista input:checked").length;
    document.getElementById("etqCuenta").textContent = n;
}
function imprimirEtiquetasSeleccionadas() {
    const ids = [...document.querySelectorAll("#etqLista input:checked")].map(c => Number(c.value));
    if (!ids.length) { document.getElementById("etqMsg").textContent = "Selecciona al menos un equipo."; return; }
    imprimirEtiquetas(ids, document.getElementById("etqFormato").value);
    document.getElementById("modalEtiquetas").classList.remove("open");
}

async function imprimirEtiquetas(ids, formato = "hoja") {
    const equipos = ids.map(id => (fichaEquipo?.id === id ? fichaEquipo : null) || todosEquipos.find(e => e.id === id) || equiposParaAvisos.find(e => e.id === id)).filter(Boolean);
    if (!equipos.length) return;
    const etiqueta = e => {
        const qr = crearQR(urlFichaEquipo(e.id));
        return `<div class="et"><div class="qr">${qr ? qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true }) : ""}</div>
            <div class="tx"><div class="org">ALTERNA · IT</div><div class="cod">${codigoEquipo(e)}</div>
            <div class="nom">${esc(nombreEquipo(e))}</div>${e.numero_serie ? `<div class="sn">S/N ${esc(e.numero_serie)}</div>` : ""}</div></div>`;
    };
    const css = formato === "individual"
        ? `@page{size:62mm 29mm;margin:0}body{margin:0}.et{width:62mm;height:29mm;padding:2mm 2.5mm;box-sizing:border-box;page-break-after:always;break-after:page}`
        : `@page{size:letter;margin:10mm}.hoja{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}.et{height:29mm;padding:2mm 2.5mm;border:.2mm dashed #999;break-inside:avoid}`;
    const doc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas</title><style>
        *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000}
        .et{display:flex;gap:2.5mm;align-items:center;overflow:hidden}
        .qr{width:23mm;height:23mm;flex:none}.qr svg{width:100%;height:100%;display:block}
        .tx{min-width:0;line-height:1.15}.org{font-size:6pt;letter-spacing:.08em;font-weight:700}
        .cod{font-size:12pt;font-weight:800;margin:.6mm 0}.nom{font-size:7pt;max-height:2.4em;overflow:hidden}.sn{font-size:6pt;margin-top:.6mm;font-family:monospace}
        ${css}</style></head><body><div class="hoja">${equipos.map(etiqueta).join("")}</div></body></html>`;

    const ifr = document.createElement("iframe");
    ifr.setAttribute("aria-hidden", "true");
    ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(ifr);
    ifr.contentDocument.open(); ifr.contentDocument.write(doc); ifr.contentDocument.close();
    setTimeout(() => { ifr.contentWindow.focus(); ifr.contentWindow.print(); setTimeout(() => ifr.remove(), 60000); }, 250);

    const nombre = usuario?.nombre || null;
    await supabaseClient.from("equipos_historial").insert(equipos.map(e => ({ equipo_id: e.id, accion: "Etiqueta impresa", usuario_nombre: nombre })));
    if (fichaEquipoId && ids.includes(fichaEquipoId)) abrirFichaEquipo(fichaEquipoId);
}

/* ═══════════════ ACTAS DE ENTREGA Y DEVOLUCIÓN ═══════════════ */
let actaTipo = "entrega";

function abrirActa(tipo) {
    if (!fichaEquipo) return;
    actaTipo = tipo;
    const e = fichaEquipo, entrega = tipo === "entrega";
    document.getElementById("acTitulo").textContent = entrega ? "Acta de entrega" : "Acta de devolución";
    document.getElementById("acIntro").textContent = entrega
        ? `Genera el PDF para firmar al entregar ${nombreEquipo(e)} (${codigoEquipo(e)}).`
        : `Genera el PDF para firmar cuando el colaborador devuelve ${nombreEquipo(e)} (${codigoEquipo(e)}).`;
    document.getElementById("acPersonaLabel").textContent = entrega ? "Colaborador que recibe *" : "Colaborador que devuelve *";
    document.getElementById("acPersona").value = e.asignado_a || "";
    document.getElementById("acFecha").value = new Date().toLocaleDateString("en-CA");
    document.getElementById("acPuesto").value = "";
    document.getElementById("acCondicion").value = entrega && (aniosDeUso(e) ?? 1) < 0.1 ? "Nuevo" : "Buen estado";
    document.querySelectorAll("#acAccesorios input").forEach(c => c.checked = false);
    document.getElementById("acOtros").value = "";
    document.getElementById("acObs").value = "";
    document.getElementById("acActualizarTxt").textContent = entrega
        ? "Marcar el equipo como asignado a esta persona" : "Marcar el equipo como disponible (sin asignar)";
    const yaCoincide = entrega ? e.estado === "Asignado" && !!e.asignado_a : !e.asignado_a;
    document.getElementById("acActualizar").checked = !yaCoincide;
    document.getElementById("acMsg").textContent = "";
    document.getElementById("acGenerar").disabled = false;
    document.getElementById("modalActa").classList.add("open");
    document.getElementById("acPersona").focus();
}
function cerrarActa() { document.getElementById("modalActa").classList.remove("open"); }
document.getElementById("modalActa").addEventListener("click", function (e) { if (e.target === this) cerrarActa(); });

async function generarActa() {
    const msg = document.getElementById("acMsg");
    const persona = document.getElementById("acPersona").value.trim();
    if (!persona) { msg.style.color = "#ef4444"; msg.textContent = "Escribe el nombre del colaborador."; return; }
    if (!window.jspdf?.jsPDF) { msg.style.color = "#ef4444"; msg.textContent = "No se pudo cargar el generador de PDF. Recarga la página."; return; }
    const btn = document.getElementById("acGenerar");
    btn.disabled = true; msg.style.color = "#6b7280"; msg.textContent = "Generando PDF…";

    const e = fichaEquipo, entrega = actaTipo === "entrega";
    const u = usuariosParaEquipos.find(x => x.nombre.toLowerCase() === persona.toLowerCase());
    const nombrePersona = u?.nombre || persona;
    const fecha = document.getElementById("acFecha").value || new Date().toLocaleDateString("en-CA");
    const accesorios = [...document.querySelectorAll("#acAccesorios input:checked")].map(c => c.value)
        .concat(document.getElementById("acOtros").value.split(",").map(s => s.trim()).filter(Boolean));
    const datos = {
        e, entrega, persona: nombrePersona, puesto: document.getElementById("acPuesto").value.trim(), fecha,
        condicion: document.getElementById("acCondicion").value, accesorios, obs: document.getElementById("acObs").value.trim(),
        responsable: usuario?.nombre || "Área de IT",
    };
    try { pdfActa(datos); }
    catch (err) { console.error(err); msg.style.color = "#ef4444"; msg.textContent = "No se pudo generar el PDF."; btn.disabled = false; return; }

    // Registro en el historial y, si se pidió, actualizar la asignación
    const nombre = usuario?.nombre || null;
    const reg = await supabaseClient.from("equipos_historial").insert({ equipo_id: e.id, accion: entrega ? "Acta de entrega" : "Acta de devolución", valor_nuevo: nombrePersona, usuario_nombre: nombre });
    let errAct = null;
    if (document.getElementById("acActualizar").checked) {
        const cambio = entrega
            ? { asignado_a: nombrePersona, usuario_id: u?.id ?? null, estado: "Asignado" }
            : { asignado_a: null, usuario_id: null, estado: e.estado === "Asignado" ? "Disponible" : e.estado };
        errAct = (await supabaseClient.from("inventario_equipos").update(cambio).eq("id", e.id)).error;
    }
    if (reg.error || errAct) {
        msg.style.color = "#ef4444";
        msg.textContent = "El PDF se descargó, pero no se pudo actualizar el equipo: " + (errAct || reg.error).message;
        btn.disabled = false; return;
    }
    cerrarActa();
    avisoBreve("Acta generada. Imprímela y fírmala.");
    if (paginaActual === "equipos") cargarEquipos();
    abrirFichaEquipo(e.id);
}

function pdfActa(d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const W = doc.internal.pageSize.getWidth(), M = 20, ancho = W - M * 2;
    const e = d.e;
    const folio = `${codigoEquipo(e)}-${d.entrega ? "ENT" : "DEV"}-${d.fecha.replace(/-/g, "")}`;
    let y = 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(17, 17, 18);
    doc.text("ALTERNA", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110, 110, 115);
    doc.text("Área de Tecnología (IT)", M, y + 5);
    doc.text(`Folio: ${folio}`, W - M, y, { align: "right" });
    doc.text(`Fecha: ${fechaLarga(d.fecha)}`, W - M, y + 5, { align: "right" });
    y += 11; doc.setDrawColor(210, 210, 215); doc.line(M, y, W - M, y);

    y += 11; doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(17, 17, 18);
    doc.text(d.entrega ? "ACTA DE ENTREGA DE EQUIPO" : "ACTA DE DEVOLUCIÓN DE EQUIPO", W / 2, y, { align: "center" });

    y += 10; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
    const quien = d.puesto ? `${d.persona} (${d.puesto})` : d.persona;
    const intro = d.entrega
        ? `Por medio de la presente se hace constar que el ${fechaLarga(d.fecha)} el área de Tecnología de Alterna entrega a ${quien} el equipo descrito a continuación, en condición: ${d.condicion.toLowerCase()}.`
        : `Por medio de la presente se hace constar que el ${fechaLarga(d.fecha)} ${quien} devuelve al área de Tecnología de Alterna el equipo descrito a continuación, en condición: ${d.condicion.toLowerCase()}.`;
    const lineas = doc.splitTextToSize(intro, ancho);
    doc.text(lineas, M, y); y += lineas.length * 5 + 4;

    const filas = [
        ["Código de inventario", codigoEquipo(e)], ["Tipo", e.tipo || "—"], ["Marca", e.marca || "—"], ["Modelo", e.modelo || "—"],
        ["Número de serie", e.numero_serie || "—"], ["Procesador", e.procesador || "—"], ["Memoria RAM", e.ram || "—"],
        ["Almacenamiento", e.almacenamiento || "—"], ["Sistema operativo", e.sistema_operativo || "—"],
        ["Accesorios", d.accesorios.length ? d.accesorios.join(", ") : "Ninguno"],
    ];
    doc.autoTable({
        startY: y, margin: { left: M, right: M }, body: filas, theme: "grid",
        styles: { fontSize: 9.5, cellPadding: 2.2, textColor: [30, 30, 32], lineColor: [215, 215, 220] },
        columnStyles: { 0: { cellWidth: 52, fontStyle: "bold", fillColor: [245, 245, 247] } },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (d.obs) {
        doc.setFont("helvetica", "bold"); doc.text("Observaciones", M, y); y += 5;
        doc.setFont("helvetica", "normal");
        const o = doc.splitTextToSize(d.obs, ancho); doc.text(o, M, y); y += o.length * 5 + 4;
    }

    doc.setFont("helvetica", "bold"); doc.text(d.entrega ? "Compromisos de quien recibe" : "Constancia", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    const puntos = d.entrega ? [
        "Usar el equipo únicamente para actividades de trabajo.",
        "Cuidarlo y reportar al área de IT, de inmediato, cualquier falla, daño, pérdida o robo.",
        "No instalar programas ni hacer cambios de configuración sin autorización del área de IT.",
        "Devolver el equipo y sus accesorios cuando IT lo solicite o al terminar la relación laboral.",
    ] : [
        "El área de IT recibió el equipo y los accesorios descritos en esta acta.",
        "Las observaciones reflejan el estado del equipo al momento de la devolución.",
    ];
    puntos.forEach(p => { const l = doc.splitTextToSize("•  " + p, ancho - 4); doc.text(l, M + 2, y); y += l.length * 4.6 + 1; });

    // Firmas
    y = Math.max(y + 22, 222);
    const col = (ancho - 16) / 2;
    const firma = (x, titulo, nombre) => {
        doc.setDrawColor(60, 60, 65); doc.line(x, y, x + col, y);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(nombre, x + col / 2, y + 5, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setTextColor(110, 110, 115); doc.text(titulo, x + col / 2, y + 9.5, { align: "center" });
        doc.setTextColor(17, 17, 18);
    };
    firma(M, d.entrega ? "Entrega · Área de IT" : "Entrega · Colaborador", d.entrega ? d.responsable : d.persona);
    firma(M + col + 16, d.entrega ? "Recibe · Colaborador" : "Recibe · Área de IT", d.entrega ? d.persona : d.responsable);

    // QR de la ficha y pie
    const png = qrComoPNG(urlFichaEquipo(e.id));
    const H = doc.internal.pageSize.getHeight();
    if (png) doc.addImage(png, "PNG", W - M - 18, H - 32, 18, 18);
    doc.setFontSize(8); doc.setTextColor(140, 140, 145);
    doc.text(`Documento generado por Alterna IT el ${new Date().toLocaleString("es-GT")}. Escanea el código para ver la ficha del equipo.`, M, H - 14, { maxWidth: ancho - 24 });

    const limpio = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    doc.save(`Acta-${d.entrega ? "entrega" : "devolucion"}-${codigoEquipo(e)}-${limpio(d.persona).slice(0, 40)}.pdf`);
}

/* ═══════════════ REPORTE DE IT ═══════════════ */
let reporteITDias = 90;
let reporteITDatos = null;
let reporteITCargando = false;
const graficasIT = {};
// Paleta categórica validada (orden fijo; tonos propios para tema oscuro)
const SERIES_IT_CLARO  = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SERIES_IT_OSCURO = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
let forzarTemaClaroIT = false;

function cambiarReporte(tab) {
    document.querySelectorAll(".rep-tab").forEach(b => { const on = b.dataset.rep === tab; b.classList.toggle("activa", on); b.setAttribute("aria-selected", on); });
    document.getElementById("repIT").hidden = tab !== "it";
    document.getElementById("repActividades").hidden = tab !== "actividades";
    try { localStorage.setItem("alterna_reporte_tab", tab); } catch { /* sin almacenamiento */ }
    if (tab === "it") cargarReporteIT(reporteITDias);
    else renderReportes();
}

async function cargarReporteIT(dias) {
    reporteITDias = dias;
    document.querySelectorAll("#repItPeriodos .periodo-btn").forEach(b => b.classList.toggle("active", Number(b.dataset.dias) === dias));
    document.getElementById("repItBadge").textContent = dias ? (dias === 365 ? "Último año" : dias === 30 ? "Último mes" : `Últimos ${dias} días`) : "Todo el historial";
    if (reporteITCargando) return;
    reporteITCargando = true;
    document.getElementById("repItKpis").innerHTML = `<div class="fq-vacio">Cargando reporte…</div>`;
    const { data, error } = await supabaseClient.rpc("reporte_it", { p_dias: dias });
    reporteITCargando = false;
    if (dias !== reporteITDias) return cargarReporteIT(reporteITDias);
    if (error) { document.getElementById("repItKpis").innerHTML = `<div class="fq-vacio">No se pudo cargar el reporte: ${esc(error.message)}</div>`; return; }
    reporteITDatos = data;
    pintarReporteIT();
}

function coloresIT() {
    const oscuro = !forzarTemaClaroIT && document.body.classList.contains("cfg-dark");
    return {
        serie: oscuro ? SERIES_IT_OSCURO : SERIES_IT_CLARO,
        texto: oscuro ? "#c4d0e2" : "#475569", rejilla: oscuro ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.07)",
        neutro: oscuro ? "#5b6b82" : "#b8c2d1", superficie: oscuro ? "#1c1c1e" : "#ffffff",
    };
}

function graficar(id, tipo, etiquetas, series, opciones = {}) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    graficasIT[id]?.destroy();
    const caja = canvas.parentElement;
    caja.querySelector(".rep-vacio")?.remove();
    const total = series.reduce((s, d) => s + d.data.reduce((a, b) => a + (Number(b) || 0), 0), 0);
    if (!total) {
        canvas.style.display = "none";
        caja.insertAdjacentHTML("beforeend", `<div class="rep-vacio">${esc(opciones.vacio || "Sin datos en este periodo")}</div>`);
        delete graficasIT[id];
        return;
    }
    canvas.style.display = "";
    const c = coloresIT();
    const horizontal = !!opciones.horizontal;
    const varias = series.length > 1;
    const ejeValor = {
        beginAtZero: true, stacked: !!opciones.apilado, grid: { color: c.rejilla }, border: { display: false },
        ticks: { color: c.texto, precision: 0, font: { size: 11 }, ...(opciones.formato ? { callback: v => opciones.formato(v) } : {}) },
    };
    const ejeCat = { stacked: !!opciones.apilado, grid: { display: false }, border: { color: c.rejilla }, ticks: { color: c.texto, font: { size: 11 } } };
    graficasIT[id] = new Chart(canvas, {
        type: tipo,
        data: {
            labels: etiquetas,
            datasets: series.map((s, i) => ({
                label: s.label, data: s.data,
                backgroundColor: s.colores || s.color || c.serie[i], borderRadius: 4, borderSkipped: opciones.apilado ? false : "start",
                borderColor: c.superficie, borderWidth: opciones.apilado ? { top: 2 } : 0,
                maxBarThickness: 34,
            })),
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
            indexAxis: horizontal ? "y" : "x",
            plugins: {
                legend: { display: varias, position: "top", align: "start", labels: { color: c.texto, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3, font: { size: 11 } } },
                tooltip: { callbacks: opciones.formato ? { label: ctx => `${ctx.dataset.label ? ctx.dataset.label + ": " : ""}${opciones.formato(ctx.parsed[horizontal ? "x" : "y"])}` } : {} },
            },
            scales: horizontal ? { x: ejeValor, y: ejeCat } : { x: ejeCat, y: ejeValor },
        },
    });
}

function pintarReporteIT() {
    const d = reporteITDatos;
    if (!d) return;
    const c = coloresIT();
    const eq = d.equipos, mt = d.mantenimientos, li = d.licencias;
    const horas = mt.resolucion_horas;
    const fmtHoras = h => h == null ? "—" : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round(h / 24 * 10) / 10} días`;
    const kpi = (titulo, valor, nota, alerta) => `<div class="rep-kpi${alerta ? " alerta" : ""}"><div class="rep-kpi-t">${titulo}</div><div class="rep-kpi-v">${valor}</div><div class="rep-kpi-n">${nota}</div></div>`;
    const enUso = (eq.por_estado?.Asignado || 0);
    document.getElementById("repItKpis").innerHTML = [
        kpi("Equipos", eq.total, `${enUso} asignado${enUso !== 1 ? "s" : ""}`),
        kpi("Para renovar", eq.antiguedad.mas_4, `${ANIOS_RENOVACION}+ años de uso`, eq.antiguedad.mas_4 > 0),
        kpi("Garantías por vencer", eq.garantia.por_vencer_90, "en los próximos 90 días", eq.garantia.por_vencer_90 > 0),
        kpi("Mantenimientos", mt.total, mt.vencidos ? `${mt.vencidos} atrasado${mt.vencidos !== 1 ? "s" : ""}` : "ninguno atrasado", mt.vencidos > 0),
        kpi("Tiempo de resolución", fmtHoras(horas), "promedio hasta completar"),
        kpi("Licencias por vencer", li.vencen_30, li.vencidas ? `en 30 días · ${li.vencidas} vencida${li.vencidas !== 1 ? "s" : ""}` : "en los próximos 30 días", li.vencen_30 + li.vencidas > 0),
    ].join("");

    const ordenEstados = ["Disponible", "Asignado", "En mantenimiento", "Dado de baja"];
    const estados = [...ordenEstados.filter(k => eq.por_estado?.[k]), ...Object.keys(eq.por_estado || {}).filter(k => !ordenEstados.includes(k))];
    graficar("repEqEstado", "bar", estados, [{ label: "Equipos", data: estados.map(k => eq.por_estado[k]) }], { horizontal: true, vacio: "Aún no hay equipos registrados" });

    const a = eq.antiguedad;
    graficar("repEqEdad", "bar", ["< 1 año", "1–2 años", "2–3 años", "3–4 años", "4+ años", "Sin fecha"],
        [{ label: "Equipos", data: [a.menos_1, a.de_1_a_2, a.de_2_a_3, a.de_3_a_4, a.mas_4, a.sin_dato],
           colores: [c.serie[0], c.serie[0], c.serie[0], c.serie[0], c.serie[0], c.neutro] }], { vacio: "Aún no hay equipos registrados" });

    const meses = [...new Set(mt.por_mes.map(x => x.mes))].sort();
    const tipos = [...new Set(mt.por_mes.map(x => x.tipo))].sort();
    const nombreMes = m => new Date(m + "-01T00:00:00").toLocaleDateString("es-GT", { month: "short", year: "numeric" });
    graficar("repMtMes", "bar", meses.map(nombreMes),
        tipos.slice(0, 8).map(t => ({ label: t, data: meses.map(m => mt.por_mes.find(x => x.mes === m && x.tipo === t)?.n || 0) })),
        { apilado: true, vacio: "Sin mantenimientos en este periodo" });

    graficar("repMtTecnico", "bar", mt.por_tecnico.map(x => x.tecnico), [
        { label: "Completados", data: mt.por_tecnico.map(x => x.completados) },
        { label: "Pendientes", data: mt.por_tecnico.map(x => x.total - x.completados) },
    ], { horizontal: true, apilado: true, vacio: "Sin mantenimientos en este periodo" });

    graficar("repMtResol", "bar", mt.resolucion_por_tecnico.map(x => x.tecnico),
        [{ label: "Horas promedio", data: mt.resolucion_por_tecnico.map(x => Number(x.horas)) }],
        { horizontal: true, formato: v => fmtHoras(v), vacio: "Aún no hay mantenimientos completados en este periodo" });

    graficar("repLic", "bar", ["Vencidas", "0–30 días", "31–60 días", "61–90 días"],
        [{ label: "Licencias", data: [li.vencidas, li.vencen_30, li.vencen_60, li.vencen_90] }],
        { vacio: li.total ? "Ninguna licencia vence en los próximos 90 días" : "No hay licencias registradas" });

    const g = eq.garantia;
    graficar("repEqGar", "bar", ["Vigente", "Vence en 90 días", "Vencida", "Sin dato"],
        [{ label: "Equipos", data: [g.vigente, g.por_vencer_90, g.vencida, g.sin_dato], colores: [c.serie[0], c.serie[0], c.serie[0], c.neutro] }],
        { vacio: "Aún no hay equipos registrados" });

    const filas = filasVencimientos();
    document.getElementById("repItTabla").innerHTML = filas.length
        ? `<div class="table-wrap rep-tabla"><table><thead><tr><th>Qué vence</th><th>Nombre</th><th>Detalle</th><th>Fecha</th></tr></thead><tbody>${filas.map(f =>
            `<tr${f.equipoId ? ` class="eq-fila" onclick="abrirFichaEquipo(${f.equipoId})"` : ""}><td data-label="Qué vence">${f.tipo}</td><td data-label="Nombre"><strong>${esc(f.nombre)}</strong></td><td data-label="Detalle" style="color:var(--ui-muted)">${esc(f.detalle)}</td>
             <td data-label="Fecha"><span class="eq-gar ${f.dias < 0 ? "vencida" : "por-vencer"}">${esc(f.cuando)}</span></td></tr>`).join("")}</tbody></table></div>`
        : `<div class="rep-vacio estatico">Nada vence en los próximos 90 días.</div>`;
}

function filasVencimientos() {
    const d = reporteITDatos;
    if (!d) return [];
    const hoy = hoySinHora();
    const cuando = iso => {
        const dias = Math.round((new Date(iso + "T00:00:00") - hoy) / DIA_MS);
        return { dias, cuando: dias < 0 ? `Venció hace ${-dias} d` : dias === 0 ? "Hoy" : `${fechaCorta(iso)} · en ${dias} d` };
    };
    return [
        ...d.equipos.garantias_proximas.map(x => ({ tipo: "Garantía", nombre: x.equipo, detalle: [x.serie && `S/N ${x.serie}`, x.asignado].filter(Boolean).join(" · "), equipoId: x.id, ...cuando(x.vence) })),
        ...d.licencias.proximas.map(x => ({ tipo: "Licencia Office", nombre: x.nombre || x.correo || "Sin nombre", detalle: [x.correo, x.tipo].filter(Boolean).join(" · "), ...cuando(x.vence) })),
    ].sort((a, b) => a.dias - b.dias);
}

async function exportarReporteITPdf() {
    if (!reporteITDatos || !window.jspdf?.jsPDF) return;
    const btn = document.getElementById("repItPdf");
    btn.disabled = true;
    // Las gráficas se exportan siempre con colores claros (fondo blanco del PDF)
    forzarTemaClaroIT = true; pintarReporteIT();
    await new Promise(r => setTimeout(r, 350));
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "mm", format: "letter" });
        const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 15;
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Reporte de IT — Alterna", M, 18);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110, 110, 115);
        doc.text(`${document.getElementById("repItBadge").textContent} · generado el ${new Date().toLocaleString("es-GT")}`, M, 24);
        doc.setTextColor(17, 17, 18);
        const kpis = [...document.querySelectorAll("#repItKpis .rep-kpi")].map(k => [k.querySelector(".rep-kpi-t").textContent, k.querySelector(".rep-kpi-v").textContent, k.querySelector(".rep-kpi-n").textContent]);
        doc.autoTable({ startY: 29, margin: { left: M, right: M }, head: [["Indicador", "Valor", "Detalle"]], body: kpis, theme: "striped",
            styles: { fontSize: 9 }, headStyles: { fillColor: [42, 120, 214] } });
        let y = doc.lastAutoTable.finalY + 8;
        const cajas = [...document.querySelectorAll("#repItGraficas .report-card")].filter(cj => cj.querySelector("canvas"));
        const anchoG = (W - M * 2 - 6) / 2, altoG = 58;
        let col = 0;
        for (const cj of cajas) {
            const canvas = cj.querySelector("canvas");
            const titulo = cj.querySelector(".report-card-title").textContent;
            if (y + altoG + 8 > H - 12) { doc.addPage(); y = 18; col = 0; }
            const x = M + col * (anchoG + 6);
            doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(titulo, x, y);
            if (canvas.style.display === "none") {
                doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 145); doc.text(cj.querySelector(".rep-vacio")?.textContent || "Sin datos", x, y + 8); doc.setTextColor(17, 17, 18);
            } else {
                const blanco = document.createElement("canvas");
                blanco.width = canvas.width; blanco.height = canvas.height;
                const ctx = blanco.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, blanco.width, blanco.height); ctx.drawImage(canvas, 0, 0);
                const prop = canvas.height / canvas.width;
                doc.addImage(blanco.toDataURL("image/png"), "PNG", x, y + 3, anchoG, Math.min(altoG, anchoG * prop));
            }
            col = (col + 1) % 2;
            if (col === 0) y += altoG + 10;
        }
        if (col === 1) y += altoG + 10;
        const filas = filasVencimientos();
        if (filas.length) {
            if (y > H - 40) { doc.addPage(); y = 18; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text("Próximos vencimientos (90 días)", M, y);
            doc.autoTable({ startY: y + 3, margin: { left: M, right: M }, head: [["Qué vence", "Nombre", "Detalle", "Fecha"]],
                body: filas.map(f => [f.tipo, f.nombre, f.detalle, f.cuando]), styles: { fontSize: 8.5 }, headStyles: { fillColor: [42, 120, 214] } });
        }
        doc.save(`Reporte-IT-${new Date().toLocaleDateString("en-CA")}.pdf`);
    } catch (err) { console.error(err); avisoBreve("No se pudo generar el PDF.", "error"); }
    finally { forzarTemaClaroIT = false; pintarReporteIT(); btn.disabled = false; }
}

// Al cambiar de tema, las gráficas de IT se repintan con su paleta
let temaOscuroIT = document.body.classList.contains("cfg-dark");
new MutationObserver(() => {
    const oscuro = document.body.classList.contains("cfg-dark");
    if (oscuro === temaOscuroIT) return;
    temaOscuroIT = oscuro;
    if (!document.getElementById("repIT").hidden && reporteITDatos) pintarReporteIT();
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });

// Pestaña de reportes recordada
try { if (localStorage.getItem("alterna_reporte_tab") === "it") { document.getElementById("repIT").hidden = false; document.getElementById("repActividades").hidden = true;
    document.querySelectorAll(".rep-tab").forEach(b => { const on = b.dataset.rep === "it"; b.classList.toggle("activa", on); b.setAttribute("aria-selected", on); }); } } catch { /* sin almacenamiento */ }

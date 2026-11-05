// Consultas de Alterna IA sobre los datos del área de IT (solo para quien tiene acceso a la aplicación IT).
// Inventario de equipos, historial de un equipo, mantenimientos y licencias Office.
// Las contraseñas, PIN y datos de recuperación de licencias viven cifrados en otra tabla y NUNCA se consultan aquí.

export const NOMBRES_IT = ["consultar_it"];

export const HERRAMIENTAS_IT = [{
  type: "function",
  function: {
    name: "consultar_it",
    description: "Consulta en vivo los datos del área de IT: inventario de equipos (asignación, especificaciones, garantía y antigüedad), la ficha e historial de un equipo, los tickets de mantenimiento y las licencias de Office con sus vencimientos (nunca incluye contraseñas). Úsala siempre que pregunten por equipos, quién tiene qué equipo, equipos libres, garantías, equipos viejos, mantenimientos o licencias.",
    parameters: {
      type: "object",
      properties: {
        consulta: {
          type: "string", enum: ["resumen", "equipos", "equipo", "mantenimientos", "licencias"],
          description: "resumen: totales y alertas de IT. equipos: lista filtrada del inventario. equipo: ficha completa e historial de UN equipo (usa equipo_id o busqueda). mantenimientos: tickets. licencias: licencias Office y su vencimiento.",
        },
        busqueda: { type: "string", description: "Texto a buscar: nombre de la persona, tipo, marca, modelo, número de serie, código (EQ-0012), correo o número de ticket." },
        estado: { type: "string", description: "Equipos: Disponible, Asignado, En mantenimiento o Dado de baja. Mantenimientos: Programado, En proceso, Completado o Cancelado." },
        equipo_id: { type: "integer", description: "Id del equipo (el número del código EQ-0012 es 12)." },
        dias: { type: "integer", description: "Equipos: garantías que vencen en los próximos N días. Licencias: que vencen en los próximos N días (incluye las ya vencidas). Mantenimientos: programados entre hace N días y dentro de N días." },
      },
      required: ["consulta"],
    },
  },
}];

const DIA = 86400000;
const hoy = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };
const dias = (iso: string | null) => iso ? Math.round((Date.parse(iso.slice(0, 10) + "T00:00:00Z") - hoy().getTime()) / DIA) : null;
const codigo = (e: any) => e?.codigo || "EQ-" + String(e?.id ?? 0).padStart(4, "0");
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const coincide = (q: string, ...vals: unknown[]) => !q || vals.some((v) => norm(v).includes(q));

function fechaLicencia(s: string | null): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function vistaEquipo(e: any) {
  const anios = e.fecha_compra ? Math.max(0, (hoy().getTime() - Date.parse(e.fecha_compra + "T00:00:00Z")) / (365.25 * DIA)) : null;
  const dg = dias(e.garantia_hasta);
  return {
    id: e.id, codigo: codigo(e), tipo: e.tipo, marca: e.marca, modelo: e.modelo, serie: e.numero_serie, estado: e.estado,
    asignado_a: e.asignado_a, procesador: e.procesador, ram: e.ram, almacenamiento: e.almacenamiento, sistema_operativo: e.sistema_operativo,
    fecha_compra: e.fecha_compra, antiguedad_anios: anios === null ? null : Math.round(anios * 10) / 10,
    garantia_hasta: e.garantia_hasta,
    garantia: dg === null ? "sin dato" : dg < 0 ? `vencida hace ${-dg} días` : `vigente, vence en ${dg} días`,
    notas: e.notas ? String(e.notas).slice(0, 200) : null,
  };
}

const COLS_EQ = "id, codigo, tipo, marca, modelo, numero_serie, estado, asignado_a, procesador, ram, almacenamiento, sistema_operativo, fecha_compra, garantia_hasta, notas";

function idDeBusqueda(q: string): number | null {
  const m = q.match(/^eq-?0*(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
}

export async function consultarIT(db: any, a: Record<string, any>): Promise<unknown> {
  const consulta = String(a.consulta ?? "resumen");
  const q = norm(a.busqueda);
  const estado = norm(a.estado);
  const n = Number.isFinite(Number(a.dias)) && Number(a.dias) > 0 ? Math.min(Number(a.dias), 3650) : null;

  if (consulta === "equipo") {
    let id = Number(a.equipo_id) || null;
    if (!id && q) {
      const { data } = await db.from("inventario_equipos").select(COLS_EQ).limit(2000);
      // Primero el código exacto (los códigos se escriben a mano al crear el equipo)
      id = (data ?? []).find((e: any) => norm(codigo(e)) === q)?.id ?? null;
    }
    if (!id && q) id = idDeBusqueda(q);
    if (!id && q) {
      const { data } = await db.from("inventario_equipos").select(COLS_EQ).limit(2000);
      const hall = (data ?? []).filter((e: any) => coincide(q, e.numero_serie, e.asignado_a, e.tipo, e.marca, e.modelo, codigo(e)));
      if (hall.length > 1) return { aviso: "Hay varios equipos que coinciden; pide que elija uno.", coincidencias: hall.slice(0, 15).map(vistaEquipo) };
      id = hall[0]?.id;
    }
    if (!id) return { error: "No encontré ese equipo." };
    const [eq, hist, mts] = await Promise.all([
      db.from("inventario_equipos").select(COLS_EQ).eq("id", id).maybeSingle(),
      db.from("equipos_historial").select("accion, campo, valor_anterior, valor_nuevo, usuario_nombre, created_at").eq("equipo_id", id).order("created_at", { ascending: false }).limit(40),
      db.from("mantenimientos").select("numero_ticket, titulo, tipo, estado, fecha_programada, tecnico").eq("equipo_id", id).order("fecha_programada", { ascending: false }).limit(30),
    ]);
    if (!eq.data) return { error: `No existe el equipo ${codigo({ id })}.` };
    return { equipo: vistaEquipo(eq.data), historial: hist.data ?? [], mantenimientos: mts.data ?? [] };
  }

  if (consulta === "equipos" || consulta === "resumen") {
    const { data, error } = await db.from("inventario_equipos").select(COLS_EQ).limit(2000);
    if (error) return { error: "No se pudo leer el inventario." };
    const todos = (data ?? []) as any[];
    if (consulta === "resumen") {
      const [mts, lics] = await Promise.all([
        db.from("mantenimientos").select("estado, fecha_programada").limit(5000),
        db.from("licencias_office").select("fecha_expiracion").limit(2000),
      ]);
      const cuenta = (arr: any[], f: (x: any) => string) => arr.reduce((o: Record<string, number>, x) => { const k = f(x); o[k] = (o[k] ?? 0) + 1; return o; }, {});
      const M = mts.data ?? [], L = (lics.data ?? []).map((l: any) => dias(fechaLicencia(l.fecha_expiracion)));
      return {
        fecha_hoy: hoy().toISOString().slice(0, 10),
        equipos: {
          total: todos.length, por_estado: cuenta(todos, (e) => e.estado ?? "Sin estado"), por_tipo: cuenta(todos, (e) => e.tipo ?? "Sin tipo"),
          garantia_vence_90_dias: todos.filter((e) => { const d = dias(e.garantia_hasta); return d !== null && d >= 0 && d <= 90; }).length,
          garantia_vencida: todos.filter((e) => (dias(e.garantia_hasta) ?? 1) < 0).length,
          con_4_anios_o_mas: todos.filter((e) => (vistaEquipo(e).antiguedad_anios ?? 0) >= 4 && e.estado !== "Dado de baja").length,
        },
        mantenimientos: {
          total: M.length, por_estado: cuenta(M, (m) => m.estado ?? "Programado"),
          atrasados: M.filter((m: any) => ["Programado", "En proceso"].includes(m.estado) && (dias(m.fecha_programada) ?? 0) < 0).length,
        },
        licencias_office: {
          total: L.length, vencidas: L.filter((d: any) => d !== null && d < 0).length,
          vencen_30_dias: L.filter((d: any) => d !== null && d >= 0 && d <= 30).length, sin_fecha: L.filter((d: any) => d === null).length,
        },
      };
    }
    const exacto = q ? todos.find((e) => norm(codigo(e)) === q) : null;
    const idq = exacto ? exacto.id : idDeBusqueda(q);
    const lista = todos.filter((e) =>
      (!estado || norm(e.estado) === estado) &&
      (idq ? e.id === idq : coincide(q, e.tipo, e.marca, e.modelo, e.numero_serie, e.asignado_a, e.procesador, codigo(e))) &&
      (!n || (() => { const d = dias(e.garantia_hasta); return d !== null && d <= n; })()))
      .sort((x, y) => x.id - y.id);
    return { total: lista.length, mostrados: Math.min(lista.length, 60), equipos: lista.slice(0, 60).map(vistaEquipo) };
  }

  if (consulta === "mantenimientos") {
    const [mts, eqs, us] = await Promise.all([
      db.from("mantenimientos").select("id, numero_ticket, titulo, tipo, estado, prioridad, fecha_programada, fecha_realizada, tecnico, equipo_id, usuario_id, descripcion").order("fecha_programada", { ascending: false }).limit(3000),
      db.from("inventario_equipos").select("id, codigo, tipo, marca, modelo").limit(2000),
      db.from("usuarios").select("id, nombre").limit(2000),
    ]);
    const E = new Map((eqs.data ?? []).map((e: any) => [e.id, e]));
    const U = new Map((us.data ?? []).map((u: any) => [u.id, u.nombre]));
    const lista = (mts.data ?? []).map((m: any) => {
      const e: any = m.equipo_id ? E.get(m.equipo_id) : null;
      return {
        ticket: m.numero_ticket, titulo: m.titulo, tipo: m.tipo, estado: m.estado, prioridad: m.prioridad, fecha_programada: m.fecha_programada,
        fecha_realizada: m.fecha_realizada, tecnico: m.tecnico, usuario: U.get(m.usuario_id) ?? null,
        equipo: e ? `${codigo(e)} ${[e.tipo, e.marca, e.modelo].filter(Boolean).join(" ")}` : null,
        descripcion: m.descripcion ? String(m.descripcion).slice(0, 160) : null,
      };
    }).filter((m: any) => (!estado || norm(m.estado) === estado)
      && coincide(q, m.ticket, m.titulo, m.tipo, m.tecnico, m.usuario, m.equipo)
      && (!n || (() => { const d = dias(m.fecha_programada); return d !== null && Math.abs(d) <= n; })()));
    return { total: lista.length, mostrados: Math.min(lista.length, 60), mantenimientos: lista.slice(0, 60) };
  }

  if (consulta === "licencias") {
    const { data, error } = await db.from("licencias_office").select("numero_licencia, slot, nombre, tipo, correo, nombre_cuenta, fecha_expiracion, pais").limit(2000);
    if (error) return { error: "No se pudieron leer las licencias." };
    const lista = (data ?? []).map((l: any) => {
      const f = fechaLicencia(l.fecha_expiracion), d = dias(f);
      return { licencia: l.numero_licencia, slot: l.slot, nombre: l.nombre, tipo: l.tipo, correo: l.correo, cuenta: l.nombre_cuenta, pais: l.pais,
        vence: f, estado: d === null ? "sin fecha" : d < 0 ? `vencida hace ${-d} días` : `vence en ${d} días`, _d: d };
    }).filter((l: any) => coincide(q, l.nombre, l.correo, l.cuenta, l.tipo) && (!n || (l._d !== null && l._d <= n)))
      .sort((x: any, y: any) => (x._d ?? 1e9) - (y._d ?? 1e9))
      .map(({ _d, ...l }: any) => l);
    return { total: lista.length, mostrados: Math.min(lista.length, 80), nota: "Las contraseñas y PIN no están disponibles para la IA; se ven en la página de Licencias.", licencias: lista.slice(0, 80) };
  }

  return { error: "Consulta no soportada." };
}

// Resumen compacto para el contexto del sistema (pocas cifras; los detalles se piden con consultar_it).
export async function resumenIT(db: any) {
  try { return await consultarIT(db, { consulta: "resumen" }); } catch { return null; }
}

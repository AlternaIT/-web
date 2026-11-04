// Acciones de la IA sobre el sistema. La IA solo PROPONE; nada se escribe hasta que el usuario confirma.
const NIVELES = ["Alta", "Media", "Baja"];
const ESTADOS = ["No iniciado", "En proceso", "Terminado"];
const TIPOS_MANT = ["Preventivo", "Correctivo"];

const esFecha = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const txt = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const nivel = (v: unknown, def: string | null = null) => NIVELES.find((n) => n.toLowerCase() === String(v ?? "").toLowerCase()) ?? def;
const estado = (v: unknown) => ESTADOS.find((n) => n.toLowerCase() === String(v ?? "").toLowerCase()) ?? null;

export const NOMBRES_ACCION = ["crear_actividad", "actualizar_actividad", "programar_mantenimiento"];

const fecha = { type: "string", description: "Fecha en formato YYYY-MM-DD" };
export const HERRAMIENTAS_ACCION = [
  {
    type: "function",
    function: {
      name: "crear_actividad",
      description: "Propone crear una actividad (tarea) en el sistema. El usuario debe confirmarla antes de guardarse.",
      parameters: {
        type: "object",
        properties: {
          actividad: { type: "string", description: "Título claro de la actividad" },
          proyecto_macro: { type: "string" },
          prioridad: { type: "string", enum: NIVELES },
          importancia: { type: "string", enum: NIVELES },
          area: { type: "string" },
          asignado: { type: "string", description: "Nombre de la persona responsable" },
          fecha_entrega: fecha,
          notas: { type: "string" },
        },
        required: ["actividad"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_actividad",
      description: "Propone modificar una actividad existente (estado, prioridad, responsable, fechas, notas). Usa el id real del contexto. El usuario debe confirmar.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Id de la actividad (del contexto)" },
          estado: { type: "string", enum: ESTADOS },
          prioridad: { type: "string", enum: NIVELES },
          importancia: { type: "string", enum: NIVELES },
          asignado: { type: "string" },
          fecha_entrega: fecha,
          fecha_limite: fecha,
          notas: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "programar_mantenimiento",
      description: "Propone programar un mantenimiento (ticket) para un equipo del inventario. Usa el id real del equipo que devuelve consultar_it (EQ-0012 → 12). El usuario debe confirmar.",
      parameters: {
        type: "object",
        properties: {
          equipo_id: { type: "integer", description: "Id del equipo (de consultar_it)" },
          titulo: { type: "string", description: "Título corto del mantenimiento" },
          tipo: { type: "string", enum: TIPOS_MANT },
          prioridad: { type: "string", enum: NIVELES },
          fecha_programada: fecha,
          descripcion: { type: "string" },
          tecnico: { type: "string" },
        },
        required: ["equipo_id", "tipo", "fecha_programada"],
      },
    },
  },
];

// Valida lo que pidió el modelo, lo guarda como propuesta pendiente y devuelve su id (o un error legible).
export async function proponer(db: any, user: any, convId: string, nombre: string, a: Record<string, any>): Promise<{ id?: string; error?: string }> {
  let datos: Record<string, any>, resumen: string;

  if (nombre === "crear_actividad") {
    const actividad = txt(a.actividad);
    if (!actividad) return { error: "Falta el título de la actividad." };
    if (a.fecha_entrega != null && !esFecha(a.fecha_entrega)) return { error: "La fecha de entrega debe tener formato AAAA-MM-DD." };
    datos = {
      actividad, proyecto_macro: txt(a.proyecto_macro), prioridad: nivel(a.prioridad, "Media"), importancia: nivel(a.importancia, "Media"),
      area: txt(a.area), asignado: txt(a.asignado), fecha_entrega: a.fecha_entrega ?? null, notas: txt(a.notas, 2000),
    };
    resumen = `Crear actividad «${actividad}»`;
  } else if (nombre === "actualizar_actividad") {
    const id = Number(a.id);
    const { data: act } = await db.from("actividades").select("id, actividad, estado, prioridad, importancia, asignado, fecha_entrega, fecha_limite, notas").eq("id", id).maybeSingle();
    if (!act) return { error: `No existe la actividad #${a.id}.` };
    const nuevos: Record<string, any> = {};
    if (a.estado != null) { const e = estado(a.estado); if (!e) return { error: "Estado no válido." }; nuevos.estado = e; }
    if (a.prioridad != null) { const n = nivel(a.prioridad); if (!n) return { error: "Prioridad no válida." }; nuevos.prioridad = n; }
    if (a.importancia != null) { const n = nivel(a.importancia); if (!n) return { error: "Importancia no válida." }; nuevos.importancia = n; }
    if (a.asignado != null) nuevos.asignado = txt(a.asignado);
    if (a.notas != null) nuevos.notas = txt(a.notas, 2000);
    for (const f of ["fecha_entrega", "fecha_limite"]) if (a[f] != null) { if (!esFecha(a[f])) return { error: `${f} debe tener formato AAAA-MM-DD.` }; nuevos[f] = a[f]; }
    const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
    for (const [k, v] of Object.entries(nuevos)) if (String(act[k] ?? "") !== String(v ?? "")) cambios[k] = { antes: act[k] ?? null, despues: v };
    if (!Object.keys(cambios).length) return { error: `La actividad #${id} ya tiene esos valores; no hay cambios.` };
    datos = { id, titulo: act.actividad, cambios };
    resumen = `Actualizar actividad #${id} «${act.actividad}»`;
  } else if (nombre === "programar_mantenimiento") {
    const eid = Number(a.equipo_id ?? a.computadora_id);
    const { data: eq } = await db.from("inventario_equipos").select("id, tipo, marca, modelo, asignado_a, usuario_id").eq("id", eid).maybeSingle();
    if (!eq) return { error: `No existe el equipo EQ-${String(eid).padStart(4, "0")}.` };
    const tipo = TIPOS_MANT.find((t) => t.toLowerCase() === String(a.tipo ?? "").toLowerCase());
    if (!tipo) return { error: "Tipo de mantenimiento no válido (Preventivo o Correctivo)." };
    if (!esFecha(a.fecha_programada)) return { error: "La fecha programada debe tener formato AAAA-MM-DD." };
    const nombreEq = [eq.tipo, eq.marca, eq.modelo].filter(Boolean).join(" ") || `Equipo ${eid}`;
    let usuarioId = eq.usuario_id ?? null;
    if (!usuarioId && eq.asignado_a) {
      const { data: u } = await db.from("usuarios").select("id").ilike("nombre", eq.asignado_a).limit(1).maybeSingle();
      usuarioId = u?.id ?? null;
    }
    datos = {
      equipo_id: eid, equipo: nombreEq, usuario_id: usuarioId, titulo: txt(a.titulo, 120) ?? `Mantenimiento ${tipo.toLowerCase()} · ${nombreEq}`,
      tipo, prioridad: nivel(a.prioridad, "Media"), fecha_programada: a.fecha_programada, descripcion: txt(a.descripcion, 1000), tecnico: txt(a.tecnico),
    };
    resumen = `Programar mantenimiento ${tipo.toLowerCase()} para «${nombreEq}» (EQ-${String(eid).padStart(4, "0")})`;
  } else return { error: "Acción no soportada." };

  const { data, error } = await db.from("ia_acciones").insert({ usuario_id: user.id, conversacion_id: convId, tipo: nombre, datos, resumen }).select("id").single();
  if (error) return { error: "No se pudo preparar la acción." };
  return { id: data.id };
}

export async function infoAcciones(db: any, user: any, ids: string[]) {
  const { data } = await db.from("ia_acciones").select("id, tipo, resumen, datos, estado, resultado")
    .eq("usuario_id", user.id).in("id", ids.slice(0, 20));
  return data ?? [];
}

// Confirma o cancela una propuesta. Solo administradores pueden ejecutar escrituras.
export async function resolver(db: any, user: any, id: string, confirmar: boolean): Promise<{ estado: string; resultado: string }> {
  const { data: acc } = await db.from("ia_acciones").select("*").eq("id", id).eq("usuario_id", user.id).maybeSingle();
  if (!acc) throw new Error("Acción no encontrada");
  if (acc.estado !== "pendiente") return { estado: acc.estado, resultado: acc.resultado ?? "" };

  // Reclamo atómico: evita doble ejecución si se pulsa dos veces.
  const { data: reclamo } = await db.from("ia_acciones").update({ resuelta_at: new Date().toISOString() })
    .eq("id", id).eq("estado", "pendiente").is("resuelta_at", null).select("id");
  if (!reclamo?.length) return { estado: acc.estado, resultado: acc.resultado ?? "" };

  const cerrar = async (est: string, resultado: string) => {
    await db.from("ia_acciones").update({ estado: est, resultado }).eq("id", id);
    return { estado: est, resultado };
  };

  if (!confirmar) return cerrar("cancelada", "Cancelada por el usuario.");
  if (user.rol !== "admin") return cerrar("error", "Solo los administradores pueden ejecutar acciones.");

  const quien = `${user.nombre} (vía Alterna IA)`;
  const d = acc.datos;
  try {
    if (acc.tipo === "crear_actividad") {
      const { data, error } = await db.from("actividades").insert({
        actividad: d.actividad, proyecto_macro: d.proyecto_macro, importancia: d.importancia, prioridad: d.prioridad,
        estado: "No iniciado", area: d.area, asignado: d.asignado, fecha_entrega: d.fecha_entrega, notas: d.notas,
      }).select("id").single();
      if (error) throw error;
      await db.from("historial_actividades").insert({ actividad_id: data.id, usuario: quien, accion: "Creada" });
      return cerrar("ejecutada", `Actividad #${data.id} creada.`);
    }
    if (acc.tipo === "actualizar_actividad") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(d.cambios as Record<string, { despues: unknown }>)) patch[k] = v.despues;
      if (patch.estado === "Terminado") patch.fecha_finalizacion = new Date().toISOString().slice(0, 10);
      const { error } = await db.from("actividades").update(patch).eq("id", d.id);
      if (error) throw error;
      await db.from("historial_actividades").insert(Object.entries(d.cambios as Record<string, any>).map(([campo, v]) => ({
        actividad_id: d.id, usuario: quien, accion: "Actualizada", campo,
        valor_anterior: v.antes == null ? null : String(v.antes), valor_nuevo: v.despues == null ? null : String(v.despues),
      })));
      return cerrar("ejecutada", `Actividad #${d.id} actualizada.`);
    }
    if (acc.tipo === "programar_mantenimiento") {
      // Mismo consecutivo que la página de Mantenimientos: MANT-AAAA-0001 (con reintento si dos se crean a la vez)
      const anio = new Date().getFullYear();
      for (let intento = 0; intento < 3; intento++) {
        const { data: ult } = await db.from("mantenimientos").select("numero_ticket").like("numero_ticket", `MANT-${anio}-%`)
          .order("numero_ticket", { ascending: false }).limit(1);
        const seq = (parseInt(String(ult?.[0]?.numero_ticket ?? "").split("-")[2]) || 0) + 1 + intento;
        const ticket = `MANT-${anio}-${String(seq).padStart(4, "0")}`;
        const { data: existe } = await db.from("mantenimientos").select("id").eq("numero_ticket", ticket).maybeSingle();
        if (existe) continue;
        const { data, error } = await db.from("mantenimientos").insert({
          numero_ticket: ticket, titulo: d.titulo, equipo_id: d.equipo_id ?? null, computadora_id: d.equipo_id ? null : d.computadora_id ?? null,
          usuario_id: d.usuario_id ?? null, tipo: d.tipo, prioridad: d.prioridad ?? "Media", descripcion: d.descripcion,
          fecha_programada: d.fecha_programada, tecnico: d.tecnico, estado: "Programado", creado_por: quien,
        }).select("id").single();
        if (error) throw error;
        return cerrar("ejecutada", `Ticket ${ticket} programado (#${data.id}).`);
      }
      return cerrar("error", "No se pudo asignar un número de ticket. Intenta de nuevo.");
    }
    return cerrar("error", "Tipo de acción desconocido.");
  } catch (e) {
    console.log(JSON.stringify({ nivel: "error", evento: "accion_error", tipo: acc.tipo, mensaje: String((e as any)?.message ?? e).slice(0, 300) }));
    return cerrar("error", "No se pudo ejecutar la acción. No se realizó ningún cambio.");
  }
}

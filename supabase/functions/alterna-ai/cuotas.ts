// Cuotas de consumo de la IA por usuario: planes, límites de tokens e imágenes por periodo,
// reinicio a una hora local fija, ilimitado, bloqueo, tokens extra y reinicio manual.
// Todo el cálculo vive en la función SQL ia_cuota_estado (ver migración 20261103_ia_cuotas_tokens.sql).

export type Estado = {
  usuario_id: number; plan_id: number | null; plan_nombre: string | null;
  ilimitado: boolean; bloqueado: boolean; motivo_bloqueo: string | null;
  tokens_limite: number | null; tokens_extra: number; tokens_usados: number; tokens_restantes: number | null;
  imagenes_limite: number | null; imagenes_usadas: number; mensajes_hora: number | null;
  periodo: "dia" | "semana" | "mes"; hora_reinicio: number; dia_reinicio: number; zona_horaria: string;
  inicio: string; reinicia_en: string; personalizado: boolean; extra_hasta: string | null; notas: string | null;
};

const PERIODOS = ["dia", "semana", "mes"];

// null si la migración aún no está aplicada: el backend sigue con los límites heredados.
export async function estadoCuota(db: any, usuarioId: number): Promise<Estado | null> {
  const { data, error } = await db.rpc("ia_cuota_estado", { p_usuario: usuarioId });
  if (error) return null;
  return (data?.[0] as Estado) ?? null;
}

// "hoy a las 00:00", "mañana a las 06:00" o "el viernes 7 de noviembre a las 08:00", en la hora del plan.
export function cuandoReinicia(iso: string, tz: string): string {
  const f = new Date(iso);
  const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const hora = f.toLocaleTimeString("es", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  if (dia(f) === dia(new Date())) return `hoy a las ${hora}`;
  if (dia(f) === dia(new Date(Date.now() + 864e5))) return `mañana a las ${hora}`;
  return `el ${f.toLocaleDateString("es", { timeZone: tz, weekday: "long", day: "numeric", month: "long" })} a las ${hora}`;
}

// Mensaje de bloqueo para el chat, o null si el usuario puede escribir.
export function motivoRechazo(e: Estado): string | null {
  if (e.bloqueado) return `Tu acceso a Alterna IA está pausado${e.motivo_bloqueo ? `: ${e.motivo_bloqueo}` : ""}. Si necesitas ayuda, contacta al área de IT.`;
  if (e.ilimitado || e.tokens_restantes === null || e.tokens_restantes > 0) return null;
  return `Alcanzaste tu límite de uso de Alterna IA (${fmt(e.tokens_limite! + e.tokens_extra)} tokens por ${nombrePeriodo(e.periodo)}). Se restablece ${cuandoReinicia(e.reinicia_en, e.zona_horaria)}. Si necesitas más, pide una ampliación al área de IT.`;
}

export const imagenesDisponibles = (e: Estado | null) =>
  !e || e.ilimitado || e.imagenes_limite === null || e.imagenes_usadas < e.imagenes_limite;

const fmt = (n: number) => Number(n).toLocaleString("es");
const nombrePeriodo = (p: string) => p === "semana" ? "semana" : p === "mes" ? "mes" : "día";

// Vista pública para el propio usuario (sin notas internas).
export function vistaUsuario(e: Estado) {
  const total = e.tokens_limite === null ? null : e.tokens_limite + e.tokens_extra;
  return {
    plan: e.plan_nombre, ilimitado: e.ilimitado, bloqueado: e.bloqueado, motivo_bloqueo: e.motivo_bloqueo,
    tokens_limite: total, tokens_usados: e.tokens_usados, tokens_restantes: e.tokens_restantes,
    imagenes_limite: e.imagenes_limite, imagenes_usadas: e.imagenes_usadas,
    periodo: e.periodo, reinicia_en: e.reinicia_en, reinicia_texto: cuandoReinicia(e.reinicia_en, e.zona_horaria),
    porcentaje: total ? Math.min(100, Math.round(e.tokens_usados / Math.max(total, 1) * 100)) : null,
  };
}

/* ───────────── Administración ───────────── */

const entero = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("Valor numérico fuera de rango.");
  return n;
};
const texto = (v: unknown, max: number) => { const t = String(v ?? "").trim().slice(0, max); return t || null; };

async function auditar(db: any, adminId: number, usuarioId: number | null, accion: string, detalle: unknown) {
  await db.from("ia_cuotas_historial").insert({ usuario_id: usuarioId, admin_id: adminId, accion, detalle });
}

export async function panelCuotas(db: any) {
  const [{ data: planes, error }, { data: estados }, { data: usuarios }, { data: ajustes }] = await Promise.all([
    db.from("ia_planes").select("*").order("ilimitado").order("tokens_limite", { nullsFirst: false }),
    db.rpc("ia_cuota_estado", { p_usuario: null }),
    db.from("usuarios").select("id, nombre, correo, rol, activo").order("nombre").limit(1000),
    db.from("ia_cuotas").select("usuario_id, plan_id, ilimitado, bloqueado, motivo_bloqueo, tokens_limite, tokens_extra, extra_hasta, notas"),
  ]);
  if (error) throw new Error("Falta aplicar la migración de cuotas (20261103_ia_cuotas_tokens.sql).");
  const porId = new Map((estados ?? []).map((e: Estado) => [e.usuario_id, e]));
  const ajustesPorId = new Map((ajustes ?? []).map((a: any) => [a.usuario_id, a]));
  return {
    planes: planes ?? [],
    // cuota: estado calculado (plan + ajustes + consumo); ajustes: lo que el admin guardó para ese usuario
    usuarios: (usuarios ?? []).map((u: any) => {
      const e = porId.get(u.id) as Estado | undefined;
      return { ...u, ajustes: ajustesPorId.get(u.id) ?? null, cuota: e ? { ...e, reinicia_texto: cuandoReinicia(e.reinicia_en, e.zona_horaria) } : null };
    }),
  };
}

export async function guardarPlan(db: any, admin: any, p: any) {
  const nombre = texto(p.nombre, 60);
  if (!nombre) throw new Error("El plan necesita un nombre.");
  const periodo = PERIODOS.includes(p.periodo) ? p.periodo : "dia";
  const ilimitado = p.ilimitado === true;
  const fila = {
    nombre, descripcion: texto(p.descripcion, 200), ilimitado, periodo,
    tokens_limite: ilimitado ? null : entero(p.tokens_limite, 0),
    imagenes_limite: ilimitado ? null : entero(p.imagenes_limite, 0, 100000),
    mensajes_hora: ilimitado ? null : entero(p.mensajes_hora, 1, 100000),
    hora_reinicio: entero(p.hora_reinicio, 0, 23) ?? 0,
    dia_reinicio: entero(p.dia_reinicio, 1, periodo === "semana" ? 7 : 28) ?? 1,
    zona_horaria: texto(p.zona_horaria, 60) ?? "America/Guatemala",
    predeterminado: p.predeterminado === true,
    updated_at: new Date().toISOString(),
  };
  if (!ilimitado && fila.tokens_limite === null) throw new Error("Indica el límite de tokens o marca el plan como ilimitado.");
  try { new Intl.DateTimeFormat("es", { timeZone: fila.zona_horaria }); } catch { throw new Error("Zona horaria no válida."); }

  if (fila.predeterminado) await db.from("ia_planes").update({ predeterminado: false }).eq("predeterminado", true).neq("id", p.id ?? -1);
  const q = p.id ? db.from("ia_planes").update(fila).eq("id", p.id) : db.from("ia_planes").insert(fila);
  const { data, error } = await q.select("id").single();
  if (error) throw new Error(error.code === "23505" ? "Ya existe un plan con ese nombre." : "No se pudo guardar el plan.");
  await auditar(db, admin.id, null, p.id ? "plan_editado" : "plan_creado", { plan_id: data.id, ...fila });
  return { ok: true, id: data.id };
}

export async function eliminarPlan(db: any, admin: any, id: number) {
  const { data: plan } = await db.from("ia_planes").select("id, nombre, predeterminado").eq("id", id).maybeSingle();
  if (!plan) throw new Error("Plan no encontrado.");
  if (plan.predeterminado) throw new Error("No puedes eliminar el plan predeterminado. Marca otro como predeterminado primero.");
  const { count } = await db.from("ia_cuotas").select("usuario_id", { count: "exact", head: true }).eq("plan_id", id);
  await db.from("ia_planes").delete().eq("id", id);
  await auditar(db, admin.id, null, "plan_eliminado", { plan_id: id, nombre: plan.nombre, usuarios_movidos_a_predeterminado: count ?? 0 });
  return { ok: true, usuarios_afectados: count ?? 0 };
}

// Asignación por usuario. Los campos no enviados se conservan.
export async function guardarCuota(db: any, admin: any, p: any) {
  const usuarioId = entero(p.usuario_id_objetivo, 1);
  if (!usuarioId) throw new Error("Usuario no válido.");
  const { data: u } = await db.from("usuarios").select("id").eq("id", usuarioId).maybeSingle();
  if (!u) throw new Error("Usuario no encontrado.");
  if (usuarioId === admin.id && p.bloqueado === true) throw new Error("No puedes pausar tu propio acceso.");

  const cambios: Record<string, unknown> = {};
  if ("plan_id" in p) cambios.plan_id = entero(p.plan_id, 1);
  if ("ilimitado" in p) cambios.ilimitado = p.ilimitado === true;
  if ("bloqueado" in p) { cambios.bloqueado = p.bloqueado === true; cambios.motivo_bloqueo = p.bloqueado === true ? texto(p.motivo_bloqueo, 200) : null; }
  if ("tokens_limite" in p) cambios.tokens_limite = entero(p.tokens_limite, 0);
  if ("tokens_extra" in p) cambios.tokens_extra = entero(p.tokens_extra, 0) ?? 0;
  if ("extra_hasta" in p) cambios.extra_hasta = p.extra_hasta ? new Date(p.extra_hasta).toISOString() : null;
  if ("notas" in p) cambios.notas = texto(p.notas, 500);
  if (!Object.keys(cambios).length) throw new Error("No hay cambios que guardar.");

  const { error } = await db.from("ia_cuotas").upsert({ usuario_id: usuarioId, ...cambios, actualizado_por: admin.id, updated_at: new Date().toISOString() });
  if (error) throw new Error("No se pudo guardar la cuota.");
  await auditar(db, admin.id, usuarioId, "cuota_editada", cambios);
  return { ok: true };
}

// Pone el consumo del periodo en cero a partir de ahora (no borra el historial de uso).
export async function reiniciarCuota(db: any, admin: any, usuarioId: number) {
  const { error } = await db.from("ia_cuotas").upsert({ usuario_id: usuarioId, reiniciado_en: new Date().toISOString(), actualizado_por: admin.id, updated_at: new Date().toISOString() });
  if (error) throw new Error("No se pudo reiniciar el consumo.");
  await auditar(db, admin.id, usuarioId, "consumo_reiniciado", {});
  return { ok: true };
}

export async function historialCuota(db: any, usuarioId: number) {
  const [{ data: cambios }, { data: uso }] = await Promise.all([
    db.from("ia_cuotas_historial").select("accion, detalle, created_at, admin:usuarios!ia_cuotas_historial_admin_id_fkey(nombre)").eq("usuario_id", usuarioId).order("created_at", { ascending: false }).limit(20),
    db.from("ia_uso").select("tipo, modelo, tokens_entrada, tokens_salida, created_at").eq("usuario_id", usuarioId).order("created_at", { ascending: false }).limit(30),
  ]);
  return { cambios: cambios ?? [], uso: uso ?? [] };
}

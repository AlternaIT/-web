// Resumen del día (sin IA, instantáneo y gratuito) y panel de uso para administradores.
const CERRADAS = ["Completado", "Cancelado", "Finalizado", "Terminado"];
const num = (n: string | undefined) => (n && !isNaN(Number(n)) ? Number(n) : null);

export async function resumenDia(db: any) {
  const hoy = new Date().toISOString().slice(0, 10);
  const en7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const en30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const [acts, mants, pcs] = await Promise.all([
    db.from("actividades").select("id, actividad, estado, prioridad, asignado, fecha_entrega, fecha_limite").limit(1000),
    db.from("mantenimientos").select("id, estado, fecha_programada").limit(500),
    db.from("inventario_equipos").select("id, estado, garantia_hasta").limit(2000),
  ]);
  const abiertas = (acts.data ?? []).filter((a: any) => !CERRADAS.includes(a.estado));
  const venc = abiertas.filter((a: any) => { const f = a.fecha_limite || a.fecha_entrega; return f && f < hoy; });
  const vencen7 = abiertas.filter((a: any) => { const f = a.fecha_limite || a.fecha_entrega; return f && f >= hoy && f <= en7; });
  const mant7 = (mants.data ?? []).filter((m: any) => m.estado !== "Completado" && m.estado !== "Cancelado" && m.fecha_programada >= hoy && m.fecha_programada <= en7);
  const gar30 = (pcs.data ?? []).filter((c: any) => c.estado !== "Dado de baja" && c.garantia_hasta && c.garantia_hasta >= hoy && c.garantia_hasta <= en30);
  return {
    fecha: hoy,
    abiertas: abiertas.length,
    alta_prioridad: abiertas.filter((a: any) => a.prioridad === "Alta").length,
    vencidas: venc.length,
    vencidas_top: venc.slice(0, 3).map((a: any) => ({ id: a.id, actividad: a.actividad, asignado: a.asignado })),
    vencen_7_dias: vencen7.length,
    mantenimientos_7_dias: mant7.length,
    garantias_30_dias: gar30.length,
  };
}

export async function usoAdmin(db: any) {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ data: usuarios }, { data: uso }, { data: convs }] = await Promise.all([
    db.from("usuarios").select("id, nombre, correo").limit(500),
    db.from("ia_uso").select("usuario_id, tipo, created_at, tokens_entrada, tokens_salida").gte("created_at", desde).limit(20000),
    db.from("ia_conversaciones").select("usuario_id").limit(20000),
  ]);
  const pIn = num(Deno.env.get("IA_PRECIO_ENTRADA_USD_1M")), pOut = num(Deno.env.get("IA_PRECIO_SALIDA_USD_1M")), pImg = num(Deno.env.get("IA_PRECIO_IMAGEN_USD"));
  const costeable = pIn !== null && pOut !== null;

  const fila = (u: any) => ({ id: u.id, nombre: u.nombre, correo: u.correo, mensajes: 0, imagenes: 0, tokens_entrada: 0, tokens_salida: 0, conversaciones: 0, ultimo: null as string | null });
  const por = new Map<number, ReturnType<typeof fila>>((usuarios ?? []).map((u: any) => [u.id, fila(u)]));
  const dias: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) dias[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0;

  for (const r of uso ?? []) {
    const f = por.get(r.usuario_id); if (!f) continue;
    if (r.tipo === "mensaje") { f.mensajes++; const d = String(r.created_at).slice(0, 10); if (d in dias) dias[d]++; }
    else if (r.tipo === "imagen") f.imagenes++;
    f.tokens_entrada += r.tokens_entrada ?? 0; f.tokens_salida += r.tokens_salida ?? 0;
    if (!f.ultimo || r.created_at > f.ultimo) f.ultimo = r.created_at;
  }
  for (const c of convs ?? []) { const f = por.get(c.usuario_id); if (f) f.conversaciones++; }

  const usuariosOut = [...por.values()].map((f) => ({
    ...f,
    costo_usd: costeable ? +((f.tokens_entrada * pIn! + f.tokens_salida * pOut!) / 1e6 + (pImg !== null ? f.imagenes * pImg : 0)).toFixed(4) : null,
  })).sort((a, b) => b.mensajes - a.mensajes);

  const total = usuariosOut.reduce((t, f) => ({
    mensajes: t.mensajes + f.mensajes, imagenes: t.imagenes + f.imagenes, tokens: t.tokens + f.tokens_entrada + f.tokens_salida,
    costo_usd: costeable ? +(t.costo_usd + (f.costo_usd ?? 0)).toFixed(4) : null,
  }), { mensajes: 0, imagenes: 0, tokens: 0, costo_usd: costeable ? 0 : null as number | null });

  return { periodo_dias: 30, costo_configurado: costeable, total, usuarios: usuariosOut, mensajes_por_dia: Object.entries(dias).map(([fecha, n]) => ({ fecha, n })) };
}

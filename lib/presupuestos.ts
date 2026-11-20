import { getSupabase } from "@/lib/supabase"
import type { PresupuestoSinAprobar } from "@/types/presupuesto"

export async function obtenerPresupuestosSinAprobar(profesionalIdFiltro?: string): Promise<{
  presupuestos: PresupuestoSinAprobar[]
  doctores: { id: string; nombre_completo: string }[]
}> {
  const supabase = getSupabase()

  let query = supabase
    .from("presupuestos")
    .select(`
      id,
      numero,
      nombre,
      descripcion,
      created_at,
      paciente_id,
      profesional_id,
      ultimo_contacto_at,
      ultimo_contacto_nota,
      paciente:pacientes(id, nombres, apellidos, rut, telefono),
      profesional:perfiles!presupuestos_profesional_id_fkey(id, nombre_completo),
      items:presupuesto_items(precio, estado)
    `)
    .eq("estado", "ACTIVO")
    .eq("aprobacion", "PENDIENTE")
    .order("created_at", { ascending: true })

  if (profesionalIdFiltro) {
    query = query.eq("profesional_id", profesionalIdFiltro)
  }

  const { data: rows, error } = await query

  if (error || !rows) {
    console.error("Error cargando presupuestos sin aprobar:", error?.message)
    return { presupuestos: [], doctores: [] }
  }

  const pacienteIds = [...new Set(rows.map((r) => r.paciente_id).filter(Boolean))]
  const ahoraIso = new Date().toISOString()

  // Buscar próxima cita futura de cada paciente involucrado
  const mapaProximaCita = new Map<string, { id: string; inicio: string; estado: string }>()
  if (pacienteIds.length > 0) {
    const { data: citasFuturas } = await supabase
      .from("citas")
      .select("id, paciente_id, inicio, estado")
      .in("paciente_id", pacienteIds)
      .in("estado", ["AGENDADA", "CONFIRMADA"])
      .gte("inicio", ahoraIso)
      .order("inicio", { ascending: true })

    for (const c of citasFuturas ?? []) {
      if (!mapaProximaCita.has(c.paciente_id)) {
        mapaProximaCita.set(c.paciente_id, { id: c.id, inicio: c.inicio, estado: c.estado })
      }
    }
  }

  const ahoraMs = Date.now()
  const doctoresMap = new Map<string, string>()

  const presupuestos: PresupuestoSinAprobar[] = rows.map((r) => {
    const pac = Array.isArray(r.paciente) ? r.paciente[0] : r.paciente
    const prof = Array.isArray(r.profesional) ? r.profesional[0] : r.profesional
    const items = Array.isArray(r.items) ? r.items : []

    const itemsActivos = items.filter((it) => it.estado !== "ANULADO" && it.estado !== "CANCELADO")
    const montoTotal = itemsActivos.reduce((acc, it) => acc + (Number(it.precio) || 0), 0)

    const diffMs = ahoraMs - new Date(r.created_at).getTime()
    const antiguedadDias = Math.max(0, Math.floor(diffMs / 86_400_000))

    if (prof?.id && prof?.nombre_completo) {
      doctoresMap.set(prof.id, prof.nombre_completo)
    }

    return {
      id: r.id,
      numero: r.numero ?? null,
      nombre: r.nombre || "Plan de tratamiento",
      descripcion: r.descripcion ?? null,
      created_at: r.created_at,
      antiguedad_dias: antiguedadDias,
      monto_total: montoTotal,
      items_count: itemsActivos.length,
      paciente_id: r.paciente_id,
      paciente_nombre: pac ? `${pac.nombres} ${pac.apellidos}` : "Paciente sin nombre",
      paciente_rut: pac?.rut ?? null,
      paciente_telefono: pac?.telefono ?? null,
      profesional_id: r.profesional_id ?? null,
      profesional_nombre: prof?.nombre_completo ?? "Sin doctor asignado",
      proxima_cita: mapaProximaCita.get(r.paciente_id) ?? null,
      ultimo_contacto_at: r.ultimo_contacto_at ?? null,
      ultimo_contacto_nota: r.ultimo_contacto_nota ?? null,
    }
  })

  const doctores = [...doctoresMap.entries()]
    .map(([id, nombre_completo]) => ({ id, nombre_completo }))
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))

  return { presupuestos, doctores }
}
import { cache } from "react"
import { getSupabase } from "@/lib/supabase"
import { sumarDias } from "@/lib/fechas-agenda"
import type {
  BloqueoAgenda,
  Box,
  CitaAgenda,
  EstadoCita,
  HorarioAtencion,
  InfoPaciente,
  PrestacionAgenda,
  ProfesionalAgenda,
} from "@/types/cita"

type Respuesta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

async function todasLasFilas<T>(consulta: (desde: number, hasta: number) => Respuesta<T>): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999)
    if (error) throw new Error(error.message)
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return filas
}

export type FiltrosAgenda = { profesional?: string; box?: string; estado?: EstadoCita }

export async function obtenerCitas(desde: string, hasta: string, filtros: FiltrosAgenda = {}): Promise<CitaAgenda[]> {
  const supabase = getSupabase()
  return todasLasFilas<CitaAgenda>((a, b) => {
    let q = supabase.from("v_agenda").select("*").gte("fecha", desde).lte("fecha", hasta)
    if (filtros.profesional) q = q.eq("profesional_id", filtros.profesional)
    if (filtros.box) q = q.eq("box_id", filtros.box)
    if (filtros.estado) q = q.eq("estado", filtros.estado)
    return q.order("inicio").range(a, b)
  })
}

export async function obtenerBloqueos(desde: string, hasta: string): Promise<BloqueoAgenda[]> {
  const { data, error } = await getSupabase()
    .from("bloqueos_agenda")
    .select("*, profesional:perfiles!bloqueos_agenda_profesional_id_fkey(nombre_completo), box:boxes(nombre)")
    .lt("inicio", `${sumarDias(hasta, 1)}T00:00:00-02:00`)
    .gt("fin", `${desde}T00:00:00-05:00`)
    .order("inicio")
  if (error) throw new Error(error.message)
  return (data ?? []) as BloqueoAgenda[]
}

export async function obtenerBloqueosFuturos(): Promise<BloqueoAgenda[]> {
  const { data } = await getSupabase()
    .from("bloqueos_agenda")
    .select("*, profesional:perfiles!bloqueos_agenda_profesional_id_fkey(nombre_completo), box:boxes(nombre)")
    .gt("fin", new Date().toISOString())
    .order("inicio")
  return (data ?? []) as BloqueoAgenda[]
}

export const obtenerHorarios = cache(async (): Promise<HorarioAtencion[]> => {
  const { data } = await getSupabase().from("horarios_atencion").select("*").order("dia_semana").order("hora_inicio")
  return (data ?? []) as HorarioAtencion[]
})

export const obtenerBoxes = cache(async (soloActivos = true): Promise<Box[]> => {
  let q = getSupabase().from("boxes").select("id, nombre, activo").order("nombre")
  if (soloActivos) q = q.eq("activo", true)
  const { data } = await q
  return (data ?? []) as Box[]
})

export const obtenerProfesionalesAgenda = cache(async (): Promise<ProfesionalAgenda[]> => {
  const { data } = await getSupabase()
    .from("perfiles")
    .select("id, nombre_completo, especialidad")
    .eq("rol", "DENTISTA")
    .eq("activo", true)
    .order("nombre_completo")
  return (data ?? []) as ProfesionalAgenda[]
})

export const obtenerPrestacionesAgenda = cache(async (): Promise<PrestacionAgenda[]> => {
  const supabase = getSupabase()
  return todasLasFilas<PrestacionAgenda>((a, b) =>
    supabase
      .from("prestaciones")
      .select("id, codigo_interno, nombre, duracion_min")
      .eq("activo", true)
      .order("nombre")
      .range(a, b)
  )
})

export async function obtenerInfoPacientes(pacienteIds: string[], conFinanzas: boolean): Promise<Record<string, InfoPaciente>> {
  const info: Record<string, InfoPaciente> = {}
  const ids = [...new Set(pacienteIds)]
  for (const id of ids) info[id] = { porCobrar: 0, deuda: 0, totalTratamientos: 0, inasistencias: 0 }
  if (ids.length === 0) return info

  const supabase = getSupabase()
  const haceUnAnio = new Date()
  haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1)

  const [items, faltas] = await Promise.all([
    conFinanzas
      ? todasLasFilas<{ paciente_id: string; precio: number; monto_habilitado: number; abonado: number; presupuesto: { estado: string } | null }>(
          (a, b) =>
            supabase
              .from("presupuesto_items")
              .select("paciente_id, precio, monto_habilitado, abonado, presupuesto:presupuestos(estado)")
              .in("paciente_id", ids)
              .neq("estado", "ANULADO")
              .range(a, b)
        )
      : Promise.resolve([]),
    todasLasFilas<{ paciente_id: string }>((a, b) =>
      supabase
        .from("citas")
        .select("paciente_id")
        .in("paciente_id", ids)
        .eq("estado", "NO_ASISTIO")
        .gte("inicio", haceUnAnio.toISOString())
        .range(a, b)
    ),
  ])

  for (const it of items) {
    if (it.presupuesto?.estado === "ANULADO") continue
    const p = info[it.paciente_id]
    p.totalTratamientos += it.precio
    p.deuda += it.precio - it.abonado
    p.porCobrar += Math.max(it.monto_habilitado - it.abonado, 0)
  }
  for (const f of faltas) info[f.paciente_id].inasistencias++
  return info
}

export async function obtenerHistorialCita(citaId: string) {
  const { data } = await getSupabase()
    .from("citas_historial")
    .select("id, estado_anterior, estado_nuevo, motivo, fecha, usuario:perfiles(nombre_completo)")
    .eq("cita_id", citaId)
    .order("fecha")
  return (data ?? []) as unknown as {
    id: string
    estado_anterior: EstadoCita | null
    estado_nuevo: EstadoCita
    motivo: string | null
    fecha: string
    usuario: { nombre_completo: string } | null
  }[]
}

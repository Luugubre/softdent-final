import { cache } from "react"
import { getSupabase } from "@/lib/supabase"
import type { Avance, Hallazgo, ItemTratamiento } from "@/types/odontograma"
import type { Fase, ResumenTratamiento, Tratamiento } from "@/types/tratamiento"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SELECT_TRATAMIENTO =
  "*, arancel:aranceles(nombre), profesional:perfiles!presupuestos_profesional_id_fkey(nombre_completo)"

export const obtenerHallazgos = cache(async (pacienteId: string): Promise<Hallazgo[]> => {
  const { data } = await getSupabase()
    .from("odontograma_hallazgos")
    .select("*, creador:perfiles!odontograma_hallazgos_creado_por_fkey(nombre_completo)")
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false })
  return (data ?? []) as Hallazgo[]
})

export const obtenerItems = cache(async (pacienteId: string, tratamientoId?: string) => {
  const supabase = getSupabase()
  let consulta = supabase
    .from("presupuesto_items")
    .select("*, prestacion:prestaciones(codigo_interno, nombre, icono), presupuesto:presupuestos(numero, nombre, estado)")
    .eq("paciente_id", pacienteId)
    .order("created_at")
  if (tratamientoId) consulta = consulta.eq("presupuesto_id", tratamientoId)

  const { data } = await consulta
  const items = (data ?? []) as ItemTratamiento[]

  let avances: Avance[] = []
  if (items.length > 0) {
    const { data: av } = await supabase
      .from("item_avances")
      .select("*, profesional:perfiles(nombre_completo)")
      .in("item_id", items.map((i) => i.id))
      .order("created_at")
    avances = (av ?? []) as Avance[]
  }
  return { items, avances }
})

export const obtenerTratamientos = cache(async (pacienteId: string): Promise<ResumenTratamiento[]> => {
  const supabase = getSupabase()
  const [{ data: tratamientos }, { data: items }] = await Promise.all([
    supabase.from("presupuestos").select(SELECT_TRATAMIENTO).eq("paciente_id", pacienteId).order("numero", { ascending: false }),
    supabase
      .from("presupuesto_items")
      .select("presupuesto_id, precio, progreso, monto_habilitado, abonado, estado")
      .eq("paciente_id", pacienteId)
      .neq("estado", "ANULADO"),
  ])

  return ((tratamientos ?? []) as Tratamiento[]).map((t) => {
    const propios = (items ?? []).filter((i) => i.presupuesto_id === t.id)
    const total = propios.reduce((s, i) => s + i.precio, 0)
    const habilitado = propios.reduce((s, i) => s + i.monto_habilitado, 0)
    const abonado = propios.reduce((s, i) => s + i.abonado, 0)
    return {
      ...t,
      cantidad: propios.length,
      total,
      habilitado,
      abonado,
      porPagar: habilitado - abonado,
      avance: total > 0 ? Math.round((habilitado / total) * 100) : 0,
    }
  })
})

export const obtenerTratamiento = cache(async (pacienteId: string, tratamientoId: string): Promise<Tratamiento | null> => {
  if (!UUID.test(tratamientoId)) return null
  const { data } = await getSupabase()
    .from("presupuestos")
    .select(SELECT_TRATAMIENTO)
    .eq("id", tratamientoId)
    .eq("paciente_id", pacienteId)
    .maybeSingle()
  return data as Tratamiento | null
})

export const obtenerFases = cache(async (tratamientoId: string): Promise<Fase[]> => {
  if (!UUID.test(tratamientoId)) return []
  const { data } = await getSupabase()
    .from("presupuesto_fases")
    .select("id, presupuesto_id, numero, nombre, descripcion")
    .eq("presupuesto_id", tratamientoId)
    .order("numero")
  return (data ?? []) as Fase[]
})

import { cache } from "react"
import { getSupabase } from "@/lib/supabase"
import type { DetalleLiquidacion, Liquidacion, Produccion, ProfesionalLiquidacion } from "@/types/liquidacion"

const UUID = /^[0-9a-f-]{36}$/i

type Respuesta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** PostgREST devuelve máximo 1000 filas por consulta: se pide por páginas */
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

const SELECT_LIQUIDACION = `*,
  profesional:perfiles!liquidaciones_profesional_id_fkey(nombre_completo, rut, registro_profesional),
  creador:perfiles!liquidaciones_creado_por_fkey(nombre_completo),
  pagador:perfiles!liquidaciones_pagado_por_fkey(nombre_completo),
  anulador:perfiles!liquidaciones_anulado_por_fkey(nombre_completo)`

/** Dentistas (y cualquiera que tenga % configurado) */
export const obtenerProfesionales = cache(async (): Promise<ProfesionalLiquidacion[]> => {
  const { data } = await getSupabase()
    .from("perfiles")
    .select("id, nombre_completo, rol, activo, porcentaje_liquidacion")
    .or("rol.eq.DENTISTA,porcentaje_liquidacion.not.is.null")
    .order("nombre_completo")
  return (data ?? []) as ProfesionalLiquidacion[]
})

export const obtenerProfesional = cache(async (id: string): Promise<ProfesionalLiquidacion | null> => {
  if (!UUID.test(id)) return null
  const { data } = await getSupabase()
    .from("perfiles")
    .select("id, nombre_completo, rol, activo, porcentaje_liquidacion")
    .eq("id", id)
    .maybeSingle()
  return data as ProfesionalLiquidacion | null
})

/** Tramos evolucionados que todavía no se han liquidado */
export const obtenerProduccionPendiente = cache(async (profesionalId?: string): Promise<Produccion[]> => {
  const supabase = getSupabase()
  return todasLasFilas<Produccion>((desde, hasta) => {
    let q = supabase.from("v_produccion_profesional").select("*").is("liquidacion_id", null)
    if (profesionalId) q = q.eq("profesional_id", profesionalId)
    return q.order("fecha_avance").range(desde, hasta)
  })
})

export const obtenerLiquidaciones = cache(async (profesionalId?: string): Promise<Liquidacion[]> => {
  let q = getSupabase().from("liquidaciones").select(SELECT_LIQUIDACION).order("numero", { ascending: false }).limit(200)
  if (profesionalId) q = q.eq("profesional_id", profesionalId)
  const { data } = await q
  return (data ?? []) as Liquidacion[]
})

export const obtenerLiquidacion = cache(
  async (id: string): Promise<{ liquidacion: Liquidacion; detalle: DetalleLiquidacion[] } | null> => {
    if (!UUID.test(id)) return null
    const supabase = getSupabase()
    const [{ data }, detalle] = await Promise.all([
      supabase.from("liquidaciones").select(SELECT_LIQUIDACION).eq("id", id).maybeSingle(),
      todasLasFilas<DetalleLiquidacion>((desde, hasta) =>
        supabase
          .from("liquidacion_detalle")
          .select("*")
          .eq("liquidacion_id", id)
          .order("fecha_pagado")
          .range(desde, hasta)
      ),
    ])
    if (!data) return null
    return { liquidacion: data as Liquidacion, detalle }
  }
)

/** Fecha (Chile) en que un tramo pasó a ser liquidable */
export function fechaChile(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Santiago" }) : null
}

/** Monto que le corresponde al profesional por un tramo */
export function montoProfesional(base: number, porcentaje: number | null): number {
  return porcentaje === null ? 0 : Math.round((base * porcentaje) / 100)
}

/** Por qué un tramo aún no se puede liquidar */
export function motivoEspera(p: Produccion): string {
  const faltas: string[] = []
  if (p.progreso < 100) faltas.push(`falta evolucionar (va en ${p.progreso}%)`)
  if (p.abonado < p.precio) faltas.push(`falta pago de $${(p.precio - p.abonado).toLocaleString("es-CL")}`)
  return faltas.join(" · ")
}

/** Resumen por profesional de lo pendiente */
export function resumirProduccion(filas: Produccion[], hasta?: string) {
  const liquidables = filas.filter((f) => f.liquidable && (!hasta || (fechaChile(f.fecha_liquidable) ?? "") <= hasta))
  const posteriores = filas.filter((f) => f.liquidable && hasta && (fechaChile(f.fecha_liquidable) ?? "") > hasta)
  const enEspera = filas.filter((f) => !f.liquidable)
  const suma = (lista: Produccion[], fn: (p: Produccion) => number) => lista.reduce((s, p) => s + fn(p), 0)
  return {
    liquidables,
    posteriores,
    enEspera,
    baseLiquidable: suma(liquidables, (p) => p.monto_base),
    aPagar: suma(liquidables, (p) => montoProfesional(p.monto_base, p.porcentaje)),
    baseEspera: suma(enEspera, (p) => p.monto_base),
    esperaAPagar: suma(enEspera, (p) => montoProfesional(p.monto_base, p.porcentaje)),
  }
}

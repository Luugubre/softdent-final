import { cache } from "react"
import { getSupabase } from "@/lib/supabase"
import { CATALOGOS, type ItemCatalogo, type MetodoPagoCatalogo, type Parametro, type RegistroAuditoria, type TablaCatalogo } from "@/types/admin"

export const obtenerMetodosPago = cache(async (soloActivos = true): Promise<MetodoPagoCatalogo[]> => {
  let q = getSupabase().from("metodos_pago").select("*").order("orden")
  if (soloActivos) q = q.eq("activo", true)
  const { data } = await q
  return (data ?? []) as MetodoPagoCatalogo[]
})

export const obtenerPrevisiones = cache(async (): Promise<string[]> => {
  const { data } = await getSupabase().from("previsiones").select("nombre").eq("activo", true).order("nombre")
  const lista = (data ?? []).map((p) => p.nombre as string)
  return lista.sort((a, b) => (a === "Particular" ? -1 : b === "Particular" ? 1 : a.localeCompare(b)))
})

export const obtenerTiposAtencion = cache(async (): Promise<{ id: string; nombre: string; duracion_min: number }[]> => {
  const { data } = await getSupabase().from("tipos_atencion").select("id, nombre, duracion_min").eq("activo", true).order("nombre")
  return (data ?? []) as { id: string; nombre: string; duracion_min: number }[]
})

export async function obtenerCatalogo(tabla: TablaCatalogo): Promise<ItemCatalogo[]> {
  if (!(tabla in CATALOGOS)) return []
  const { data } = await getSupabase().from(tabla).select("*").order("activo", { ascending: false }).order("nombre")
  return (data ?? []) as ItemCatalogo[]
}

export const obtenerParametros = cache(async (): Promise<Parametro[]> => {
  const { data } = await getSupabase().from("parametros_sistema").select("*").order("grupo").order("clave")
  return (data ?? []) as Parametro[]
})

export async function obtenerParametro(clave: string, porDefecto = ""): Promise<string> {
  const lista = await obtenerParametros()
  return lista.find((p) => p.clave === clave)?.valor || porDefecto
}

export async function obtenerAuditoria(limite = 60): Promise<RegistroAuditoria[]> {
  const { data } = await getSupabase()
    .from("auditoria")
    .select("*, usuario:perfiles(nombre_completo)")
    .order("id", { ascending: false })
    .limit(limite)
  return (data ?? []) as RegistroAuditoria[]
}

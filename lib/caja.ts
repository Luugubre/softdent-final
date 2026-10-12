import { getSupabase } from "@/lib/supabase"
import type { Caja, MovimientoCaja, ResumenMetodo } from "@/types/admin"

const UUID = /^[0-9a-f-]{36}$/i
const SELECT_CAJA = `*,
  abridor:perfiles!cajas_abierta_por_fkey(nombre_completo),
  cerrador:perfiles!cajas_cerrada_por_fkey(nombre_completo)`

export async function obtenerCajaAbierta(): Promise<Caja | null> {
  const { data } = await getSupabase().from("cajas").select(SELECT_CAJA).eq("estado", "ABIERTA").maybeSingle()
  return data as Caja | null
}

export async function obtenerCaja(id: string): Promise<Caja | null> {
  if (!UUID.test(id)) return null
  const { data } = await getSupabase().from("cajas").select(SELECT_CAJA).eq("id", id).maybeSingle()
  return data as Caja | null
}

export async function obtenerCajasCerradas(limite = 30): Promise<Caja[]> {
  const { data } = await getSupabase()
    .from("cajas")
    .select(SELECT_CAJA)
    .eq("estado", "CERRADA")
    .order("cerrada_en", { ascending: false })
    .limit(limite)
  return (data ?? []) as Caja[]
}

export async function obtenerMovimientos(cajaId: string): Promise<MovimientoCaja[]> {
  const { data } = await getSupabase()
    .from("caja_movimientos")
    .select("*, registrador:perfiles!caja_movimientos_registrado_por_fkey(nombre_completo), pago:pagos(paciente_id)")
    .eq("caja_id", cajaId)
    .order("created_at", { ascending: false })
  return (data ?? []) as MovimientoCaja[]
}

export async function efectivoEsperado(cajaId: string): Promise<number> {
  const { data } = await getSupabase().rpc("efectivo_esperado", { p_caja: cajaId })
  return Number(data ?? 0)
}

export async function resumenCaja(desde: string, hasta: string): Promise<ResumenMetodo[]> {
  const { data } = await getSupabase().rpc("resumen_caja", { p_desde: desde, p_hasta: hasta })
  return ((data ?? []) as ResumenMetodo[]).map((r) => ({ ...r, ingresos: Number(r.ingresos), egresos: Number(r.egresos), cantidad: Number(r.cantidad) }))
}

export function totalesPorMetodo(movs: MovimientoCaja[]) {
  const mapa = new Map<string, { ingresos: number; egresos: number }>()
  for (const m of movs) {
    if (m.anulado) continue
    const t = mapa.get(m.metodo) ?? { ingresos: 0, egresos: 0 }
    if (m.tipo === "INGRESO") t.ingresos += m.monto
    else t.egresos += m.monto
    mapa.set(m.metodo, t)
  }
  return mapa
}

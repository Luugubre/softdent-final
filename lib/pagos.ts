import { cache } from "react"
import { getSupabase } from "@/lib/supabase"
import type { Pago } from "@/types/pago"
import type { Avance, ItemTratamiento } from "@/types/odontograma"

const SELECT_PAGO = `*,
  registrador:perfiles!pagos_registrado_por_fkey(nombre_completo),
  anulador:perfiles!pagos_anulado_por_fkey(nombre_completo),
  detalle:pago_detalle(id, item_id, monto,
    item:presupuesto_items(pieza, prestacion:prestaciones(nombre), presupuesto:presupuestos(numero, nombre)))`

export const obtenerPagos = cache(async (pacienteId: string): Promise<Pago[]> => {
  const { data } = await getSupabase()
    .from("pagos")
    .select(SELECT_PAGO)
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false })
  return (data ?? []) as Pago[]
})

export const obtenerPago = cache(async (pagoId: string): Promise<Pago | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(pagoId)) return null
  const { data } = await getSupabase().from("pagos").select(SELECT_PAGO).eq("id", pagoId).maybeSingle()
  return data as Pago | null
})

/** Resumen de la deuda del paciente (prestaciones no anuladas de tratamientos no anulados) */
export function resumenDeuda(items: ItemTratamiento[]) {
  const vigentes = items.filter((i) => i.estado !== "ANULADO" && i.presupuesto?.estado !== "ANULADO")
  return {
    vigentes,
    // Lo que ya se realizó y no se ha pagado
    deudaActual: vigentes.reduce((s, i) => s + Math.max(i.monto_habilitado - i.abonado, 0), 0),
    // Pagado por adelantado (abonos sobre trabajo aún no realizado)
    anticipos: vigentes.reduce((s, i) => s + Math.max(i.abonado - i.monto_habilitado, 0), 0),
    // Lo que falta pagar de todos los tratamientos
    saldoTratamientos: vigentes.reduce((s, i) => s + (i.precio - i.abonado), 0),
    totalAbonado: vigentes.reduce((s, i) => s + i.abonado, 0),
  }
}

export type Movimiento = { fecha: string; descripcion: string; cargo: number; abono: number; saldo: number }

/**
 * Cuenta corriente: cargos (cada avance habilita un cobro) y abonos (pagos),
 * en orden cronológico. Un pago anulado aparece como abono y luego como
 * movimiento inverso (no se borra).
 */
export function cuentaCorriente(items: ItemTratamiento[], avances: Avance[], pagos: Pago[]): Movimiento[] {
  const porId = new Map(items.map((i) => [i.id, i]))
  const movimientos: Omit<Movimiento, "saldo">[] = []

  for (const a of avances) {
    const item = porId.get(a.item_id)
    if (!item || a.monto <= 0) continue
    movimientos.push({
      fecha: a.created_at,
      descripcion: `${item.prestacion?.nombre ?? "Prestación"}${item.pieza ? ` · pieza ${item.pieza}` : ""} · avance ${a.progreso_anterior}% → ${a.progreso_nuevo}%`,
      cargo: a.monto,
      abono: 0,
    })
  }

  for (const p of pagos) {
    movimientos.push({ fecha: p.fecha, descripcion: `Pago N° ${p.numero}`, cargo: 0, abono: p.monto })
    if (p.estado === "ANULADO" && p.fecha_anulacion) {
      movimientos.push({
        fecha: p.fecha_anulacion,
        descripcion: `Anulación pago N° ${p.numero}${p.motivo_anulacion ? ` (${p.motivo_anulacion})` : ""}`,
        cargo: p.monto,
        abono: 0,
      })
    }
  }

  movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha))
  let saldo = 0
  return movimientos.map((m) => {
    saldo += m.cargo - m.abono
    return { ...m, saldo }
  })
}

"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { hoyChile } from "@/lib/formato"
import { METODOS_PAGO_LIQUIDACION } from "@/types/liquidacion"

type Resultado = { ok: boolean; mensaje: string; id?: string }

function mensajeBD(error: { message?: string } | null, porDefecto: string) {
  return error?.message && !error.message.includes("violates") ? error.message : porDefecto
}

function refrescar() {
  revalidatePath("/liquidaciones", "layout")
}

export async function actualizarPorcentaje(profesionalId: string, porcentaje: string): Promise<Resultado> {
  if (!(await autorizar("liquidaciones.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const texto = porcentaje.trim().replace(",", ".")
  const valor = texto === "" ? null : Number(texto)
  if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor > 100)) {
    return { ok: false, mensaje: "El porcentaje debe estar entre 0 y 100." }
  }

  const { error } = await getSupabase()
    .from("perfiles")
    .update({ porcentaje_liquidacion: valor === null ? null : Math.round(valor * 100) / 100 })
    .eq("id", profesionalId)
  if (error) return { ok: false, mensaje: "No se pudo guardar el porcentaje." }

  refrescar()
  return { ok: true, mensaje: valor === null ? "Porcentaje eliminado." : `Porcentaje guardado: ${valor}%.` }
}

export async function generarLiquidacion(profesionalId: string, fechaCorte: string, nota: string): Promise<Resultado> {
  const usuario = await autorizar("liquidaciones.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte)) return { ok: false, mensaje: "Fecha de corte no válida." }
  if (fechaCorte > hoyChile()) return { ok: false, mensaje: "La fecha de corte no puede ser futura." }

  const { data, error } = await getSupabase().rpc("generar_liquidacion", {
    p_profesional: profesionalId,
    p_fecha_corte: fechaCorte,
    p_usuario: usuario.id,
    p_nota: nota || null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo generar la liquidación.") }

  refrescar()
  return { ok: true, mensaje: "Liquidación generada.", id: data as string }
}

export async function pagarLiquidacion(liquidacionId: string, metodo: string, referencia: string): Promise<Resultado> {
  const usuario = await autorizar("liquidaciones.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!(METODOS_PAGO_LIQUIDACION as readonly string[]).includes(metodo)) return { ok: false, mensaje: "Selecciona el método de pago." }
  if (metodo !== "EFECTIVO" && !referencia.trim()) return { ok: false, mensaje: "Ingresa el N° de operación o de cheque." }

  const { error } = await getSupabase().rpc("pagar_liquidacion", {
    p_liquidacion: liquidacionId,
    p_usuario: usuario.id,
    p_metodo: metodo,
    p_referencia: referencia || null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo registrar el pago de la liquidación.") }

  refrescar()
  return { ok: true, mensaje: "Liquidación marcada como pagada." }
}

export async function anularLiquidacion(liquidacionId: string, motivo: string): Promise<Resultado> {
  const usuario = await autorizar("liquidaciones.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const { error } = await getSupabase().rpc("anular_liquidacion", {
    p_liquidacion: liquidacionId,
    p_usuario: usuario.id,
    p_motivo: motivo,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo anular la liquidación.") }

  refrescar()
  return { ok: true, mensaje: "Liquidación anulada. Sus prestaciones vuelven a quedar pendientes." }
}

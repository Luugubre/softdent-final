"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"

type Resultado = { ok: boolean; mensaje: string; pagoId?: string }

function mensajeBD(error: { message?: string } | null, porDefecto: string) {
  return error?.message && !error.message.includes("violates") ? error.message : porDefecto
}

export async function registrarPago(
  pacienteId: string,
  datos: {
    monto: number
    metodo: string
    referencia?: string
    boleta?: string
    nota?: string
    detalle: { item_id: string; monto: number }[]
  }
): Promise<Resultado> {
  const usuario = await autorizar("pagos.registrar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const monto = Math.round(Number(datos.monto))
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, mensaje: "Ingresa un monto mayor a cero." }
  if (!/^[A-Z_]{3,30}$/.test(datos.metodo)) return { ok: false, mensaje: "Selecciona el método de pago." }

  const detalle = datos.detalle
    .map((d) => ({ item_id: d.item_id, monto: Math.round(Number(d.monto)) }))
    .filter((d) => d.monto > 0)
  if (detalle.length === 0) return { ok: false, mensaje: "Indica a qué prestaciones se aplica el pago." }
  const suma = detalle.reduce((s, d) => s + d.monto, 0)
  if (suma !== monto) return { ok: false, mensaje: "La suma aplicada a las prestaciones no coincide con el monto del pago." }

  const { data, error } = await getSupabase().rpc("registrar_pago", {
    p_paciente: pacienteId,
    p_monto: monto,
    p_metodo: datos.metodo,
    p_detalle: detalle,
    p_usuario: usuario.id,
    p_referencia: datos.referencia ?? null,
    p_boleta: datos.boleta ?? null,
    p_nota: datos.nota ?? null,
  })

  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo registrar el pago.") }

  revalidatePath(`/pacientes/${pacienteId}`, "layout")
  revalidatePath("/caja")
  return { ok: true, mensaje: "Pago registrado.", pagoId: data as string }
}

export async function anularPago(pacienteId: string, pagoId: string, motivo: string): Promise<Resultado> {
  const usuario = await autorizar("pagos.anular")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const { data: pago } = await getSupabase().from("pagos").select("id").eq("id", pagoId).eq("paciente_id", pacienteId).maybeSingle()
  if (!pago) return { ok: false, mensaje: "Pago no encontrado." }

  const { error } = await getSupabase().rpc("anular_pago", { p_pago: pagoId, p_usuario: usuario.id, p_motivo: motivo })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo anular el pago.") }

  revalidatePath(`/pacientes/${pacienteId}`, "layout")
  revalidatePath("/caja")
  return { ok: true, mensaje: "Pago anulado. Los abonos y la caja se revirtieron." }
}

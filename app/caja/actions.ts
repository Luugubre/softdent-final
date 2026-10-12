"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"

type Resultado = { ok: boolean; mensaje: string }

const mensajeBD = (e: { message?: string } | null, d: string) =>
  e?.message && !e.message.includes("violates") && !e.message.includes("schema cache") ? e.message : d

const numero = (v: string | number) => Math.round(Number(String(v).replace(/\D/g, "")))

function refrescar() {
  revalidatePath("/caja", "layout")
}

export async function abrirCaja(monto: string, nota: string): Promise<Resultado> {
  const usuario = await autorizar("caja.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const m = numero(monto)
  if (!Number.isFinite(m) || m < 0) return { ok: false, mensaje: "Ingresa el monto inicial en efectivo." }
  const { error } = await getSupabase().rpc("abrir_caja", { p_monto: m, p_usuario: usuario.id, p_nota: nota || null })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo abrir la caja.") }
  refrescar()
  return { ok: true, mensaje: "Caja abierta." }
}

export async function registrarMovimiento(datos: { tipo: "INGRESO" | "EGRESO"; monto: string; metodo: string; descripcion: string }): Promise<Resultado> {
  const usuario = await autorizar("caja.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const m = numero(datos.monto)
  if (!(m > 0)) return { ok: false, mensaje: "El monto debe ser mayor a cero." }
  if (datos.descripcion.trim().length < 3) return { ok: false, mensaje: "Indica el motivo del movimiento." }
  const { error } = await getSupabase().rpc("registrar_movimiento_caja", {
    p_tipo: datos.tipo,
    p_monto: m,
    p_metodo: datos.metodo,
    p_descripcion: datos.descripcion,
    p_usuario: usuario.id,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo registrar el movimiento.") }
  refrescar()
  return { ok: true, mensaje: datos.tipo === "INGRESO" ? "Ingreso registrado." : "Egreso registrado." }
}

export async function anularMovimiento(movimientoId: string, motivo: string): Promise<Resultado> {
  const usuario = await autorizar("caja.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("anular_movimiento_caja", { p_movimiento: movimientoId, p_motivo: motivo, p_usuario: usuario.id })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo anular el movimiento.") }
  refrescar()
  return { ok: true, mensaje: "Movimiento anulado (queda registrado)." }
}

export async function cerrarCaja(cajaId: string, contado: string, justificacion: string): Promise<Resultado> {
  const usuario = await autorizar("caja.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const c = numero(contado)
  if (!Number.isFinite(c) || String(contado).trim() === "") return { ok: false, mensaje: "Ingresa el efectivo contado." }
  const { data, error } = await getSupabase().rpc("cerrar_caja", {
    p_caja: cajaId,
    p_contado: c,
    p_usuario: usuario.id,
    p_justificacion: justificacion || null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo cerrar la caja.") }
  refrescar()
  const dif = Number(data ?? 0)
  return { ok: true, mensaje: dif === 0 ? "Caja cerrada y cuadrada." : `Caja cerrada con diferencia de $${dif.toLocaleString("es-CL")}.` }
}

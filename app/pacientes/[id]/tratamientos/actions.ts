"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"

type Resultado = { ok: boolean; mensaje: string; id?: string }

function refrescar(pacienteId: string) {
  revalidatePath(`/pacientes/${pacienteId}`, "layout")
}

function mensajeBD(error: { message?: string } | null, porDefecto: string) {
  return error?.message && !error.message.includes("violates") ? error.message : porDefecto
}

export async function crearTratamiento(pacienteId: string, formData: FormData): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const nombre = String(formData.get("nombre") ?? "").trim()
  const arancel = String(formData.get("arancel_id") ?? "") || null
  const profesional = String(formData.get("profesional_id") ?? "") || null
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null

  if (nombre.length < 3) return { ok: false, mensaje: "Ingresa un nombre para el tratamiento." }

  const { data, error } = await getSupabase().rpc("crear_tratamiento", {
    p_paciente: pacienteId,
    p_nombre: nombre,
    p_usuario: usuario.id,
    p_arancel: arancel,
    p_profesional: profesional,
    p_descripcion: descripcion,
  })

  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo crear el tratamiento.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Tratamiento creado.", id: data as string }
}

export async function finalizarTratamiento(pacienteId: string, tratamientoId: string): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const { error } = await getSupabase().rpc("finalizar_tratamiento", {
    p_presupuesto: tratamientoId,
    p_usuario: usuario.id,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo finalizar el tratamiento.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Tratamiento finalizado." }
}

export async function anularTratamiento(pacienteId: string, tratamientoId: string, motivo: string): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const { error } = await getSupabase().rpc("anular_tratamiento", {
    p_presupuesto: tratamientoId,
    p_usuario: usuario.id,
    p_motivo: motivo,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo anular el tratamiento.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Tratamiento anulado." }
}

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

function mensajeFases(error: { message?: string } | null, porDefecto: string) {
  if (error?.message?.includes("Could not find the function") || error?.message?.includes("schema cache")) {
    return "Falta actualizar la base de datos: ejecuta supabase/17_fases_presupuesto.sql en Supabase."
  }
  return mensajeBD(error, porDefecto)
}

export async function crearFase(pacienteId: string, tratamientoId: string, nombre: string, descripcion: string): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (nombre.trim().length < 2) return { ok: false, mensaje: "Ingresa un nombre para la fase." }

  const { data: trat } = await getSupabase().from("presupuestos").select("id").eq("id", tratamientoId).eq("paciente_id", pacienteId).maybeSingle()
  if (!trat) return { ok: false, mensaje: "Tratamiento no encontrado." }

  const { data, error } = await getSupabase().rpc("crear_fase", {
    p_presupuesto: tratamientoId,
    p_nombre: nombre,
    p_usuario: usuario.id,
    p_descripcion: descripcion || null,
  })
  if (error) return { ok: false, mensaje: mensajeFases(error, "No se pudo crear la fase.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Fase creada.", id: data as string }
}

export async function editarFase(pacienteId: string, faseId: string, nombre: string, descripcion: string): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("editar_fase", { p_fase: faseId, p_nombre: nombre, p_descripcion: descripcion || null })
  if (error) return { ok: false, mensaje: mensajeFases(error, "No se pudo guardar la fase.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Fase guardada." }
}

export async function moverFase(pacienteId: string, faseId: string, direccion: -1 | 1): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("mover_fase", { p_fase: faseId, p_direccion: direccion })
  if (error) return { ok: false, mensaje: mensajeFases(error, "No se pudo mover la fase.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Orden actualizado." }
}

export async function eliminarFase(pacienteId: string, faseId: string): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("eliminar_fase", { p_fase: faseId })
  if (error) return { ok: false, mensaje: mensajeFases(error, "No se pudo eliminar la fase.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Fase eliminada. Sus prestaciones quedaron sin fase." }
}

export async function asignarFase(pacienteId: string, itemId: string, faseId: string | null): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("asignar_fase", { p_item: itemId, p_fase: faseId })
  if (error) return { ok: false, mensaje: mensajeFases(error, "No se pudo cambiar la fase.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Prestación movida de fase." }
}

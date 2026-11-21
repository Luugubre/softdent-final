"use server"

import { revalidatePath } from "next/cache"
import { autorizar } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"
import { MENSAJE_SIN_PERMISO, puede } from "@/lib/permisos"
import { MOTIVOS_RECHAZO, type MotivoRechazo } from "@/types/presupuesto"

type Resultado = { ok: boolean; mensaje: string }

function refrescar(pacienteId?: string) {
  revalidatePath("/presupuestos-pendientes")
  if (pacienteId) revalidatePath(`/pacientes/${pacienteId}`, "layout")
}

export async function registrarContactoPresupuesto(
  presupuestoId: string,
  canal: "WHATSAPP" | "LLAMADA" | "NOTA",
  nota: string
): Promise<Resultado> {
  const usuario = await autorizar("pacientes.ver")
  if (!usuario || (!puede(usuario.rol, "presupuestos.gestionar") && !puede(usuario.rol, "agenda.gestionar"))) {
    return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  }
  if (!/^[0-9a-f-]{36}$/i.test(presupuestoId ?? "")) return { ok: false, mensaje: "El presupuesto no existe." }

  const textoNota = nota.trim()
  if (textoNota.length > 1000) return { ok: false, mensaje: "La nota es demasiado larga (máximo 1000 caracteres)." }
  if (textoNota.length < 2) {
    return { ok: false, mensaje: "Escribe el resultado del contacto (mínimo 2 caracteres)." }
  }

  const supabase = getSupabase()
  const { data: pres } = await supabase
    .from("presupuestos")
    .select("id, paciente_id, numero, nombre")
    .eq("id", presupuestoId)
    .maybeSingle()

  if (!pres) return { ok: false, mensaje: "El presupuesto no existe." }

  const etiquetaCanal = canal === "WHATSAPP" ? "WhatsApp" : canal === "LLAMADA" ? "Llamada" : "Seguimiento"
  const resumen = `[${etiquetaCanal}] ${textoNota}`

  const { error } = await supabase
    .from("presupuestos")
    .update({
      ultimo_contacto_at: new Date().toISOString(),
      ultimo_contacto_nota: resumen,
      updated_at: new Date().toISOString(),
    })
    .eq("id", presupuestoId)

  if (error) {
    console.error("Error registrando contacto:", error.message)
    return { ok: false, mensaje: "No se pudo guardar el seguimiento." }
  }

  // Registrar también en la bitácora/eventos del paciente si existe la función RPC
  await supabase.rpc("registrar_evento", {
    p_paciente_id: pres.paciente_id,
    p_tipo: "PRESUPUESTO",
    p_subtipo: "SEGUIMIENTO",
    p_titulo: `Seguimiento presupuesto ${pres.numero ? `#${pres.numero}` : pres.nombre}`,
    p_detalle: resumen,
    p_actor_nombre: usuario.nombre_completo,
    p_entidad: "presupuestos",
    p_entidad_id: pres.id,
    p_monto: null,
    p_usuario_id: usuario.id,
  })

  refrescar(pres.paciente_id)
  return { ok: true, mensaje: "Resultado de contacto registrado." }
}

export async function rechazarPresupuesto(
  presupuestoId: string,
  motivo: MotivoRechazo,
  detalle?: string
): Promise<Resultado> {
  const usuario = await autorizar("pacientes.ver")
  if (!usuario || (!puede(usuario.rol, "presupuestos.gestionar") && !puede(usuario.rol, "agenda.gestionar"))) {
    return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  }
  if (!/^[0-9a-f-]{36}$/i.test(presupuestoId ?? "")) return { ok: false, mensaje: "El presupuesto no existe." }

  if (!MOTIVOS_RECHAZO.includes(motivo)) {
    return { ok: false, mensaje: "Selecciona un motivo de rechazo válido." }
  }

  const supabase = getSupabase()
  const { data: pres } = await supabase
    .from("presupuestos")
    .select("id, paciente_id, numero, nombre")
    .eq("id", presupuestoId)
    .maybeSingle()

  if (!pres) return { ok: false, mensaje: "El presupuesto no existe." }

  const ahora = new Date().toISOString()
  const { error } = await supabase
    .from("presupuestos")
    .update({
      aprobacion: "RECHAZADO",
      estado: "RECHAZADO",
      motivo_rechazo: motivo,
      rechazo_detalle: detalle?.trim() || null,
      rechazado_en: ahora,
      finalizado_en: ahora,
      updated_at: ahora,
    })
    .eq("id", presupuestoId)

  if (error) {
    console.error("Error rechazando presupuesto:", error.message)
    return { ok: false, mensaje: "No se pudo marcar el presupuesto como rechazado." }
  }

  await supabase.rpc("registrar_evento", {
    p_paciente_id: pres.paciente_id,
    p_tipo: "PRESUPUESTO",
    p_subtipo: "RECHAZADO",
    p_titulo: `Presupuesto rechazado ${pres.numero ? `#${pres.numero}` : pres.nombre}`,
    p_detalle: detalle?.trim() ? `${motivo}: ${detalle.trim()}` : motivo,
    p_actor_nombre: usuario.nombre_completo,
    p_entidad: "presupuestos",
    p_entidad_id: pres.id,
    p_monto: null,
    p_usuario_id: usuario.id,
  })

  refrescar(pres.paciente_id)
  return { ok: true, mensaje: "Presupuesto marcado como rechazado." }
}

export async function aprobarPresupuesto(presupuestoId: string): Promise<Resultado> {
  const usuario = await autorizar("pacientes.ver")
  if (!usuario || (!puede(usuario.rol, "presupuestos.gestionar") && !puede(usuario.rol, "agenda.gestionar"))) {
    return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  }
  if (!/^[0-9a-f-]{36}$/i.test(presupuestoId ?? "")) return { ok: false, mensaje: "El presupuesto no existe." }

  const supabase = getSupabase()
  const { data: pres } = await supabase
    .from("presupuestos")
    .select("id, paciente_id, numero, nombre")
    .eq("id", presupuestoId)
    .maybeSingle()

  if (!pres) return { ok: false, mensaje: "El presupuesto no existe." }

  const ahora = new Date().toISOString()
  const { error } = await supabase
    .from("presupuestos")
    .update({
      aprobacion: "APROBADO",
      aprobado_en: ahora,
      updated_at: ahora,
    })
    .eq("id", presupuestoId)

  if (error) {
    console.error("Error aprobando presupuesto:", error.message)
    return { ok: false, mensaje: "No se pudo aprobar el presupuesto." }
  }

  refrescar(pres.paciente_id)
  return { ok: true, mensaje: "Presupuesto aprobado." }
}
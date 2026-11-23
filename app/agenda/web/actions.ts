"use server"

import { revalidatePath } from "next/cache"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"

type Resultado = { ok: boolean; mensaje: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function refrescar() {
  revalidatePath("/agenda", "layout")
  revalidatePath("/seguimiento")
}

export async function validarCitaWeb(citaId: string): Promise<Resultado> {
  const usuario = await autorizar("agenda.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!UUID.test(citaId)) return { ok: false, mensaje: "Cita no válida." }
  const { error } = await getSupabase().rpc("validar_cita_web", { p_cita: citaId, p_usuario: usuario.id })
  if (error) return { ok: false, mensaje: error.code === "P0001" ? error.message : "No se pudo validar la reserva." }
  refrescar()
  return { ok: true, mensaje: "Reserva validada y confirmada." }
}

export async function anularCitaWeb(citaId: string, motivo: string): Promise<Resultado> {
  const usuario = await autorizar("agenda.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const texto = motivo.trim()
  if (!UUID.test(citaId)) return { ok: false, mensaje: "Cita no válida." }
  if (texto.length < 3) return { ok: false, mensaje: "Indica el motivo de la anulación." }
  const { error } = await getSupabase().rpc("cambiar_estado_cita", {
    p_cita: citaId,
    p_estado: "CANCELADA",
    p_usuario: usuario.id,
    p_motivo: `Reserva web anulada: ${texto}`.slice(0, 300),
  })
  if (error) return { ok: false, mensaje: error.code === "P0001" ? error.message : "No se pudo anular la reserva." }
  refrescar()
  return { ok: true, mensaje: "Reserva anulada." }
}

export async function cambiarAgendaOnlineDentista(profesionalId: string, visible: boolean): Promise<Resultado> {
  const usuario = await autorizar("administracion.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!UUID.test(profesionalId)) return { ok: false, mensaje: "Profesional no válido." }
  const { error } = await getSupabase()
    .from("perfiles")
    .update({ agenda_online: visible })
    .eq("id", profesionalId)
    .eq("rol", "DENTISTA")
  if (error) return { ok: false, mensaje: "No se pudo guardar el cambio." }
  revalidatePath("/administracion/agenda-online")
  return { ok: true, mensaje: visible ? "El dentista aparece en la agenda online." : "El dentista ya no aparece en la agenda online." }
}

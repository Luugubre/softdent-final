"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { CARAS, LESIONES, PREEXISTENCIAS, PASOS_AVANCE, type Cara } from "@/types/odontograma"

type Resultado = { ok: boolean; mensaje: string }

function refrescar(pacienteId: string) {
  revalidatePath(`/pacientes/${pacienteId}`, "layout")
}

function limpiarCaras(caras: string[]): Cara[] {
  return [...new Set(caras)].filter((c): c is Cara => (CARAS as readonly string[]).includes(c))
}

/** Los RAISE EXCEPTION de la BD ya vienen en español */
function mensajeBD(error: { message?: string } | null, porDefecto: string) {
  return error?.message && !error.message.includes("violates") ? error.message : porDefecto
}

// =====================================================================
// HALLAZGOS
// =====================================================================

export async function registrarHallazgo(
  pacienteId: string,
  datos: { pieza: number; tipo: "PREEXISTENCIA" | "LESION"; codigo: string; caras: string[]; nota?: string }
): Promise<Resultado> {
  const usuario = await autorizar("odontograma.editar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const catalogo = datos.tipo === "LESION" ? LESIONES : PREEXISTENCIAS
  if (!(datos.codigo in catalogo)) return { ok: false, mensaje: "Selecciona el tipo de hallazgo." }

  const { error } = await getSupabase()
    .from("odontograma_hallazgos")
    .insert({
      paciente_id: pacienteId,
      pieza: datos.pieza,
      tipo: datos.tipo,
      codigo: datos.codigo,
      caras: limpiarCaras(datos.caras),
      nota: datos.nota?.trim() || null,
      creado_por: usuario.id,
    })

  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo registrar el hallazgo.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: datos.tipo === "LESION" ? "Lesión registrada." : "Preexistencia registrada." }
}

export async function marcarAusente(pacienteId: string, pieza: number): Promise<Resultado> {
  const usuario = await autorizar("odontograma.editar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const { error } = await getSupabase().rpc("marcar_pieza_ausente", {
    p_paciente: pacienteId,
    p_pieza: pieza,
    p_usuario: usuario.id,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo marcar la pieza.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: `Pieza ${pieza} marcada ausente.` }
}

export async function marcarSano(pacienteId: string, pieza: number): Promise<Resultado> {
  const usuario = await autorizar("odontograma.editar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const { error } = await getSupabase().rpc("marcar_pieza_sana", {
    p_paciente: pacienteId,
    p_pieza: pieza,
    p_usuario: usuario.id,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo marcar la pieza.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: `Pieza ${pieza} marcada sana.` }
}

// =====================================================================
// PRESTACIONES DEL PLAN
// =====================================================================

export async function agregarPrestacion(
  pacienteId: string,
  datos: { tratamientoId: string; prestacionId: string; pieza: number | null; caras: string[]; nota?: string }
): Promise<Resultado> {
  const usuario = await autorizar("presupuestos.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  // El tratamiento debe ser de este paciente
  const { data: trat } = await getSupabase()
    .from("presupuestos")
    .select("id")
    .eq("id", datos.tratamientoId)
    .eq("paciente_id", pacienteId)
    .maybeSingle()
  if (!trat) return { ok: false, mensaje: "Selecciona un tratamiento válido." }

  const { error } = await getSupabase().rpc("agregar_prestacion_tratamiento", {
    p_presupuesto: datos.tratamientoId,
    p_prestacion: datos.prestacionId,
    p_pieza: datos.pieza,
    p_caras: limpiarCaras(datos.caras),
    p_usuario: usuario.id,
    p_nota: datos.nota ?? null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo agregar la prestación.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Prestación agregada al tratamiento." }
}

export async function evolucionarItem(
  pacienteId: string,
  itemId: string,
  progreso: number,
  nota?: string
): Promise<Resultado> {
  const usuario = await autorizar("tratamientos.evolucionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!(PASOS_AVANCE as readonly number[]).includes(progreso)) return { ok: false, mensaje: "Avance inválido." }

  const { data: monto, error } = await getSupabase().rpc("evolucionar_item", {
    p_item: itemId,
    p_progreso: progreso,
    p_usuario: usuario.id,
    p_nota: nota ?? null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo registrar el avance.") }

  refrescar(pacienteId)
  const pesos = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    Number(monto ?? 0)
  )
  return { ok: true, mensaje: `Avance al ${progreso}% registrado. Quedan ${pesos} habilitados para cobrar.` }
}

export async function anularItem(pacienteId: string, itemId: string, motivo: string): Promise<Resultado> {
  if (!(await autorizar("presupuestos.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!motivo.trim()) return { ok: false, mensaje: "Indica el motivo de la anulación." }

  // Solo se puede anular si aún no tiene avances (no hay nada habilitado para cobrar)
  const { data, error } = await getSupabase()
    .from("presupuesto_items")
    .update({ estado: "ANULADO", motivo_anulacion: motivo.trim() })
    .eq("id", itemId)
    .eq("paciente_id", pacienteId)
    .eq("progreso", 0)
    .eq("abonado", 0)
    .neq("estado", "ANULADO")
    .select("id")

  if (error) return { ok: false, mensaje: "No se pudo anular la prestación." }
  if (!data?.length) return { ok: false, mensaje: "Solo se pueden anular prestaciones sin avances ni abonos (anula primero el pago)." }

  refrescar(pacienteId)
  return { ok: true, mensaje: "Prestación anulada." }
}

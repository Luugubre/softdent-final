"use server"

import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { obtenerItems, obtenerTratamientos } from "@/lib/tratamientos"
import { revalidatePath } from "next/cache"

const UUID = /^[0-9a-f-]{36}$/i

export type PresupuestoOpt = {
  id: string
  folio: number | string
  nombre: string
  total: number
  descuento: number
  abonado: number
  saldo: number
  items: {
    nombre_prestacion: string
    pieza?: string | null
    precio: number
  }[]
}

export async function obtenerPresupuestosActivosPaciente(pacienteId: string) {
  if (!(await autorizar("presupuestos.enviar"))) return { error: MENSAJE_SIN_PERMISO }
  if (!UUID.test(pacienteId ?? "")) return { error: "Paciente no válido." }
  try {

    const [tratamientos, { items }] = await Promise.all([
      obtenerTratamientos(pacienteId),
      obtenerItems(pacienteId),
    ])

    const formateados: PresupuestoOpt[] = tratamientos
      .filter((t) => t.estado !== "ANULADO")
      .map((t) => {
        const itemsPropios = items.filter(
          (i) => i.presupuesto_id === t.id && i.estado !== "ANULADO"
        )

        const total = Number(t.total ?? 0)
        const abonado = Number(t.abonado ?? 0)
        const saldo = Math.max(0, total - abonado)

        return {
          id: t.id,
          folio: t.numero ?? t.id.substring(0, 8),
          nombre: t.nombre || `Tratamiento N° ${t.numero ?? ""}`,
          total,
          descuento: 0,
          abonado,
          saldo,
          items: itemsPropios.map((item) => {
            const raw = item as unknown as Record<string, unknown>
            const piezaValor = raw.pieza ?? raw.diente ?? null
            return {
              nombre_prestacion: item.prestacion?.nombre ?? "Prestación",
              pieza: piezaValor !== null && piezaValor !== "" ? String(piezaValor) : null,
              precio: Number(item.precio ?? 0),
            }
          }),
        }
      })

    return { presupuestos: formateados }
  } catch (e: unknown) {
    console.error("Error obteniendo presupuestos del paciente:", e)
    return { error: "No se pudieron obtener los presupuestos del paciente." }
  }
}

export async function registrarEnvioPresupuestoWhatsApp(payload: {
  paciente_id: string
  presupuesto_id: string
  telefono: string
  mensaje: string
}) {
  const usuario = await autorizar("presupuestos.enviar")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }
  if (!UUID.test(payload.paciente_id ?? "") || !UUID.test(payload.presupuesto_id ?? "")) return { error: "Datos no válidos." }
  const mensaje = String(payload.mensaje ?? "").trim()
  if (!mensaje || mensaje.length > 4000) return { error: "El mensaje está vacío o es demasiado largo." }
  try {
    const supabase = getSupabase()

    const { error } = await supabase.from("contactos_paciente").insert({
      paciente_id: payload.paciente_id,
      tipo: "PRESUPUESTO",
      canal: "WHATSAPP",
      destino: String(payload.telefono ?? "").replace(/[^\d+]/g, "").slice(0, 20) || null,
      mensaje,
      registrado_por: usuario.id,
      metadata: { presupuesto_id: payload.presupuesto_id },
    })

    if (error) {
      console.error("Error al registrar envío de WhatsApp:", error)
      return { error: "No se pudo registrar la interacción en la bitácora." }
    }

    revalidatePath(`/pacientes/${payload.paciente_id}`)
    revalidatePath(`/pacientes/${payload.paciente_id}/tratamientos`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado"
    return { error: msg }
  }
}
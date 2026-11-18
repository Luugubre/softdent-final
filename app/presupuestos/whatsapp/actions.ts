"use server"

import { getSupabase } from "@/lib/supabase"
import { requerirUsuario } from "@/lib/auth"
import { obtenerItems, obtenerTratamientos } from "@/lib/tratamientos"
import { revalidatePath } from "next/cache"

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
  try {
    await requerirUsuario()

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
  try {
    const usuario = await requerirUsuario()
    const supabase = getSupabase()

    const { error } = await supabase.from("contactos_paciente").insert({
      paciente_id: payload.paciente_id,
      tipo: "PRESUPUESTO",
      canal: "WHATSAPP",
      destino: payload.telefono,
      mensaje: payload.mensaje,
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
"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { z } from "zod"
import { requerirPermiso } from "@/lib/auth"

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const loteSchema = z.object({
  profesional_id: z.string().uuid("Debes seleccionar un profesional."),
  motivo: z.string().trim().max(200, "Motivo: máximo 200 caracteres.").default(""),
  entradas: z
    .array(
      z.object({
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
        bloqueado: z.boolean(),
        hora_inicio: z.string().regex(HORA, "Hora de inicio no válida.").nullable().optional(),
        hora_fin: z.string().regex(HORA, "Hora de término no válida.").nullable().optional(),
      })
    )
    .min(1, "Debes seleccionar al menos una fecha.")
    .max(120, "Máximo 120 fechas por vez."),
})

export type HorarioEspecial = {
  id: string
  profesional_id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  motivo: string | null
  profesional?: { nombre_completo: string } | null
}

export type EntradaDiaEspecial = {
  fecha: string
  bloqueado: boolean
  hora_inicio?: string | null
  hora_fin?: string | null
}

export async function listarHorariosEspeciales(desde?: string) {
  await requerirPermiso("agenda.configurar")
  const supabase = getSupabase()

  // Por defecto trae desde el primer día del mes actual para alimentar el visor mensual
  const inicioMes = new Date()
  inicioMes.setDate(1)
  const fechaBase = desde ?? inicioMes.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("horarios_especiales")
    .select(`
      id,
      profesional_id,
      fecha,
      hora_inicio,
      hora_fin,
      motivo,
      profesional:perfiles!horarios_especiales_profesional_id_fkey(nombre_completo)
    `)
    .gte("fecha", fechaBase)
    .order("fecha", { ascending: true })

  if (error) {
    console.error("Error listando horarios especiales:", error)
    return []
  }

  return (data ?? []) as unknown as HorarioEspecial[]
}

export async function guardarHorariosEspecialesLote(payload: {
  profesional_id: string
  motivo: string
  entradas: EntradaDiaEspecial[]
}) {
  try {
    await requerirPermiso("agenda.configurar")
    const supabase = getSupabase()

    const datos = loteSchema.safeParse(payload)
    if (!datos.success) return { error: datos.error.issues[0].message }
    payload = { ...datos.data, motivo: datos.data.motivo ?? "" }

    for (const e of payload.entradas) {
      if (!e.bloqueado) {
        if (!e.hora_inicio || !e.hora_fin || e.hora_inicio >= e.hora_fin) {
          return { error: `Rango horario inválido para la fecha ${e.fecha}.` }
        }
      }
    }

    const filas = payload.entradas.map((e) => ({
      profesional_id: payload.profesional_id,
      fecha: e.fecha,
      hora_inicio: e.bloqueado ? null : e.hora_inicio,
      hora_fin: e.bloqueado ? null : e.hora_fin,
      motivo: payload.motivo.trim() || null,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from("horarios_especiales")
      .upsert(filas, { onConflict: "profesional_id,fecha" })

    if (error) {
      console.error("Error guardando horarios especiales:", error)
      return { error: "No se pudieron guardar los horarios especiales." }
    }

    const fechasOrdenadas = filas.map((f) => f.fecha).sort()
    const { data: huerfanas } = await supabase.rpc("citas_huerfanas", {
      p_desde: fechasOrdenadas[0],
      p_hasta: fechasOrdenadas[fechasOrdenadas.length - 1],
    })

    const citasAfectadas = (huerfanas ?? []).filter(
      (c: { profesional_id: string }) => c.profesional_id === payload.profesional_id
    )

    revalidatePath("/agenda")
    revalidatePath("/agenda/configuracion")

    return {
      ok: true,
      creados: filas.length,
      citasAfectadas: citasAfectadas.length,
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado"
    return { error: msg }
  }
}

export async function eliminarHorarioEspecial(id: string) {
  await requerirPermiso("agenda.configurar")
  if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) return
  const supabase = getSupabase()

  await supabase.from("horarios_especiales").delete().eq("id", id)

  revalidatePath("/agenda")
  revalidatePath("/agenda/configuracion")
}
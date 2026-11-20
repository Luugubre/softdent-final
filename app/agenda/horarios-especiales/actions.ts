"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { requerirPermiso } from "@/lib/auth"

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

    if (!payload.profesional_id) {
      return { error: "Debes seleccionar un profesional." }
    }
    if (!payload.entradas || payload.entradas.length === 0) {
      return { error: "Debes seleccionar al menos una fecha." }
    }

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
  const supabase = getSupabase()

  await supabase.from("horarios_especiales").delete().eq("id", id)

  revalidatePath("/agenda")
  revalidatePath("/agenda/configuracion")
}
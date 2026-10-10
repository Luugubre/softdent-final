import { cache } from "react"
import { getSupabase } from "@/lib/supabase"
import type { Paciente } from "@/types/paciente"
import type { Antecedente } from "@/types/antecedente"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Consultas compartidas entre el layout y las páginas de la ficha.
 * `cache` evita repetir la misma consulta dos veces en una misma carga.
 */
export const obtenerPaciente = cache(async (id: string): Promise<Paciente | null> => {
  if (!UUID.test(id)) return null
  const { data } = await getSupabase().from("pacientes").select("*").eq("id", id).maybeSingle()
  return data as Paciente | null
})

export const obtenerAntecedentes = cache(async (pacienteId: string): Promise<Antecedente[]> => {
  const { data } = await getSupabase()
    .from("antecedentes")
    .select("*")
    .eq("paciente_id", pacienteId)
    .order("fecha_registro", { ascending: false })
  return (data ?? []) as Antecedente[]
})

export type PacienteResumen = {
  id: string
  rut: string
  nombres: string
  apellidos: string
  fecha_nacimiento: string
  activo: boolean
}

export const obtenerResumenPaciente = cache(async (id: string): Promise<PacienteResumen | null> => {
  const { data } = await getSupabase()
    .from("pacientes")
    .select("id, rut, nombres, apellidos, fecha_nacimiento, activo")
    .eq("id", id)
    .maybeSingle()
  return data as PacienteResumen | null
})

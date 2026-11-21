import { cache } from "react"
import { getSupabase } from "@/lib/supabase"

const UUID = /^[0-9a-f-]{36}$/i

export type RecetaListado = {
  id: string
  folio: number
  created_at: string
  diagnostico: string
  estado: "EMITIDA" | "ANULADA"
  motivo_anulacion: string | null
  paciente_id: string
  profesional_id: string
  pacienteNombre: string
  pacienteRut: string
  profesionalNombre: string
}

type Fila = Omit<RecetaListado, "pacienteNombre" | "pacienteRut" | "profesionalNombre"> & {
  pacientes: { nombres: string | null; apellidos: string | null; rut: string | null } | null
  profesional: { nombre_completo: string | null } | null
}

// Recetas (todas o de un paciente)
export const listarRecetas = cache(async (pacienteId?: string): Promise<RecetaListado[]> => {
  if (pacienteId && !UUID.test(pacienteId)) return []
  let consulta = getSupabase()
    .from("recetas")
    .select(
      "id, folio, created_at, diagnostico, estado, motivo_anulacion, paciente_id, profesional_id, " +
        "pacientes(nombres, apellidos, rut), profesional:perfiles!recetas_profesional_id_fkey(nombre_completo)"
    )
    .order("folio", { ascending: false })
    .limit(500)
  if (pacienteId) consulta = consulta.eq("paciente_id", pacienteId)

  const { data, error } = await consulta
  if (error) throw new Error(`No se pudieron cargar las recetas: ${error.message}`)

  return ((data ?? []) as unknown as Fila[]).map(({ pacientes, profesional, ...r }) => ({
    ...r,
    pacienteNombre: `${pacientes?.nombres ?? ""} ${pacientes?.apellidos ?? ""}`.trim() || "Paciente desconocido",
    pacienteRut: pacientes?.rut ?? "",
    profesionalNombre: profesional?.nombre_completo ?? "—",
  }))
})

export const CATALOGO_MEDICAMENTOS = [
  { id: "1", medicamento: "Amoxicilina", presentacion: "Comprimidos 875 mg", dosis: "1 comprimido", frecuencia: "Cada 12 horas", duracion: "7 días", via: "Oral", cantidad: "1 caja" },
  { id: "2", medicamento: "Ibuprofeno", presentacion: "Comprimidos 600 mg", dosis: "1 comprimido", frecuencia: "Cada 8 horas", duracion: "3 días", via: "Oral", cantidad: "1 caja" },
  { id: "3", medicamento: "Paracetamol", presentacion: "Comprimidos 500 mg", dosis: "1 comprimido", frecuencia: "Cada 8 horas", duracion: "3 días", via: "Oral", cantidad: "1 caja" },
  { id: "4", medicamento: "Ketorolaco", presentacion: "Sublingual 10 mg", dosis: "1 comprimido", frecuencia: "Cada 8 horas", duracion: "2 días", via: "Sublingual", cantidad: "1 caja" },
  { id: "5", medicamento: "Clorhexidina", presentacion: "Colutorio 0,12%", dosis: "15 ml", frecuencia: "Cada 12 horas", duracion: "7 días", via: "Enjuague bucal", cantidad: "1 frasco" },
  { id: "6", medicamento: "Clindamicina", presentacion: "Cápsulas 300 mg", dosis: "1 cápsula", frecuencia: "Cada 8 horas", duracion: "7 días", via: "Oral", cantidad: "1 caja" },
]

// Dentistas activos que pueden emitir recetas
export const dentistasEmisores = cache(async () => {
  const { data, error } = await getSupabase()
    .from("perfiles")
    .select("id, nombre_completo, rut, especialidad")
    .eq("rol", "DENTISTA")
    .eq("activo", true)
    .order("nombre_completo")
  if (error) throw new Error(`No se pudieron cargar los dentistas: ${error.message}`)
  return (data ?? []).map((d) => ({
    id: String(d.id),
    nombre_completo: d.nombre_completo || "Dr(a). Sin nombre",
    rut: d.rut || "",
    especialidad: d.especialidad || "Odontología general",
  }))
})

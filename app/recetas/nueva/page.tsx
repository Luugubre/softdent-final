import { redirect } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"
import { CATALOGO_MEDICAMENTOS, dentistasEmisores } from "@/lib/recetas"
import FormNuevaReceta from "./FormNuevaReceta"

const UUID = /^[0-9a-f-]{36}$/i

export default async function NuevaRecetaPage({ searchParams }: { searchParams: Promise<{ paciente?: string }> }) {
  const usuario = await requerirPermiso("recetas.emitir")
  const { paciente } = await searchParams
  if (paciente && UUID.test(paciente)) redirect(`/pacientes/${paciente}/recetas/nueva`)

  const db = getSupabase()
  const [{ data: pacientesRaw, error: errPacientes }, { data: alergiasRaw, error: errAlergias }, dentistas] = await Promise.all([
    db.from("pacientes").select("id, nombres, apellidos, rut").eq("activo", true).order("apellidos"),
    // Alergias vigentes
    db.from("antecedentes").select("paciente_id, categoria, contenido").eq("categoria", "ALERGIA").eq("vigente", true),
    dentistasEmisores(),
  ])
  const error = errPacientes ?? errAlergias
  if (error) throw new Error(`No se pudieron cargar los datos de la receta: ${error.message}`)

  const pacientes = (pacientesRaw ?? []).map((p) => ({
    id: String(p.id),
    nombre_completo: `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim(),
    rut: p.rut || "",
    antecedentes: (alergiasRaw ?? [])
      .filter((a) => a.paciente_id === p.id)
      .map((a) => ({ categoria: a.categoria, detalle: a.contenido })),
  }))

  return (
    <div className="max-w-4xl mx-auto p-6">
      <FormNuevaReceta catalogo={CATALOGO_MEDICAMENTOS} pacientes={pacientes} dentistas={dentistas} rolUsuario={usuario.rol} />
    </div>
  )
}

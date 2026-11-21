import { getSupabase } from "@/lib/supabase"
import { tipoDesdePlantilla, type DocumentoClinico, type PlantillaDocumento } from "@/lib/documentos-tipos"

export async function listarDocumentos(pacienteId: string): Promise<DocumentoClinico[]> {
  const { data, error } = await getSupabase()
    .from("documentos_clinicos")
    .select("id, folio, tipo, titulo, destinatario, estado, motivo_anulacion, created_at, profesional_id, perfiles!documentos_clinicos_profesional_id_fkey(nombre_completo)")
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`No se pudieron cargar los documentos: ${error.message}`)
  return (data ?? []).map((d) => {
    const { perfiles, ...resto } = d as typeof d & { perfiles: { nombre_completo: string } | null }
    return { ...resto, profesional_nombre: perfiles?.nombre_completo ?? "—" } as DocumentoClinico
  })
}

export async function plantillasDocumento(): Promise<PlantillaDocumento[]> {
  const { data } = await getSupabase()
    .from("plantillas_documento")
    .select("id, tipo, nombre, contenido")
    .eq("activa", true)
    .order("nombre")
  return (data ?? []).flatMap((p) => {
    const tipo = tipoDesdePlantilla(p.tipo)
    return tipo ? [{ id: String(p.id), tipo, nombre: p.nombre, contenido: p.contenido }] : []
  })
}

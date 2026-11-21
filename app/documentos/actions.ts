"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"
import { limpiarHtmlDocumento } from "@/lib/html-seguro"
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/documentos-tipos"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const documentoSchema = z.object({
  pacienteId: z.string().regex(UUID, "Paciente inválido"),
  tipo: z.enum(Object.keys(TIPOS_DOCUMENTO) as [TipoDocumento, ...TipoDocumento[]]),
  titulo: z.string().trim().min(3, "Escribe el título del documento").max(150, "Título: máximo 150 caracteres"),
  contenido: z.string().max(60000, "Contenido: máximo 60.000 caracteres"),
  destinatario: z.string().trim().max(200, "Destinatario: máximo 200 caracteres").optional(),
  plantillaId: z.string().regex(UUID).optional().nullable(),
})

export async function emitirDocumento(datos: z.input<typeof documentoSchema>): Promise<{ error?: string; id?: string }> {
  const usuario = await autorizar("documentos.emitir")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }

  const v = documentoSchema.safeParse(datos)
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Datos inválidos" }
  const contenido = limpiarHtmlDocumento(v.data.contenido)
  if (contenido.replace(/<[^>]*>/g, "").trim().length < 10) return { error: "El contenido del documento está vacío." }
  if (v.data.tipo === "DERIVACION" && !v.data.destinatario) return { error: "Indica a quién se deriva al paciente." }

  const { data, error } = await getSupabase().rpc("emitir_documento", {
    p_usuario: usuario.id,
    p_paciente: v.data.pacienteId,
    p_tipo: v.data.tipo,
    p_titulo: v.data.titulo,
    p_contenido: contenido,
    p_destinatario: v.data.destinatario || null,
    p_plantilla: v.data.plantillaId || null,
  })
  if (error) return { error: error.message }

  revalidatePath(`/pacientes/${v.data.pacienteId}/documentos`)
  revalidatePath(`/pacientes/${v.data.pacienteId}`)
  return { id: data as string }
}

export async function anularDocumento(documentoId: string, motivo: string): Promise<{ error?: string }> {
  const usuario = await autorizar("documentos.emitir")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }
  if (!UUID.test(documentoId)) return { error: "Documento inválido" }
  const m = (motivo ?? "").trim()
  if (m.length < 5 || m.length > 300) return { error: "El motivo debe tener entre 5 y 300 caracteres." }

  const db = getSupabase()
  const { error } = await db.rpc("anular_documento", { p_documento: documentoId, p_usuario: usuario.id, p_motivo: m })
  if (error) return { error: error.message }

  const { data } = await db.from("documentos_clinicos").select("paciente_id").eq("id", documentoId).maybeSingle()
  if (data) revalidatePath(`/pacientes/${data.paciente_id}/documentos`)
  return {}
}

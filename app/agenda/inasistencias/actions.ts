"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO, puede } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"

const contactoSchema = z.object({
  citaId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Cita inválida"),
  canal: z.enum(["WHATSAPP", "LLAMADA", "CORREO", "PRESENCIAL"]),
  nota: z.string().trim().min(3, "Escribe una nota breve del contacto").max(500, "Nota: máximo 500 caracteres"),
})

export async function registrarContactoInasistencia(datos: z.input<typeof contactoSchema>): Promise<{ error?: string }> {
  const usuario = await autorizar("agenda.gestionar")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }

  const v = contactoSchema.safeParse(datos)
  if (!v.success) return { error: v.error.issues[0]?.message ?? "Datos inválidos" }

  const db = getSupabase()
  const { data: cita } = await db
    .from("citas")
    .select("id, paciente_id, profesional_id, estado, pacientes(telefono)")
    .eq("id", v.data.citaId)
    .maybeSingle()
  if (!cita || cita.estado !== "NO_ASISTIO") return { error: "La cita no está marcada como inasistencia." }
  if (!puede(usuario.rol, "agenda.ver_todas") && cita.profesional_id !== usuario.id) return { error: MENSAJE_SIN_PERMISO }

  const telefono = (cita.pacientes as unknown as { telefono: string | null } | null)?.telefono
  const { error } = await db.from("contactos_paciente").insert({
    paciente_id: cita.paciente_id,
    tipo: "INASISTENCIA",
    canal: v.data.canal,
    destino: v.data.canal === "WHATSAPP" || v.data.canal === "LLAMADA" ? (telefono ?? "").replace(/[^\d+]/g, "").slice(0, 20) || null : null,
    mensaje: v.data.nota,
    registrado_por: usuario.id,
    metadata: { cita_id: cita.id },
  })
  if (error) return { error: "No se pudo registrar el contacto." }

  revalidatePath("/agenda/inasistencias")
  return {}
}

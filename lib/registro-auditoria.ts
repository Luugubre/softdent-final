import { getSupabase } from "@/lib/supabase"

type Valores = Record<string, unknown> | null

// Cambio de configuración o de datos de usuario (tabla auditoria)
export async function registrarCambio(datos: {
  tabla: string
  registroId: string
  accion: "CREADO" | "MODIFICADO"
  anterior?: Valores
  nuevo: Valores
  usuarioId: string | null
}) {
  const { error } = await getSupabase()
    .from("auditoria")
    .insert({
      tabla: datos.tabla,
      registro_id: datos.registroId,
      accion: datos.accion,
      anterior: datos.anterior ?? null,
      nuevo: datos.nuevo,
      usuario_id: datos.usuarioId,
    })
  if (error) console.error("No se pudo registrar el cambio en auditoría:", error.message)
}

// Evento en el historial clínico del paciente (también aparece en la bitácora de auditoría)
export async function registrarEventoPaciente(datos: {
  pacienteId: string
  tipo: "CONSENTIMIENTO" | "DOCUMENTO" | "RECETA"
  accion: string
  titulo: string
  detalle?: string | null
  usuarioId?: string | null
  profesional?: string | null
  tabla?: string
  referenciaId?: string
}) {
  const { error } = await getSupabase().rpc("registrar_evento", {
    p_paciente_id: datos.pacienteId,
    p_tipo: datos.tipo,
    p_accion: datos.accion,
    p_titulo: datos.titulo,
    p_detalle: datos.detalle ?? null,
    p_profesional: datos.profesional ?? null,
    p_tabla: datos.tabla ?? null,
    p_ref_id: datos.referenciaId ?? null,
    p_datos: null,
    p_usuario_id: datos.usuarioId ?? null,
  })
  if (error) console.error("No se pudo registrar el evento del paciente:", error.message)
}

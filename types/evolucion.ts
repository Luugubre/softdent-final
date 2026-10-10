export type Evolucion = {
  id: string
  paciente_id: string
  fecha_atencion: string // "YYYY-MM-DD"
  profesional_nombre: string
  profesional_id: string | null
  motivo: string | null
  diagnostico: string | null
  procedimiento: string
  observaciones: string | null
  indicaciones: string | null
  created_at: string
}

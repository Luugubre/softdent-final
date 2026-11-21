export const MOTIVOS_RECHAZO = [
  "PRECIO",
  "OTRA_CLINICA",
  "MIEDO",
  "FALTA_TIEMPO",
  "OTRO",
] as const

export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number]

export const MOTIVO_RECHAZO_ETIQUETA: Record<MotivoRechazo, string> = {
  PRECIO: "Precio",
  OTRA_CLINICA: "Se atenderá en otra clínica",
  MIEDO: "Miedo",
  FALTA_TIEMPO: "Falta de tiempo",
  OTRO: "Otro",
}

export type PresupuestoSinAprobar = {
  id: string
  numero: number | null
  nombre: string
  descripcion: string | null
  created_at: string
  antiguedad_dias: number
  monto_total: number
  items_count: number
  paciente_id: string
  paciente_nombre: string
  paciente_rut: string | null
  paciente_telefono: string | null
  profesional_id: string | null
  profesional_nombre: string
  proxima_cita: {
    id: string
    inicio: string
    estado: string
  } | null
  ultimo_contacto_at: string | null
  ultimo_contacto_nota: string | null
}
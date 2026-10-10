export type EstadoTratamiento = "ACTIVO" | "FINALIZADO" | "ANULADO"

export const ESTADO_TRATAMIENTO: Record<EstadoTratamiento, { etiqueta: string; estilo: string }> = {
  ACTIVO: { etiqueta: "Activo", estilo: "bg-blue-100 text-blue-800" },
  FINALIZADO: { etiqueta: "Finalizado", estilo: "bg-emerald-100 text-emerald-800" },
  ANULADO: { etiqueta: "Anulado", estilo: "bg-gray-200 text-gray-500" },
}

export type Tratamiento = {
  id: string
  paciente_id: string
  numero: number
  nombre: string
  descripcion: string | null
  estado: EstadoTratamiento
  created_at: string
  finalizado_en: string | null
  motivo_anulacion: string | null
  arancel: { nombre: string } | null
  profesional: { nombre_completo: string } | null
}

export type ResumenTratamiento = Tratamiento & {
  cantidad: number
  total: number
  habilitado: number
  abonado: number
  porPagar: number
  avance: number // % ponderado por valor
}

/** Para elegir tratamiento al agregar una prestación desde el odontograma general */
export type TratamientoOpcion = { id: string; numero: number; nombre: string }

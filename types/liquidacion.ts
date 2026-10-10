export type EstadoLiquidacion = "EMITIDA" | "PAGADA" | "ANULADA"

export const ESTADO_LIQUIDACION: Record<EstadoLiquidacion, { etiqueta: string; estilo: string }> = {
  EMITIDA: { etiqueta: "Emitida · por pagar", estilo: "bg-amber-100 text-amber-800" },
  PAGADA: { etiqueta: "Pagada", estilo: "bg-emerald-100 text-emerald-800" },
  ANULADA: { etiqueta: "Anulada", estilo: "bg-gray-200 text-gray-500" },
}

export const METODOS_PAGO_LIQUIDACION = ["TRANSFERENCIA", "EFECTIVO", "CHEQUE"] as const
export type MetodoPagoLiquidacion = (typeof METODOS_PAGO_LIQUIDACION)[number]
export const METODO_LIQUIDACION: Record<MetodoPagoLiquidacion, string> = {
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  CHEQUE: "Cheque",
}

/** Una fila de la vista v_produccion_profesional (un tramo evolucionado por un profesional) */
export type Produccion = {
  avance_id: string
  item_id: string
  profesional_id: string
  profesional_nombre: string
  porcentaje: number | null
  paciente_id: string
  paciente_nombre: string
  numero_ficha: number
  prestacion_nombre: string
  pieza: number | null
  tratamiento_numero: number
  progreso_anterior: number
  progreso_nuevo: number
  monto_base: number
  fecha_avance: string
  precio: number
  progreso: number
  abonado: number
  completado_en: string | null
  fecha_pagado: string | null
  liquidable: boolean
  fecha_liquidable: string | null
  liquidacion_id: string | null
  liquidacion_numero: number | null
}

export type DetalleLiquidacion = {
  id: string
  item_id: string
  paciente_id: string
  paciente_nombre: string
  prestacion_nombre: string
  pieza: number | null
  tramo: string
  fecha_realizado: string | null
  fecha_pagado: string | null
  monto_base: number
  porcentaje: number
  monto: number
}

export type Liquidacion = {
  id: string
  numero: number
  profesional_id: string
  fecha_corte: string
  porcentaje: number
  cantidad: number
  total_base: number
  total: number
  nota: string | null
  estado: EstadoLiquidacion
  created_at: string
  fecha_pago: string | null
  metodo_pago: MetodoPagoLiquidacion | null
  referencia_pago: string | null
  fecha_anulacion: string | null
  motivo_anulacion: string | null
  profesional: { nombre_completo: string; rut: string | null; registro_profesional: string | null } | null
  creador: { nombre_completo: string } | null
  pagador: { nombre_completo: string } | null
  anulador: { nombre_completo: string } | null
}

export type ProfesionalLiquidacion = {
  id: string
  nombre_completo: string
  rol: string
  activo: boolean
  porcentaje_liquidacion: number | null
}

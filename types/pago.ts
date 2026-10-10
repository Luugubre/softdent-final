export const METODOS_PAGO = ["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]

export const METODO_PAGO: Record<MetodoPago, { etiqueta: string; icono: string; pideReferencia: boolean }> = {
  EFECTIVO: { etiqueta: "Efectivo", icono: "💵", pideReferencia: false },
  DEBITO: { etiqueta: "Débito", icono: "💳", pideReferencia: true },
  CREDITO: { etiqueta: "Crédito", icono: "💳", pideReferencia: true },
  TRANSFERENCIA: { etiqueta: "Transferencia", icono: "🏦", pideReferencia: true },
}

export type DetallePago = {
  id: string
  item_id: string
  monto: number
  item: {
    pieza: number | null
    prestacion: { nombre: string } | null
    presupuesto: { numero: number; nombre: string } | null
  } | null
}

export type Pago = {
  id: string
  numero: number
  paciente_id: string
  monto: number
  metodo: MetodoPago
  referencia: string | null
  numero_boleta: string | null
  nota: string | null
  estado: "VIGENTE" | "ANULADO"
  fecha: string
  fecha_anulacion: string | null
  motivo_anulacion: string | null
  registrador: { nombre_completo: string } | null
  anulador: { nombre_completo: string } | null
  detalle: DetallePago[]
}

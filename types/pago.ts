export type MetodoPago = string

const ICONOS: Record<string, string> = { EFECTIVO: "💵", DEBITO: "💳", CREDITO: "💳", TRANSFERENCIA: "🏦", BONO_FONASA: "🏥", CHEQUE: "🧾" }
const NOMBRES: Record<string, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  BONO_FONASA: "Bono FONASA",
}

export function infoMetodo(codigo: string, nombre?: string) {
  return { icono: ICONOS[codigo] ?? "💰", etiqueta: nombre ?? NOMBRES[codigo] ?? codigo.charAt(0) + codigo.slice(1).toLowerCase().replace(/_/g, " ") }
}

export type MetodoPagoOpcion = { codigo: string; nombre: string; es_efectivo: boolean; pide_referencia: boolean; registra_en_caja: boolean }

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

// =====================================================================
// Administración (catálogos y parámetros), Caja, FONASA y Convenios
// =====================================================================

export const CATALOGOS = {
  especialidades: { titulo: "Especialidades", ayuda: "Profesionales y prestaciones", conDescripcion: true },
  categorias_prestaciones: { titulo: "Categorías de prestaciones", ayuda: "Carpetas del catálogo y reportes", conDescripcion: false },
  boxes: { titulo: "Boxes de atención", ayuda: "Espacios físicos de la agenda", conDescripcion: false },
  previsiones: { titulo: "Previsiones", ayuda: "Ficha del paciente y aranceles", conDescripcion: false },
  tipos_atencion: { titulo: "Tipos de atención", ayuda: "Clasificación de citas en la agenda", conDescripcion: false },
} as const
export type TablaCatalogo = keyof typeof CATALOGOS

export const TIPOS_PREVISION = ["PARTICULAR", "FONASA", "ISAPRE", "FFAA", "OTRA"] as const

export type ItemCatalogo = {
  id: string
  nombre: string
  activo: boolean
  descripcion?: string | null
  tipo?: string | null // previsiones
  duracion_min?: number | null // tipos de atención
}

export type MetodoPagoCatalogo = {
  codigo: string
  nombre: string
  es_efectivo: boolean
  pide_referencia: boolean
  registra_en_caja: boolean
  activo: boolean
  orden: number
}

export type Parametro = {
  clave: string
  valor: string
  descripcion: string
  grupo: string
  tipo: "TEXTO" | "ENTERO" | "PORCENTAJE"
  minimo: number | null
  maximo: number | null
  updated_at: string
}

export type RegistroAuditoria = {
  id: number
  tabla: string
  registro_id: string
  accion: string
  anterior: Record<string, unknown> | null
  nuevo: Record<string, unknown> | null
  fecha: string
  usuario: { nombre_completo: string } | null
}

// ----- Caja -----
export type Caja = {
  id: string
  numero: number
  estado: "ABIERTA" | "CERRADA"
  monto_inicial: number
  abierta_en: string
  cerrada_en: string | null
  monto_esperado: number | null
  monto_contado: number | null
  diferencia: number | null
  justificacion: string | null
  nota_apertura: string | null
  abridor: { nombre_completo: string } | null
  cerrador: { nombre_completo: string } | null
}

export const ORIGEN_MOVIMIENTO: Record<string, string> = {
  MANUAL: "Manual",
  PAGO: "Pago paciente",
  AJUSTE: "Ajuste",
  LIQUIDACION: "Liquidación",
  CUOTA_CONVENIO: "Cuota convenio",
}

export type MovimientoCaja = {
  id: string
  caja_id: string
  tipo: "INGRESO" | "EGRESO"
  origen: keyof typeof ORIGEN_MOVIMIENTO
  monto: number
  metodo: string
  descripcion: string
  pago_id: string | null
  liquidacion_id: string | null
  created_at: string
  anulado: boolean
  motivo_anulacion: string | null
  anulado_en: string | null
  registrador: { nombre_completo: string } | null
  pago: { paciente_id: string } | null
}

export type ResumenMetodo = { metodo: string; nombre: string; ingresos: number; egresos: number; cantidad: number }

// ----- FONASA -----
export const ESTADO_BONO = {
  PENDIENTE: { etiqueta: "Pendiente", estilo: "bg-amber-100 text-amber-800" },
  UTILIZADO: { etiqueta: "Utilizado", estilo: "bg-emerald-100 text-emerald-800" },
  ANULADO: { etiqueta: "Anulado", estilo: "bg-gray-200 text-gray-500 line-through" },
} as const

export type BonoFonasa = {
  id: string
  folio: string
  estado: keyof typeof ESTADO_BONO
  paciente_id: string
  prestacion_id: string
  item_id: string | null
  monto_bonificado: number
  copago: number
  fecha_emision: string
  usado_en: string | null
  pago_id: string | null
  motivo_anulacion: string | null
  created_at: string
  paciente: { nombres: string; apellidos: string; rut: string } | null
  prestacion: { nombre: string; codigo_fonasa: string | null } | null
}

// ----- Convenios -----
export const TIPOS_CONVENIO = { EMPRESA: "Empresa", SINDICATO: "Sindicato", OTRO: "Otro" } as const

export type Convenio = {
  id: string
  nombre: string
  institucion: string
  tipo: keyof typeof TIPOS_CONVENIO
  rut_institucion: string | null
  contacto: string | null
  porcentaje_descuento: number
  arancel_id: string
  fecha_inicio: string
  fecha_fin: string | null
  activo: boolean
  condiciones: string | null
  beneficiarios: { id: string; activo: boolean; desde: string; paciente: { id: string; nombres: string; apellidos: string; rut: string } | null }[]
}

export type ContratoCuotas = {
  id: string
  numero: number
  convenio_id: string
  monto_total: number
  cantidad_cuotas: number
  nota: string | null
  created_at: string
  convenio: { nombre: string } | null
  paciente: { id: string; nombres: string; apellidos: string; rut: string } | null
  cuotas: { id: string; numero: number; monto: number; vencimiento: string; pagada_en: string | null; metodo: string | null; referencia: string | null }[]
}

export function convenioVigente(c: Pick<Convenio, "activo" | "fecha_inicio" | "fecha_fin">, hoy: string) {
  return c.activo && c.fecha_inicio <= hoy && (!c.fecha_fin || c.fecha_fin >= hoy)
}

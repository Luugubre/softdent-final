export const TIPOS_ARANCEL = ["PARTICULAR", "FONASA", "CONVENIO"] as const
export type TipoArancel = (typeof TIPOS_ARANCEL)[number]

export const TIPO_ARANCEL_ETIQUETAS: Record<TipoArancel, string> = {
  PARTICULAR: "Particular",
  FONASA: "FONASA",
  CONVENIO: "Convenio",
}

export type Arancel = {
  id: string
  nombre: string
  tipo: TipoArancel
  descripcion: string | null
  porcentaje_descuento: number
  es_base: boolean
  activo: boolean
}

export type ItemCatalogo = {
  id: string
  nombre: string
  activo: boolean
}

export type Prestacion = {
  id: string
  codigo_interno: string
  codigo_fonasa: string | null
  nombre: string
  descripcion: string | null
  categoria_id: string
  especialidad_id: string | null
  duracion_min: number
  icono: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export type PrecioHistorico = {
  id: string
  prestacion_id: string
  arancel_id: string
  precio: number
  vigente_desde: string
  vigente_hasta: string | null
  motivo: string | null
  creado_por: string | null
  created_at: string
}

export type PrecioVigente = {
  prestacion_id: string
  arancel_id: string
  precio: number | null
  es_precio_especifico: boolean
}

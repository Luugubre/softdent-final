export const TIPOS_DOCUMENTO = {
  CERTIFICADO: "Certificado",
  INDICACIONES: "Indicaciones",
  DERIVACION: "Derivación",
  DOCUMENTO: "Documento",
} as const
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO

export type DocumentoClinico = {
  id: string
  folio: number
  tipo: TipoDocumento
  titulo: string
  destinatario: string | null
  estado: "EMITIDO" | "ANULADO"
  motivo_anulacion: string | null
  created_at: string
  profesional_id: string
  profesional_nombre: string
}

export type PlantillaDocumento = { id: string; tipo: TipoDocumento; nombre: string; contenido: string }

export function tipoDesdePlantilla(tipoPlantilla: string): TipoDocumento | null {
  if (tipoPlantilla.startsWith("CONSENTIMIENTO")) return null
  const base = (Object.keys(TIPOS_DOCUMENTO) as TipoDocumento[]).find((t) => tipoPlantilla.startsWith(t))
  return base ?? "DOCUMENTO"
}

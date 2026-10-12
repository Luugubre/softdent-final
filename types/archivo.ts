export const BUCKET_ARCHIVOS = "archivos-pacientes"

export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024

export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const

export const CATEGORIAS_ARCHIVO = ["RADIOGRAFIA", "FOTO_CLINICA", "EXAMEN", "DOCUMENTO", "OTRO"] as const

export type CategoriaArchivo = (typeof CATEGORIAS_ARCHIVO)[number]

export const CATEGORIA_ARCHIVO_ETIQUETAS: Record<CategoriaArchivo, string> = {
  RADIOGRAFIA: "Radiografía",
  FOTO_CLINICA: "Foto clínica",
  EXAMEN: "Examen",
  DOCUMENTO: "Documento",
  OTRO: "Otro",
}

export type ArchivoPaciente = {
  id: string
  paciente_id: string
  categoria: CategoriaArchivo
  titulo: string
  descripcion: string | null
  ruta_storage: string
  nombre_archivo: string
  tipo_mime: string
  tamano_bytes: number
  subido_por: string | null
  fecha_subida: string
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const CATEGORIAS_ANTECEDENTE = [
  "ALERGIA",
  "ENFERMEDAD",
  "MEDICAMENTO",
  "CIRUGIA",
  "HABITO",
  "OTRO",
] as const

export type CategoriaAntecedente = (typeof CATEGORIAS_ANTECEDENTE)[number]

export const CATEGORIA_ETIQUETAS: Record<CategoriaAntecedente, string> = {
  ALERGIA: "Alergias",
  ENFERMEDAD: "Enfermedades / condiciones",
  MEDICAMENTO: "Medicamentos en uso",
  CIRUGIA: "Cirugías",
  HABITO: "Hábitos",
  OTRO: "Otros",
}

export type Antecedente = {
  id: string
  paciente_id: string
  categoria: CategoriaAntecedente
  contenido: string
  vigente: boolean
  profesional_id: string | null
  fecha_registro: string
  fecha_baja: string | null
  motivo_baja: string | null
}

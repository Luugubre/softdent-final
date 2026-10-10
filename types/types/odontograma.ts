// =====================================================================
// Odontograma FDI: piezas, caras, tipos de hallazgo y colores
// (sin dependencias del servidor: se usa también en el cliente)
// =====================================================================

export const CARAS = ["V", "L", "M", "D", "O"] as const
export type Cara = (typeof CARAS)[number]

export const CARA_ETIQUETAS: Record<Cara, string> = {
  V: "Vestibular",
  L: "Lingual / Palatino",
  M: "Mesial",
  D: "Distal",
  O: "Oclusal / Incisal",
}

// Disposición en pantalla (vista del profesional frente al paciente)
export const ARCADAS = {
  PERMANENTE: {
    superior: [[18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28]],
    inferior: [[48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]],
  },
  TEMPORAL: {
    superior: [[55, 54, 53, 52, 51], [61, 62, 63, 64, 65]],
    inferior: [[85, 84, 83, 82, 81], [71, 72, 73, 74, 75]],
  },
} as const

export type Denticion = keyof typeof ARCADAS

export function esTemporal(pieza: number) {
  return Math.floor(pieza / 10) >= 5
}

export function esSuperior(pieza: number) {
  return [1, 2, 5, 6].includes(Math.floor(pieza / 10))
}

/** Zona del dibujo → cara anatómica (depende del cuadrante) */
export type Zona = "arriba" | "abajo" | "izquierda" | "derecha" | "centro"

export function caraDeZona(pieza: number, zona: Zona): Cara {
  const cuadrante = Math.floor(pieza / 10)
  const superior = [1, 2, 5, 6].includes(cuadrante)
  const ladoDerechoPaciente = [1, 4, 5, 8].includes(cuadrante) // se ve a la izquierda de la pantalla
  switch (zona) {
    case "arriba":
      return superior ? "V" : "L"
    case "abajo":
      return superior ? "L" : "V"
    case "izquierda":
      return ladoDerechoPaciente ? "D" : "M"
    case "derecha":
      return ladoDerechoPaciente ? "M" : "D"
    default:
      return "O"
  }
}

// ---------------------------------------------------------------------
// Tipos de hallazgo
// ---------------------------------------------------------------------
export type TipoHallazgo = "PREEXISTENCIA" | "LESION" | "AUSENTE"

export const PREEXISTENCIAS = {
  RESINA: { etiqueta: "Restauración de resina", abrev: "R", icono: "restauracion" },
  AMALGAMA: { etiqueta: "Restauración de amalgama", abrev: "AM", icono: "amalgama" },
  INCRUSTACION: { etiqueta: "Incrustación", abrev: "IN", icono: "incrustacion" },
  SELLANTE: { etiqueta: "Sellante", abrev: "S", icono: "sellante" },
  CORONA: { etiqueta: "Corona", abrev: "CO", icono: "corona" },
  CARILLA: { etiqueta: "Carilla", abrev: "CA", icono: "carilla" },
  ENDODONCIA: { etiqueta: "Endodoncia", abrev: "TC", icono: "endodoncia" },
  PERNO: { etiqueta: "Perno muñón", abrev: "PM", icono: "perno" },
  IMPLANTE: { etiqueta: "Implante", abrev: "IMP", icono: "implante" },
  PROTESIS_FIJA: { etiqueta: "Prótesis fija", abrev: "PF", icono: "fija" },
  PROTESIS_REMOVIBLE: { etiqueta: "Prótesis removible", abrev: "PR", icono: "removible" },
} as const

export const LESIONES = {
  CARIES: { etiqueta: "Caries", abrev: "C", icono: "caries" },
  FRACTURA: { etiqueta: "Fractura", abrev: "FX", icono: "fractura" },
  DESGASTE: { etiqueta: "Desgaste / abrasión", abrev: "DG", icono: "atricion" },
  RESTO_RADICULAR: { etiqueta: "Resto radicular", abrev: "RR", icono: "rr" },
  LESION_PERIAPICAL: { etiqueta: "Lesión periapical", abrev: "LP", icono: "infeccion" },
  ABSCESO: { etiqueta: "Absceso", abrev: "AB", icono: "infeccion" },
  MOVILIDAD: { etiqueta: "Movilidad", abrev: "MV", icono: "movilidad" },
  RETENIDO: { etiqueta: "Pieza retenida / incluida", abrev: "RT", icono: "retenido" },
  RESTAURACION_DEFECTUOSA: { etiqueta: "Restauración defectuosa", abrev: "RD", icono: "restauracion" },
} as const

export type CodigoPreexistencia = keyof typeof PREEXISTENCIAS
export type CodigoLesion = keyof typeof LESIONES

/** Ícono de un hallazgo (lesiones "defectuosas" se dibujan rayadas) */
export function iconoHallazgo(tipo: TipoHallazgo, codigo: string): { tipo: string; malEstado: boolean } {
  if (tipo === "AUSENTE") return { tipo: "extraccion", malEstado: false }
  const lista = (tipo === "LESION" ? LESIONES : PREEXISTENCIAS) as Record<string, { icono: string }>
  return { tipo: lista[codigo]?.icono ?? "default", malEstado: codigo === "RESTAURACION_DEFECTUOSA" }
}

export function etiquetaHallazgo(tipo: TipoHallazgo, codigo: string) {
  if (tipo === "AUSENTE") return "Ausente"
  const lista = (tipo === "LESION" ? LESIONES : PREEXISTENCIAS) as Record<string, { etiqueta: string; abrev: string }>
  return lista[codigo]?.etiqueta ?? codigo
}

export function abrevHallazgo(tipo: TipoHallazgo, codigo: string) {
  if (tipo === "AUSENTE") return "X"
  const lista = (tipo === "LESION" ? LESIONES : PREEXISTENCIAS) as Record<string, { etiqueta: string; abrev: string }>
  return lista[codigo]?.abrev ?? codigo.slice(0, 2)
}

// ---------------------------------------------------------------------
// Colores (leyenda)
// ---------------------------------------------------------------------
export const COLORES = {
  PREEXISTENCIA: "#2563eb", // azul
  LESION: "#dc2626", // rojo
  PENDIENTE: "#f59e0b", // naranjo: prestación por realizar
  REALIZADO: "#16a34a", // verde: prestación realizada
  AUSENTE: "#9ca3af",
} as const

// ---------------------------------------------------------------------
// Datos que vienen de la BD
// ---------------------------------------------------------------------
export type Hallazgo = {
  id: string
  paciente_id: string
  pieza: number
  tipo: TipoHallazgo
  codigo: string
  caras: Cara[]
  nota: string | null
  vigente: boolean
  created_at: string
  fecha_baja: string | null
  motivo_baja: string | null
  creador: { nombre_completo: string } | null
}

export type EstadoItem = "PENDIENTE" | "EN_PROCESO" | "REALIZADO" | "ANULADO"

export const ESTADO_ITEM_ETIQUETAS: Record<EstadoItem, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  REALIZADO: "Realizado",
  ANULADO: "Anulado",
}

export type ItemTratamiento = {
  id: string
  presupuesto_id: string
  prestacion_id: string
  pieza: number | null
  caras: Cara[]
  precio: number
  progreso: 0 | 25 | 50 | 75 | 100
  estado: EstadoItem
  monto_habilitado: number
  abonado: number
  nota: string | null
  created_at: string
  completado_en: string | null
  motivo_anulacion: string | null
  prestacion: { codigo_interno: string; nombre: string; icono: string | null } | null
  presupuesto: { numero: number; nombre: string; estado: string } | null
}

export type Avance = {
  id: string
  item_id: string
  progreso_anterior: number
  progreso_nuevo: number
  monto: number
  nota: string | null
  created_at: string
  profesional: { nombre_completo: string } | null
}

export const PASOS_AVANCE = [25, 50, 75, 100] as const

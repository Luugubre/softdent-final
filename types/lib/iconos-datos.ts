// =====================================================================
// Datos de los íconos del odontograma (sin "use client": se pueden
// usar tanto en el servidor como en el navegador)
// =====================================================================

export const ICONOS_PRESTACION = [
  { id: "restauracion", etiqueta: "Restauración (resina)" },
  { id: "incrustacion", etiqueta: "Incrustación" },
  { id: "sellante", etiqueta: "Sellante" },
  { id: "endodoncia", etiqueta: "Endodoncia" },
  { id: "perno", etiqueta: "Perno muñón" },
  { id: "corona", etiqueta: "Corona" },
  { id: "carilla", etiqueta: "Carilla" },
  { id: "implante", etiqueta: "Implante" },
  { id: "implante_corona", etiqueta: "Implante + corona" },
  { id: "fija", etiqueta: "Prótesis fija / puente" },
  { id: "removible", etiqueta: "Prótesis removible" },
  { id: "extraccion", etiqueta: "Extracción" },
  { id: "cirugia", etiqueta: "Cirugía / ext. compleja" },
  { id: "ortodoncia", etiqueta: "Ortodoncia" },
  { id: "limpieza", etiqueta: "Limpieza / profilaxis" },
  { id: "blanqueamiento", etiqueta: "Blanqueamiento" },
  { id: "rayos", etiqueta: "Radiografía" },
  { id: "otro", etiqueta: "Otro (estrella)" },
  { id: "default", etiqueta: "Genérico (círculo)" },
] as const

export type IconoPrestacion = (typeof ICONOS_PRESTACION)[number]["id"]

/** Íconos que se representan pintando caras (si la prestación/hallazgo tiene caras) */
export const ICONOS_DE_CARA = new Set(["restauracion", "amalgama", "caries", "sellante", "incrustacion"])

/** Adivina el ícono a partir del nombre de la prestación */
export function iconoPorNombre(nombre: string): string {
  const n = nombre.toLowerCase()
  const tiene = (...p: string[]) => p.some((x) => n.includes(x))
  if (tiene("implante") && tiene("corona")) return "implante_corona"
  if (tiene("implante")) return "implante"
  if (tiene("endodoncia", "conducto", "pulpotom", "pulpectom")) return "endodoncia"
  if (tiene("perno", "muñon", "muñón")) return "perno"
  if (tiene("carilla")) return "carilla"
  if (tiene("corona")) return "corona"
  if (tiene("incrustac", "onlay", "inlay")) return "incrustacion"
  if (tiene("puente", "fija")) return "fija"
  if (tiene("removible", "protesis", "prótesis", "placa")) return "removible"
  if (tiene("cirug", "compleja", "tercer molar", "cordal")) return "cirugia"
  if (tiene("extracc", "exodoncia")) return "extraccion"
  if (tiene("ortodon", "bracket", "brackets", "contenc")) return "ortodoncia"
  if (tiene("sellante")) return "sellante"
  if (tiene("limpieza", "destartraje", "profilaxis", "pulido")) return "limpieza"
  if (tiene("blanquea")) return "blanqueamiento"
  if (tiene("radiograf", "rx", "panoram", "scanner", "cbct")) return "rayos"
  if (tiene("resina", "restaurac", "obturac", "ionomero", "ionómero", "amalgama")) return "restauracion"
  return "default"
}

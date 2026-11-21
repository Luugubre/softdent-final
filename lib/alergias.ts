// Conflictos entre un medicamento y las alergias registradas, por nombre o por familia.

const FAMILIAS: { claves: string[]; farmacos: string[] }[] = [
  { claves: ["penicilin", "betalactam", "beta-lactam", "betalactámico"], farmacos: ["amoxicilina", "ampicilina", "penicilina", "cloxacilina", "flucloxacilina", "amoxicilina/acido clavulanico"] },
  { claves: ["cefalospor"], farmacos: ["cefalexina", "cefadroxilo", "cefuroxima", "ceftriaxona", "cefazolina"] },
  { claves: ["aine", "antiinflamatorio", "ácido acetilsalicílico", "acido acetilsalicilico", "aspirina"], farmacos: ["ibuprofeno", "ketorolaco", "diclofenaco", "naproxeno", "ketoprofeno", "aspirina", "acido acetilsalicilico", "metamizol", "nimesulida", "celecoxib"] },
  { claves: ["sulfa"], farmacos: ["sulfametoxazol", "cotrimoxazol"] },
  { claves: ["macrólido", "macrolido"], farmacos: ["azitromicina", "claritromicina", "eritromicina"] },
  { claves: ["lincosamida"], farmacos: ["clindamicina", "lincomicina"] },
  { claves: ["anestesia", "anestésico", "anestesico", "caína", "caina"], farmacos: ["lidocaina", "mepivacaina", "articaina", "bupivacaina", "prilocaina"] },
]

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/** Devuelve el texto de la alergia con que choca el medicamento, o null si no hay conflicto. */
export function alergiaEnConflicto(medicamento: string, alergias: string[]): string | null {
  const med = normalizar(medicamento)
  if (!med) return null
  for (const alergia of alergias) {
    const a = normalizar(alergia)
    if (!a) continue
    // Nombre directo: "alergia al ibuprofeno" / medicamento "Ibuprofeno 600"
    const nombreMed = med.split(/\s+/)[0]
    if (nombreMed.length >= 4 && a.includes(nombreMed)) return alergia
    // Familia: "alergia a la penicilina" con "amoxicilina"
    for (const familia of FAMILIAS) {
      const mencionaFamilia = familia.claves.some((c) => a.includes(normalizar(c)))
      const esDeLaFamilia = familia.farmacos.some((f) => med.includes(normalizar(f)))
      if (mencionaFamilia && esDeLaFamilia) return alergia
    }
  }
  return null
}

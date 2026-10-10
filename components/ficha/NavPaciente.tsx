"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type Item = { ruta: string; etiqueta: string; disponible: boolean; clinico?: boolean }

// Pestañas principales
const SECCIONES: Item[] = [
  { ruta: "", etiqueta: "Ficha", disponible: true },
  { ruta: "/datos", etiqueta: "Perfil", disponible: true },
  { ruta: "/tratamientos", etiqueta: "Tratamientos", disponible: true },
  { ruta: "/pagos", etiqueta: "Pagos", disponible: true },
  { ruta: "/odontograma", etiqueta: "Odontograma", disponible: true, clinico: true },
  { ruta: "/periodontograma", etiqueta: "Periodontograma", disponible: false, clinico: true },
]

// Sub-pestañas dentro de "Ficha"
const FICHA: Item[] = [
  { ruta: "", etiqueta: "Resumen", disponible: true },
  { ruta: "/evoluciones", etiqueta: "Evoluciones", disponible: true, clinico: true },
  { ruta: "/antecedentes", etiqueta: "Ant. Médicos", disponible: true, clinico: true },
  { ruta: "/rx-documentos", etiqueta: "RX y Multimedia", disponible: true, clinico: true },
  { ruta: "/recetas", etiqueta: "Recetario", disponible: false, clinico: true },
  { ruta: "/documentos", etiqueta: "Documentos", disponible: false },
  { ruta: "/consentimientos", etiqueta: "Consentimientos", disponible: false, clinico: true },
]

export function NavPaciente({ pacienteId, verClinico }: { pacienteId: string; verClinico: boolean }) {
  const pathname = usePathname()
  // Los roles sin acceso clínico no ven esas pestañas
  const secciones = SECCIONES.filter((s) => verClinico || !s.clinico)
  const ficha = FICHA.filter((f) => verClinico || !f.clinico)
  const base = `/pacientes/${pacienteId}`
  const subruta = pathname.slice(base.length) // "", "/evoluciones", "/datos"...

  const enFicha = FICHA.some((f) => f.ruta === subruta)

  return (
    <div className="space-y-3">
      {/* Pestañas principales */}
      <nav className="flex gap-1 overflow-x-auto bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
        {secciones.map((s) => {
          const activa = s.ruta === "" ? enFicha : subruta === s.ruta || subruta.startsWith(s.ruta + "/")
          if (!s.disponible) {
            return (
              <span
                key={s.ruta}
                title="Próximamente"
                className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap text-gray-300 cursor-not-allowed"
              >
                {s.etiqueta}
              </span>
            )
          }
          return (
            <Link
              key={s.ruta}
              href={`${base}${s.ruta}`}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                activa ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {s.etiqueta}
            </Link>
          )
        })}
      </nav>

      {/* Sub-pestañas de la ficha */}
      {enFicha && (
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {ficha.map((f) =>
            f.disponible ? (
              <Link
                key={f.ruta}
                href={`${base}${f.ruta}`}
                className={`px-3 py-2 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  subruta === f.ruta
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {f.etiqueta}
              </Link>
            ) : (
              <span
                key={f.ruta}
                title="Próximamente"
                className="px-3 py-2 text-sm font-bold whitespace-nowrap text-gray-300 cursor-not-allowed"
              >
                {f.etiqueta}
              </span>
            )
          )}
        </nav>
      )}
    </div>
  )
}

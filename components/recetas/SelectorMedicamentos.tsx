"use client"

import { useState } from "react"

export type MedicamentoCatalogo = {
  id: string
  nombre: string
  presentacion: string | null
  posologia_defecto: string | null
  via_defecto: string | null
}

type Props = {
  catalogo: MedicamentoCatalogo[]
  onSeleccionar: (item: { medicamento: string; presentacion: string; dosis: string; frecuencia: string; via: string }) => void
}

export function SelectorMedicamentos({ catalogo, onSeleccionar }: Props) {
  const [busqueda, setBusqueda] = useState("")
  const [mostrarDropdown, setMostrarDropdown] = useState(false)

  const filtrados = catalogo.filter((m) =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const handleSeleccion = (med: MedicamentoCatalogo) => {
    // Desglosar posología por defecto si existe (ej: "1 comprimido cada 8 horas")
    let dosis = "1 comprimido"
    let frecuencia = "Cada 8 horas"
    
    if (med.posologia_defecto) {
      const partes = med.posologia_defecto.split(" cada ")
      if (partes.length === 2) {
        dosis = partes[0].trim()
        frecuencia = `Cada ${partes[1].trim()}`
      }
    }

    onSeleccionar({
      medicamento: med.nombre,
      presentacion: med.presentacion ?? "",
      dosis,
      frecuencia,
      via: med.via_defecto ?? "Oral",
    })

    setBusqueda("")
    setMostrarDropdown(false)
  }

  return (
    <div className="relative">
      <label className="block text-xs font-bold text-gray-700 mb-1">Buscar Fármaco Frecuente</label>
      <input
        type="text"
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value)
          setMostrarDropdown(true)
        }}
        onFocus={() => setMostrarDropdown(true)}
        placeholder="Escribe Amoxicilina, Ibuprofeno..."
        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />

      {mostrarDropdown && busqueda.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {filtrados.length > 0 ? (
            filtrados.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSeleccion(item)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b last:border-0 border-gray-100 transition-colors"
              >
                <p className="text-sm font-bold text-gray-900">{item.nombre}</p>
                <p className="text-xs text-gray-500">{item.presentacion} · {item.posologia_defecto}</p>
              </button>
            ))
          ) : (
            <div className="p-3 text-xs text-gray-500 text-center">
              No se encontró en catálogo. Puedes agregarlo manualmente abajo.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
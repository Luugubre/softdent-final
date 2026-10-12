"use client"

import { CarasCirculo } from "@/components/odontograma/Diente"
import { CARA_ETIQUETAS, type Cara } from "@/types/odontograma"

export function SelectorCaras({
  pieza,
  valor,
  onChange,
  color = "#2563eb",
}: {
  pieza: number
  valor: Cara[]
  onChange: (caras: Cara[]) => void
  color?: string
}) {
  const colores = Object.fromEntries(valor.map((c) => [c, color])) as Partial<Record<Cara, string>>

  function alternar(cara: Cara) {
    onChange(valor.includes(cara) ? valor.filter((c) => c !== cara) : [...valor, cara])
  }

  return (
    <div className="flex items-center gap-4">
      <CarasCirculo pieza={pieza} colores={colores} size={110} conLetras onClickCara={alternar} />
      <div className="text-xs font-medium text-gray-600 space-y-0.5">
        <p className="font-bold text-gray-800">Caras seleccionadas</p>
        {valor.length === 0 ? (
          <p>Ninguna → aplica a la pieza completa</p>
        ) : (
          valor.map((c) => (
            <p key={c}>
              {c} · {CARA_ETIQUETAS[c]}
            </p>
          ))
        )}
        {valor.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="mt-1 font-bold text-blue-600 hover:underline">
            Limpiar
          </button>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { PrestacionForm } from "@/components/prestaciones/PrestacionForm"
import type { Arancel, ItemCatalogo } from "@/types/prestacion"

export function BotonNuevaPrestacion(props: {
  aranceles: Arancel[]
  categorias: ItemCatalogo[]
  especialidades: ItemCatalogo[]
  laboratorios: ItemCatalogo[]
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
      >
        ➕ Nueva prestación
      </button>
      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nueva prestación"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 md:p-10"
        >
          <button type="button" aria-label="Cerrar" onClick={() => setAbierto(false)} className="absolute inset-0 cursor-default" />
          <div className="relative w-full max-w-4xl">
            <PrestacionForm {...props} abiertoInicial onCerrar={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  )
}

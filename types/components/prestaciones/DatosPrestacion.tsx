"use client"

import { useState } from "react"
import { PrestacionForm } from "@/components/prestaciones/PrestacionForm"
import { formatearFechaHora } from "@/lib/formato"
import type { Arancel, ItemCatalogo, Prestacion } from "@/types/prestacion"
import { IconoMuestra } from "@/lib/iconos-dentales"
import { ICONOS_PRESTACION, iconoPorNombre } from "@/lib/iconos-datos"

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold text-gray-500 uppercase tracking-wide">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-900">{valor || "—"}</dd>
    </div>
  )
}

export function DatosPrestacion({
  prestacion: p,
  categoria,
  especialidad,
  puedeEditar,
  aranceles,
  categorias,
  especialidades,
}: {
  prestacion: Prestacion
  categoria?: string
  especialidad?: string
  puedeEditar: boolean
  aranceles: Arancel[]
  categorias: ItemCatalogo[]
  especialidades: ItemCatalogo[]
}) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <PrestacionForm
        prestacion={p}
        aranceles={aranceles}
        categorias={categorias}
        especialidades={especialidades}
        onCerrar={() => setEditando(false)}
      />
    )
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900">Datos</h2>
        {puedeEditar && (
          <button
            onClick={() => setEditando(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-sm"
          >
            Editar
          </button>
        )}
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Dato etiqueta="Código interno" valor={p.codigo_interno} />
        <Dato etiqueta="Código FONASA" valor={p.codigo_fonasa} />
        <Dato etiqueta="Categoría" valor={categoria} />
        <Dato etiqueta="Especialidad" valor={especialidad} />
        <Dato etiqueta="Duración" valor={`${p.duracion_min} minutos`} />
        <Dato etiqueta="Estado" valor={p.activo ? "Activa" : "Inactiva"} />
        <div>
          <dt className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ícono en odontograma</dt>
          <dd className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <IconoMuestra tipo={p.icono || iconoPorNombre(p.nombre)} color="#f59e0b" size={22} />
            {ICONOS_PRESTACION.find((i) => i.id === (p.icono || iconoPorNombre(p.nombre)))?.etiqueta}
            {!p.icono && <span className="text-xs text-gray-400">(automático)</span>}
          </dd>
        </div>
      </dl>
      <div>
        <dt className="text-xs font-bold text-gray-500 uppercase tracking-wide">Descripción</dt>
        <dd className="mt-0.5 text-sm font-medium text-gray-800 whitespace-pre-line">{p.descripcion || "—"}</dd>
      </div>
      <p className="text-xs font-medium text-gray-400">Última modificación {formatearFechaHora(p.updated_at)}</p>
    </section>
  )
}

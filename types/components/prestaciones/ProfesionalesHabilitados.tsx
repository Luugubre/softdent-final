"use client"

import { useState, useTransition } from "react"
import { guardarProfesionales } from "@/app/prestaciones/actions"

type Dentista = { id: string; nombre_completo: string; especialidad: string | null }

export function ProfesionalesHabilitados({
  prestacionId,
  dentistas,
  seleccionados,
  puedeEditar,
}: {
  prestacionId: string
  dentistas: Dentista[]
  seleccionados: string[]
  puedeEditar: boolean
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set(seleccionados))
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, startTransition] = useTransition()

  const cambiado =
    marcados.size !== seleccionados.length || seleccionados.some((id) => !marcados.has(id))

  function alternar(id: string) {
    setMensaje(null)
    setMarcados((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  function guardar() {
    startTransition(async () => {
      const res = await guardarProfesionales(prestacionId, [...marcados])
      setMensaje({ ok: res.ok, texto: res.mensaje })
    })
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">Profesionales habilitados</h2>
        <p className="text-xs font-medium text-gray-500">
          {marcados.size === 0
            ? "Ninguno marcado: todos los dentistas pueden realizar esta prestación."
            : `Solo ${marcados.size} dentista${marcados.size === 1 ? "" : "s"} pueden realizarla.`}
        </p>
      </div>

      {dentistas.length === 0 ? (
        <p className="text-sm font-medium text-gray-400">No hay dentistas activos. Créalos en Usuarios.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {dentistas.map((d) => (
            <li key={d.id}>
              <label className={`flex items-center gap-3 py-2 ${puedeEditar ? "cursor-pointer" : ""}`}>
                <input
                  type="checkbox"
                  checked={marcados.has(d.id)}
                  disabled={!puedeEditar || guardando}
                  onChange={() => alternar(d.id)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold text-gray-900">Dr.(a) {d.nombre_completo}</span>
                {d.especialidad && <span className="text-xs font-medium text-gray-500">{d.especialidad}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && (
        <div className="flex items-center justify-between gap-3">
          <p className={`text-sm font-semibold ${mensaje?.ok ? "text-emerald-700" : "text-rose-700"}`}>{mensaje?.texto}</p>
          <button
            onClick={guardar}
            disabled={!cambiado || guardando}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </section>
  )
}

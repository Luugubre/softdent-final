"use client"

import { useState, useTransition } from "react"
import { formatearPesos } from "@/lib/formato"
import { aplicarPackATratamiento } from "@/app/pacientes/[id]/tratamientos/actions"
import type { Fase } from "@/types/tratamiento"

export type PackDisponible = {
  id: string
  nombre: string
  descripcion: string | null
  total_estimado: number
  cantidad_items: number
  resumen: string
}

type Props = {
  pacienteId: string
  tratamientoId: string
  packs: PackDisponible[]
  fases: Fase[]
}

export function AplicarPackTratamiento({ pacienteId, tratamientoId, packs, fases }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [packId, setPackId] = useState(packs[0]?.id ?? "")
  const [faseId, setFaseId] = useState<string>("")
  const [feedback, setFeedback] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  if (packs.length === 0) return null

  const packSeleccionado = packs.find((p) => p.id === packId)

  const handleAplicar = () => {
    setFeedback(null)
    startTransition(async () => {
      const res = await aplicarPackATratamiento(pacienteId, tratamientoId, packId, faseId || null)
      setFeedback({ ok: res.ok, texto: res.mensaje })
      if (res.ok) {
        setTimeout(() => setAbierto(false), 1200)
      }
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setAbierto((v) => !v)
          setFeedback(null)
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 shadow-xs transition-colors"
      >
        <span>📦</span> Agregar pack de prestaciones
      </button>

      {abierto && (
        <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase text-indigo-900">
              Seleccionar Pack Comercial
            </p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-xs font-bold text-gray-500 hover:text-gray-800"
            >
              Cerrar ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className={fases.length > 0 ? "md:col-span-1" : "md:col-span-2"}>
              <label htmlFor="aplicarpacktratamien-pack-disponible" className="block text-[11px] font-bold text-gray-700 mb-1">Pack disponible</label>
              <select id="aplicarpacktratamien-pack-disponible"
                value={packId}
                onChange={(e) => setPackId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900"
              >
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.cantidad_items} prest. · {formatearPesos(p.total_estimado)})
                  </option>
                ))}
              </select>
            </div>

            {fases.length > 0 && (
              <div>
                <label htmlFor="aplicarpacktratamien-asignar-a-fase" className="block text-[11px] font-bold text-gray-700 mb-1">Asignar a fase (opcional)</label>
                <select id="aplicarpacktratamien-asignar-a-fase"
                  value={faseId}
                  onChange={(e) => setFaseId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800"
                >
                  <option value="">Sin fase específica</option>
                  {fases.map((f) => (
                    <option key={f.id} value={f.id}>
                      Fase {f.numero}: {f.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={handleAplicar}
                disabled={pendiente || !packId}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {pendiente ? "Agregando..." : "✓ Insertar prestaciones del pack"}
              </button>
            </div>
          </div>

          {packSeleccionado && (
            <p className="text-xs text-gray-600 bg-white rounded-xl border border-indigo-100 px-3 py-2">
              <strong>Incluye:</strong> {packSeleccionado.resumen}
            </p>
          )}

          {feedback && (
            <p className={`text-xs font-bold ${feedback.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {feedback.texto}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
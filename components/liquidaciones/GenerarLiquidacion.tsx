"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { generarLiquidacion } from "@/app/liquidaciones/actions"
import { formatearPesos } from "@/lib/formato"

export function GenerarLiquidacion({
  profesionalId,
  fechaCorte,
  hoy,
  total,
  cantidad,
  sinPorcentaje,
}: {
  profesionalId: string
  fechaCorte: string
  hoy: string
  total: number
  cantidad: number
  sinPorcentaje: boolean
}) {
  const router = useRouter()
  const [nota, setNota] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  function cambiarFecha(fecha: string) {
    if (fecha) router.replace(`/liquidaciones/profesional/${profesionalId}?hasta=${fecha}`)
  }

  function generar() {
    if (!window.confirm(`¿Generar la liquidación por ${formatearPesos(total)} (${cantidad} prestaciones)?`)) return
    setError(null)
    startTransition(async () => {
      const res = await generarLiquidacion(profesionalId, fechaCorte, nota)
      if (res.ok && res.id) router.push(`/liquidaciones/${res.id}`)
      else setError(res.mensaje)
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-end gap-3 flex-wrap">
      <label className="space-y-1">
        <span className="block text-xs font-black uppercase tracking-wider text-gray-500">Liquidar hasta</span>
        <input
          type="date"
          value={fechaCorte}
          max={hoy}
          onChange={(e) => cambiarFecha(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
      <label className="space-y-1 flex-1 min-w-48">
        <span className="block text-xs font-black uppercase tracking-wider text-gray-500">Nota (opcional)</span>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: Liquidación quincena 1 octubre"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
      <button
        disabled={pendiente || cantidad === 0 || sinPorcentaje}
        onClick={generar}
        className="px-5 py-2.5 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
      >
        {pendiente ? "Generando…" : `Generar liquidación ${cantidad > 0 ? formatearPesos(total) : ""}`}
      </button>
      {sinPorcentaje && (
        <p className="w-full text-xs font-semibold text-rose-700">Configura primero el % de liquidación del profesional.</p>
      )}
      {error && <p className="w-full text-sm font-semibold text-rose-700">{error}</p>}
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { actualizarPorcentaje } from "@/app/liquidaciones/actions"

export function PorcentajeProfesional({ profesionalId, porcentaje }: { profesionalId: string; porcentaje: number | null }) {
  const [valor, setValor] = useState(porcentaje === null ? "" : String(porcentaje))
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()
  const cambiado = valor.trim() !== (porcentaje === null ? "" : String(porcentaje))

  function guardar() {
    startTransition(async () => {
      const res = await actualizarPorcentaje(profesionalId, valor)
      setAviso({ ok: res.ok, texto: res.mensaje })
    })
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value)
              setAviso(null)
            }}
            placeholder="—"
            className="w-20 rounded-lg border border-gray-300 pl-2 pr-6 py-1 text-right text-sm font-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
        </div>
        {cambiado && (
          <button
            disabled={pendiente}
            onClick={guardar}
            className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            Guardar
          </button>
        )}
      </div>
      {aviso && <p className={`text-[11px] font-semibold ${aviso.ok ? "text-emerald-700" : "text-rose-700"}`}>{aviso.texto}</p>}
    </div>
  )
}

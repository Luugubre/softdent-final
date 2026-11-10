"use client"

import { useState } from "react"
import { anularReceta } from "@/app/recetas/actions"

export function BotonAnularReceta({ recetaId, folio }: { recetaId: string; folio: number }) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnular = async () => {
    if (motivo.trim().length < 5) {
      setError("Indica un motivo válido de anulación (mínimo 5 caracteres).")
      return
    }

    setCargando(true)
    setError(null)

    // anularReceta recibe solo el id de la receta (ver app/recetas/actions.ts)
    const res = await anularReceta(recetaId)

    setCargando(false)
    if (res.error) {
      setError(res.error)
    } else {
      setAbierto(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
      >
        🚫 Anular Folio #{folio}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-extrabold text-gray-900">Anular Receta Folio #{folio}</h3>
            <p className="text-xs text-gray-500">
              Las recetas emitidas no pueden editarse ni eliminarse. Se registrará la anulación y podrás emitir una nueva receta corregida.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Motivo de anulación *</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Error en posología, cambio de tratamiento..."
                rows={3}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={cargando}
                onClick={() => setAbierto(false)}
                className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                disabled={cargando}
                onClick={handleAnular}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {cargando ? "Anulando..." : "Confirmar Anulación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

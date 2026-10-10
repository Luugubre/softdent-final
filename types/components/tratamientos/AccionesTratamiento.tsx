"use client"

import { useState, useTransition } from "react"
import { anularTratamiento, finalizarTratamiento } from "@/app/pacientes/[id]/tratamientos/actions"

export function AccionesTratamiento({ pacienteId, tratamientoId }: { pacienteId: string; tratamientoId: string }) {
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje: string }>) {
    startTransition(async () => {
      const res = await accion()
      setMensaje({ ok: res.ok, texto: res.mensaje })
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          disabled={pendiente}
          onClick={() => {
            if (window.confirm("¿Finalizar el tratamiento? Ya no se podrán agregar prestaciones."))
              ejecutar(() => finalizarTratamiento(pacienteId, tratamientoId))
          }}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
        >
          Finalizar
        </button>
        <button
          disabled={pendiente}
          onClick={() => {
            const motivo = window.prompt("Motivo de la anulación del tratamiento:")
            if (motivo) ejecutar(() => anularTratamiento(pacienteId, tratamientoId, motivo))
          }}
          className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
        >
          Anular
        </button>
      </div>
      {mensaje && (
        <p className={`text-xs font-semibold max-w-xs text-right ${mensaje.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {mensaje.texto}
        </p>
      )}
    </div>
  )
}

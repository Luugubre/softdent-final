"use client"

import { useTransition } from "react"
import { cambiarEstadoPrestacion } from "@/app/prestaciones/actions"

export function BotonEstadoPrestacion({
  prestacionId,
  activo,
  puedeCambiar,
}: {
  prestacionId: string
  activo: boolean
  puedeCambiar: boolean
}) {
  const [cargando, startTransition] = useTransition()
  const estilo = activo ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"

  if (!puedeCambiar) {
    return <span className={`px-3 py-1 rounded-full text-xs font-bold ${estilo}`}>{activo ? "Activa" : "Inactiva"}</span>
  }

  return (
    <button
      disabled={cargando}
      onClick={() => {
        const texto = activo
          ? "¿Desactivar esta prestación? No se podrá usar en nuevos presupuestos, pero se conserva su historial."
          : "¿Activar esta prestación?"
        if (!window.confirm(texto)) return
        startTransition(async () => {
          const res = await cambiarEstadoPrestacion(prestacionId)
          if (!res.ok) alert(res.mensaje)
        })
      }}
      title={activo ? "Clic para desactivar" : "Clic para activar"}
      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors disabled:opacity-50 ${estilo} hover:opacity-80`}
    >
      {cargando ? "..." : activo ? "Activa" : "Inactiva"}
    </button>
  )
}

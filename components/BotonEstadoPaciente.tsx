"use client"

import { useTransition } from "react"
import { cambiarEstadoPaciente } from "@/app/pacientes/actions"

export function BotonEstadoPaciente({
  pacienteId,
  activo,
  puedeCambiar = true,
}: {
  pacienteId: string
  activo: boolean
  puedeCambiar?: boolean
}) {
  const [cargando, startTransition] = useTransition()

  // Sin permiso: solo se muestra el estado, sin poder cambiarlo
  if (!puedeCambiar) {
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-bold ${
          activo ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"
        }`}
      >
        {activo ? "Activo" : "Inactivo"}
      </span>
    )
  }

  function onClick() {
    let motivo: string | undefined
    if (activo) {
      const respuesta = window.prompt("Motivo para deshabilitar al paciente (opcional):")
      if (respuesta === null) return // canceló
      motivo = respuesta
    }
    startTransition(async () => {
      const res = await cambiarEstadoPaciente(pacienteId, motivo)
      if (!res.ok) alert(res.mensaje)
    })
  }

  return (
    <button
      onClick={onClick}
      disabled={cargando}
      title={activo ? "Clic para deshabilitar" : "Clic para habilitar"}
      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors disabled:opacity-50 ${
        activo
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
      }`}
    >
      {cargando ? "..." : activo ? "Activo" : "Inactivo"}
    </button>
  )
}

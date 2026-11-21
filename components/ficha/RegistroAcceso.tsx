"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { registrarAccesoFicha } from "@/app/pacientes/acceso-actions"

export function RegistroAcceso({ pacienteId }: { pacienteId: string }) {
  const pathname = usePathname()
  const subruta = pathname.slice(`/pacientes/${pacienteId}`.length)

  useEffect(() => {
    registrarAccesoFicha(pacienteId, subruta).catch(() => {})
  }, [pacienteId, subruta])

  return null
}

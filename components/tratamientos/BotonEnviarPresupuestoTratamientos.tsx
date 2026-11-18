"use client"

import { useState } from "react"
import { ModalEnviarPresupuestoWA } from "@/components/presupuestos/ModalEnviarPresupuestoWA"

type Props = {
  pacienteId: string
  pacienteNombre: string
  pacienteTelefono?: string | null
}

export function BotonEnviarPresupuestoTratamientos({
  pacienteId,
  pacienteNombre,
  pacienteTelefono,
}: Props) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 shadow-2xs transition-all"
      >
        <span>💬</span> Enviar Presupuesto por WhatsApp
      </button>

      {abierto && (
        <ModalEnviarPresupuestoWA
          pacienteId={pacienteId}
          pacienteNombre={pacienteNombre}
          pacienteTelefono={pacienteTelefono}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  )
}
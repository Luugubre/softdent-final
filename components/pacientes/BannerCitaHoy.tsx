"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cambiarEstadoCita } from "@/app/agenda/actions"
import { ESTADO_CITA, siguientesEstados, type EstadoCita } from "@/types/cita"

export type CitaHoyPaciente = {
  id: string
  hora_inicio: string
  estado: EstadoCita
  motivo: string | null
  box_nombre: string | null
  profesional_nombre: string
}

export function BannerCitaHoy({ cita }: { cita: CitaHoyPaciente }) {
  const router = useRouter()
  const [estadoActual, setEstadoActual] = useState<EstadoCita>(cita.estado)
  const [cargando, setCargando] = useState<EstadoCita | null>(null)

  const estilo = ESTADO_CITA[estadoActual]
  const opciones = siguientesEstados(estadoActual)

  async function cambiar(nuevo: EstadoCita) {
    setCargando(nuevo)
    const res = await cambiarEstadoCita(cita.id, nuevo)
    setCargando(null)

    if (res.ok) {
      setEstadoActual(nuevo)
      router.refresh()
    } else {
      alert(res.mensaje)
    }
  }

  return (
    <div className={`rounded-2xl border-2 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm ${estilo.tarjeta}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${estilo.pill}`}>
          <span>{estilo.icono}</span>
          <span>{estilo.etiqueta}</span>
        </span>

        <div className="text-xs font-bold">
          <span className="font-black">Cita de hoy · {cita.hora_inicio}</span>
          {cita.box_nombre ? ` · 🚪 ${cita.box_nombre}` : ""}
          {cita.motivo ? ` · ${cita.motivo}` : ""}
          <span className="opacity-75"> · {cita.profesional_nombre}</span>
        </div>
      </div>

      {opciones.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider opacity-70">
            Cambiar estado:
          </span>
          {opciones.map((dest) => {
            const estDest = ESTADO_CITA[dest]
            return (
              <button
                key={dest}
                type="button"
                disabled={cargando !== null}
                onClick={() => cambiar(dest)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-black transition hover:opacity-90 disabled:opacity-50 ${estDest.pill}`}
              >
                {cargando === dest ? "Guardando..." : `${estDest.icono} ${estDest.etiqueta}`}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
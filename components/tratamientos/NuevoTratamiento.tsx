"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { crearTratamiento } from "@/app/pacientes/[id]/tratamientos/actions"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-xs font-bold text-gray-700 mb-1"

export function NuevoTratamiento({
  pacienteId,
  siguienteNumero,
  profesionales,
  aranceles,
  arancelSugerido,
  profesionalSugerido,
}: {
  pacienteId: string
  siguienteNumero: number
  profesionales: { id: string; nombre_completo: string }[]
  aranceles: { id: string; nombre: string }[]
  arancelSugerido: string | null
  profesionalSugerido: string | null
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = await crearTratamiento(pacienteId, formData)
      if (res.ok && res.id) router.push(`/pacientes/${pacienteId}/tratamientos/${res.id}`)
      else setError(res.mensaje)
    })
  }

  if (!abierto) {
    return (
      <button
        onClick={() => {
          setError(null)
          setAbierto(true)
        }}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm"
      >
        + Nuevo tratamiento
      </button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900">Nuevo tratamiento · N° {siguienteNumero}</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm font-bold text-gray-500 hover:text-gray-800">
          Cerrar ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="nombre" className={labelClass}>Nombre <span className="text-rose-600">*</span></label>
          <input
            id="nombre"
            name="nombre"
            defaultValue={`Tratamiento ${siguienteNumero}`}
            placeholder="Ej: Rehabilitación, Ortodoncia, Urgencia"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="profesional_id" className={labelClass}>Profesional tratante</label>
          <select id="profesional_id" name="profesional_id" defaultValue={profesionalSugerido ?? ""} className={inputClass}>
            <option value="">— Sin asignar —</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>Dr.(a) {p.nombre_completo}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="arancel_id" className={labelClass}>Arancel (lista de precios)</label>
          <select id="arancel_id" name="arancel_id" defaultValue={arancelSugerido ?? ""} className={inputClass}>
            {aranceles.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="descripcion" className={labelClass}>Descripción</label>
        <textarea id="descripcion" name="descripcion" rows={2} placeholder="Opcional" className={inputClass} />
      </div>

      {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={() => setAbierto(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm"
        >
          {guardando ? "Creando..." : "Crear y abrir"}
        </button>
      </div>
    </form>
  )
}

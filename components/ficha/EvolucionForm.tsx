"use client"

import { useRef, useState, useTransition } from "react"
import { crearEvolucion } from "@/app/pacientes/[id]/actions"
import { hoyChile } from "@/lib/formato"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-xs font-bold text-gray-700 mb-1"

export function EvolucionForm({ pacienteId, profesionalNombre }: { pacienteId: string; profesionalNombre: string }) {
  const [abierto, setAbierto] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string; errores?: Record<string, string> } | null>(null)
  const [guardando, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const err = resultado?.errores

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = await crearEvolucion(pacienteId, formData)
      setResultado(res)
      if (res.ok) {
        formRef.current?.reset()
        setAbierto(false)
      }
    })
  }

  if (!abierto) {
    return (
      <div className="space-y-3">
        {resultado?.ok && (
          <p className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
            {resultado.mensaje}
          </p>
        )}
        <button
          onClick={() => {
            setResultado(null)
            setAbierto(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm"
        >
          + Nueva evolución
        </button>
      </div>
    )
  }

  const MensajeError = ({ campo }: { campo: string }) =>
    err?.[campo] ? <p className="mt-1 text-xs font-semibold text-rose-600">{err[campo]}</p> : null

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900">Nueva evolución</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm font-bold text-gray-500 hover:text-gray-800">
          Cerrar ✕
        </button>
      </div>

      {resultado && !resultado.ok && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">
          {resultado.mensaje}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fecha_atencion" className={labelClass}>
            Fecha de atención <span className="text-rose-600">*</span>
          </label>
          <input
            id="fecha_atencion"
            name="fecha_atencion"
            type="date"
            defaultValue={hoyChile()}
            max={hoyChile()}
            className={inputClass}
          />
          <MensajeError campo="fecha_atencion" />
        </div>
        <div>
          <p className={labelClass}>Profesional</p>
          <p className="px-3 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-sm font-bold text-gray-800">
            Dr.(a) {profesionalNombre}
          </p>
        </div>
        <div>
          <label htmlFor="motivo" className={labelClass}>Motivo de atención</label>
          <input id="motivo" name="motivo" placeholder="Ej: Control, urgencia, consulta" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="diagnostico" className={labelClass}>Diagnóstico</label>
        <textarea id="diagnostico" name="diagnostico" rows={2} className={inputClass} />
      </div>

      <div>
        <label htmlFor="procedimiento" className={labelClass}>
          Procedimiento realizado <span className="text-rose-600">*</span>
        </label>
        <textarea
          id="procedimiento"
          name="procedimiento"
          rows={3}
          placeholder="Ej: Restauración con resina pieza 1.6 cara oclusal"
          className={inputClass}
        />
        <MensajeError campo="procedimiento" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="observaciones" className={labelClass}>Observaciones</label>
          <textarea id="observaciones" name="observaciones" rows={2} className={inputClass} />
        </div>
        <div>
          <label htmlFor="indicaciones" className={labelClass}>Indicaciones al paciente</label>
          <textarea id="indicaciones" name="indicaciones" rows={2} className={inputClass} />
        </div>
      </div>

      <p className="text-xs font-medium text-gray-500">
        Una vez guardada, la evolución no se puede editar ni eliminar. Si hay un error, registra una nueva evolución como
        corrección.
      </p>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm"
        >
          {guardando ? "Guardando..." : "Guardar evolución"}
        </button>
      </div>
    </form>
  )
}

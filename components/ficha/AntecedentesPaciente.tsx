"use client"

import { useRef, useState, useTransition } from "react"
import { agregarAntecedente, darDeBajaAntecedente } from "@/app/pacientes/[id]/actions"
import { formatearFechaHora } from "@/lib/formato"
import { CATEGORIAS_ANTECEDENTE, CATEGORIA_ETIQUETAS, type Antecedente } from "@/types/antecedente"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"

export function AntecedentesPaciente({
  pacienteId,
  antecedentes,
  puedeRegistrar = true,
}: {
  pacienteId: string
  antecedentes: Antecedente[]
  puedeRegistrar?: boolean
}) {
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const vigentes = antecedentes.filter((a) => a.vigente)
  const historial = antecedentes.filter((a) => !a.vigente)

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = await agregarAntecedente(pacienteId, formData)
      setMensaje({ ok: res.ok, texto: res.mensaje })
      if (res.ok) formRef.current?.reset()
    })
  }

  function onDarDeBaja(a: Antecedente) {
    const motivo = window.prompt(`Motivo para dar de baja "${a.contenido}":`)
    if (motivo === null) return
    startTransition(async () => {
      const res = await darDeBajaAntecedente(a.id, pacienteId, motivo)
      setMensaje({ ok: res.ok, texto: res.mensaje })
    })
  }

  return (
    <div className="space-y-6">
      {puedeRegistrar && (
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4"
      >
        <h2 className="text-xl font-extrabold text-gray-900">Registrar antecedente</h2>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-3 items-start">
          <select name="categoria" defaultValue="" className={inputClass} required>
            <option value="" disabled>
              Categoría...
            </option>
            {CATEGORIAS_ANTECEDENTE.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_ETIQUETAS[c]}
              </option>
            ))}
          </select>
          <textarea
            name="contenido"
            rows={2}
            placeholder="Ej: Alergia a la penicilina · Hipertensión controlada · Losartán 50 mg"
            className={inputClass}
            required
          />
          <button
            type="submit"
            disabled={pendiente}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm"
          >
            {pendiente ? "Guardando..." : "Agregar"}
          </button>
        </div>
        {mensaje && (
          <p className={`text-sm font-semibold ${mensaje.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {mensaje.texto}
          </p>
        )}
      </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIAS_ANTECEDENTE.map((cat) => {
          const items = vigentes.filter((a) => a.categoria === cat)
          const esAlergia = cat === "ALERGIA"
          return (
            <section
              key={cat}
              className={`bg-white border rounded-2xl shadow-sm p-5 space-y-3 ${
                esAlergia && items.length > 0 ? "border-rose-300" : "border-gray-200"
              }`}
            >
              <h3
                className={`text-sm font-black uppercase tracking-wider ${
                  esAlergia && items.length > 0 ? "text-rose-700" : "text-blue-700"
                }`}
              >
                {CATEGORIA_ETIQUETAS[cat]}
              </h3>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 font-medium">Sin registros</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {items.map((a) => (
                    <li key={a.id} className="py-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 whitespace-pre-line">{a.contenido}</p>
                        <p className="text-xs text-gray-400 font-medium">{formatearFechaHora(a.fecha_registro)}</p>
                      </div>
                      {puedeRegistrar && (
                      <button
                        onClick={() => onDarDeBaja(a)}
                        disabled={pendiente}
                        className="text-xs font-bold text-gray-500 hover:text-rose-600 whitespace-nowrap"
                      >
                        Dar de baja
                      </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {historial.length > 0 && (
        <details className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <summary className="cursor-pointer text-sm font-bold text-gray-700">
            Historial de antecedentes dados de baja ({historial.length})
          </summary>
          <ul className="mt-3 divide-y divide-gray-100">
            {historial.map((a) => (
              <li key={a.id} className="py-2">
                <p className="text-sm font-semibold text-gray-500 line-through">
                  [{CATEGORIA_ETIQUETAS[a.categoria]}] {a.contenido}
                </p>
                <p className="text-xs text-gray-400 font-medium">
                  Registrado {formatearFechaHora(a.fecha_registro)} · Baja {formatearFechaHora(a.fecha_baja)}
                  {a.motivo_baja && ` · Motivo: ${a.motivo_baja}`}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

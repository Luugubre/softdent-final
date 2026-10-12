"use client"

import { useState, useTransition } from "react"
import { crearFase, editarFase, eliminarFase, moverFase } from "@/app/pacientes/[id]/tratamientos/actions"
import { formatearPesos } from "@/lib/formato"
import type { ItemTratamiento } from "@/types/odontograma"
import type { Fase } from "@/types/tratamiento"

const campo = "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"

export function FasesTratamiento({
  pacienteId,
  tratamientoId,
  fases,
  items,
  puedeEditar,
}: {
  pacienteId: string
  tratamientoId: string
  fases: Fase[]
  items: ItemTratamiento[]
  puedeEditar: boolean
}) {
  const [nueva, setNueva] = useState({ nombre: "", descripcion: "" })
  const [editando, setEditando] = useState<{ id: string; nombre: string; descripcion: string } | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  const activos = items.filter((i) => i.estado !== "ANULADO")
  const resumen = (faseId: string | null) => {
    const propios = activos.filter((i) => (i.fase_id ?? null) === faseId)
    return { cantidad: propios.length, total: propios.reduce((s, i) => s + i.precio, 0) }
  }
  const sinFase = resumen(null)

  function ejecutar(fn: () => Promise<{ ok: boolean; mensaje: string }>, alTerminar?: () => void) {
    startTransition(async () => {
      try {
        const r = await fn()
        setAviso({ ok: r.ok, texto: r.mensaje })
        if (r.ok) alTerminar?.()
      } catch {
        setAviso({ ok: false, texto: "No se pudo conectar con el servidor." })
      }
    })
  }

  const sugerencia = `Fase ${fases.length + 1}`

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">🧩 Fases del presupuesto</h2>
        <p className="text-xs font-semibold text-gray-500">
          Divide el tratamiento en etapas (ej. Fase 1: Higiene, Fase 2: Operatoria, Fase 3: Rehabilitación). Luego asigna cada prestación a su
          fase en la tabla de abajo. El presupuesto impreso muestra las prestaciones agrupadas por fase con su subtotal.
        </p>
      </div>

      {aviso && (
        <p className={`rounded-xl border px-3 py-2 text-sm font-semibold ${aviso.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {aviso.texto}
        </p>
      )}

      {fases.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-gray-400">
          Este tratamiento aún no tiene fases: todas sus prestaciones se muestran juntas.
        </p>
      ) : (
        <ol className={`space-y-2 ${pendiente ? "opacity-60" : ""}`}>
          {fases.map((f, i) => {
            const r = resumen(f.id)
            return (
              <li key={f.id} className="rounded-xl border border-gray-200 p-3">
                {editando?.id === f.id ? (
                  <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_auto]">
                    <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className={campo} />
                    <input
                      value={editando.descripcion}
                      onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                      placeholder="Descripción (opcional)"
                      className={campo}
                    />
                    <div className="flex gap-1">
                      <button
                        disabled={pendiente || editando.nombre.trim().length < 2}
                        onClick={() => ejecutar(() => editarFase(pacienteId, f.id, editando.nombre, editando.descripcion), () => setEditando(null))}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                      >
                        Guardar
                      </button>
                      <button onClick={() => setEditando(null)} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-black text-white">{f.numero}</span>
                      <div className="min-w-0">
                        <p className="font-extrabold text-gray-900">{f.nombre}</p>
                        {f.descripcion && <p className="text-xs text-gray-500">{f.descripcion}</p>}
                        <p className="text-[11px] font-bold text-gray-400">
                          {r.cantidad} {r.cantidad === 1 ? "prestación" : "prestaciones"} · {formatearPesos(r.total)}
                        </p>
                      </div>
                    </div>
                    {puedeEditar && (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={pendiente || i === 0}
                          onClick={() => ejecutar(() => moverFase(pacienteId, f.id, -1))}
                          title="Subir"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-black text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          disabled={pendiente || i === fases.length - 1}
                          onClick={() => ejecutar(() => moverFase(pacienteId, f.id, 1))}
                          title="Bajar"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-black text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => setEditando({ id: f.id, nombre: f.nombre, descripcion: f.descripcion ?? "" })}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        >
                          Editar
                        </button>
                        <button
                          disabled={pendiente}
                          onClick={() => {
                            const texto =
                              r.cantidad > 0
                                ? `¿Eliminar la fase "${f.nombre}"? Sus ${r.cantidad} prestaciones quedarán "sin fase" (no se borran).`
                                : `¿Eliminar la fase "${f.nombre}"?`
                            if (window.confirm(texto)) ejecutar(() => eliminarFase(pacienteId, f.id))
                          }}
                          className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
          {sinFase.cantidad > 0 && (
            <li className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              ⚠️ {sinFase.cantidad} {sinFase.cantidad === 1 ? "prestación" : "prestaciones"} sin fase ({formatearPesos(sinFase.total)}). Asígnalas en la columna
              “Fase” de la tabla.
            </li>
          )}
        </ol>
      )}

      {puedeEditar && (
        <div className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-[1fr_1.5fr_auto]">
          <input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder={`Nombre (ej: ${sugerencia}: Higiene)`} className={campo} />
          <input
            value={nueva.descripcion}
            onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })}
            placeholder="Descripción (opcional)"
            className={campo}
          />
          <button
            disabled={pendiente || nueva.nombre.trim().length < 2}
            onClick={() => ejecutar(() => crearFase(pacienteId, tratamientoId, nueva.nombre, nueva.descripcion), () => setNueva({ nombre: "", descripcion: "" }))}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-40"
          >
            + Agregar fase
          </button>
        </div>
      )}
    </section>
  )
}

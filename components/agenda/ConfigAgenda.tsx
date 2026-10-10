"use client"

import { useState, useTransition } from "react"
import { agregarHorario, cambiarEstadoBox, crearBox, eliminarBloqueo, eliminarHorario } from "@/app/agenda/actions"
import { formatearFechaHora } from "@/lib/formato"
import { DIAS_SEMANA, TIPO_BLOQUEO, type BloqueoAgenda, type Box, type HorarioAtencion, type ProfesionalAgenda } from "@/types/cita"

type Ejecutar = (accion: () => Promise<{ ok: boolean; mensaje: string }>) => void

function useAccion() {
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()
  const ejecutar: Ejecutar = (accion) =>
    startTransition(async () => {
      const r = await accion()
      setAviso({ ok: r.ok, texto: r.mensaje })
    })
  const Aviso = () =>
    aviso ? <p className={`text-sm font-semibold ${aviso.ok ? "text-emerald-700" : "text-rose-700"}`}>{aviso.texto}</p> : null
  return { ejecutar, pendiente, Aviso }
}

const corta = (h: string) => h.slice(0, 5)

export function ConfigHorarios({ profesionales, horarios }: { profesionales: ProfesionalAgenda[]; horarios: HorarioAtencion[] }) {
  const [profesionalId, setProfesionalId] = useState(profesionales[0]?.id ?? "")
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5])
  const [inicio, setInicio] = useState("09:00")
  const [fin, setFin] = useState("13:00")
  const { ejecutar, pendiente, Aviso } = useAccion()

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">🕘 Horarios de atención</h2>
        <p className="text-xs font-medium text-gray-500">
          Fuera de estos horarios no se puede agendar (salvo sobrecupo). Si un dentista no tiene horario, se asume lunes a sábado de 09:00 a
          19:00. Para jornada partida agrega dos tramos (ej. 09:00–13:00 y 15:00–19:00).
        </p>
      </div>

      <div className="flex items-end gap-2 flex-wrap rounded-xl bg-gray-50 border border-gray-200 p-3">
        <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-bold">
          {profesionales.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre_completo}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {DIAS_SEMANA.map((d, i) => {
            const n = i + 1
            const activo = dias.includes(n)
            return (
              <button
                key={d}
                onClick={() => setDias(activo ? dias.filter((x) => x !== n) : [...dias, n])}
                className={`w-9 py-1.5 rounded-lg text-xs font-black border ${activo ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-600"}`}
              >
                {d.slice(0, 2)}
              </button>
            )
          })}
        </div>
        <input type="time" step={900} value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-bold" />
        <span className="text-sm font-bold text-gray-400">a</span>
        <input type="time" step={900} value={fin} onChange={(e) => setFin(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-bold" />
        <button
          disabled={pendiente || !profesionalId}
          onClick={() => ejecutar(() => agregarHorario(profesionalId, dias, inicio, fin))}
          className="px-4 py-1.5 rounded-lg text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
      <Aviso />

      <div className="grid gap-3 md:grid-cols-2">
        {profesionales.map((p) => {
          const propios = horarios.filter((h) => h.profesional_id === p.id)
          return (
            <div key={p.id} className="rounded-xl border border-gray-200 p-3">
              <p className="font-extrabold text-gray-900">{p.nombre_completo}</p>
              {propios.length === 0 ? (
                <p className="text-xs font-semibold text-gray-400">Sin horario (se usa lunes a sábado 09:00–19:00)</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {DIAS_SEMANA.map((d, i) => {
                    const tramos = propios.filter((h) => h.dia_semana === i + 1)
                    if (!tramos.length) return null
                    return (
                      <li key={d} className="flex items-center gap-2 text-sm">
                        <span className="w-20 font-bold text-gray-600">{d}</span>
                        <span className="flex flex-wrap gap-1">
                          {tramos.map((h) => (
                            <span key={h.id} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800">
                              {corta(h.hora_inicio)}–{corta(h.hora_fin)}
                              <button
                                disabled={pendiente}
                                onClick={() => ejecutar(() => eliminarHorario(h.id))}
                                className="text-blue-400 hover:text-rose-600"
                                title="Quitar"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function ConfigBoxes({ boxes }: { boxes: Box[] }) {
  const [nombre, setNombre] = useState("")
  const { ejecutar, pendiente, Aviso } = useAccion()

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
      <h2 className="text-lg font-extrabold text-gray-900">🚪 Boxes de atención</h2>
      <div className="flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Box 3"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold"
        />
        <button
          disabled={pendiente || !nombre.trim()}
          onClick={() => {
            ejecutar(() => crearBox(nombre))
            setNombre("")
          }}
          className="px-4 py-1.5 rounded-lg text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          Crear
        </button>
      </div>
      <Aviso />
      <ul className="divide-y divide-gray-100">
        {boxes.map((b) => (
          <li key={b.id} className="flex items-center justify-between py-2">
            <span className={`font-bold ${b.activo ? "text-gray-900" : "text-gray-400 line-through"}`}>{b.nombre}</span>
            <button
              disabled={pendiente}
              onClick={() => ejecutar(() => cambiarEstadoBox(b.id, !b.activo))}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${b.activo ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"}`}
            >
              {b.activo ? "Desactivar" : "Activar"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ListaBloqueos({ bloqueos, puedeEliminar }: { bloqueos: BloqueoAgenda[]; puedeEliminar: boolean }) {
  const { ejecutar, pendiente, Aviso } = useAccion()
  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
      <h2 className="text-lg font-extrabold text-gray-900">🚫 Bloqueos vigentes y próximos</h2>
      <Aviso />
      {bloqueos.length === 0 ? (
        <p className="text-sm font-semibold text-gray-400">No hay bloqueos. Se crean desde la agenda con el botón “Bloquear”.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {bloqueos.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="font-bold text-gray-900">
                  {TIPO_BLOQUEO[b.tipo]} · {b.motivo}
                </p>
                <p className="text-xs font-semibold text-gray-500">
                  {formatearFechaHora(b.inicio)} → {formatearFechaHora(b.fin)} ·{" "}
                  {b.profesional?.nombre_completo ?? (b.box ? b.box.nombre : "Toda la clínica")}
                </p>
              </div>
              {puedeEliminar && (
                <button
                  disabled={pendiente}
                  onClick={() => window.confirm("¿Quitar este bloqueo?") && ejecutar(() => eliminarBloqueo(b.id))}
                  className="px-3 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

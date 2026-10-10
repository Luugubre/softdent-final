"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { agendarCita, buscarPacientes, horasDisponibles, reagendarCita } from "@/app/agenda/actions"
import { Modal } from "@/components/odontograma/Modales"
import { fechaTitulo } from "@/lib/fechas-agenda"
import type { Box, CitaAgenda, PacienteBusqueda, PrestacionAgenda, ProfesionalAgenda } from "@/types/cita"

const DURACIONES = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240]

const etiqueta = "block text-xs font-black uppercase tracking-wider text-gray-500 mb-1"
const campo =
  "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"

export type InicialCita = { profesionalId?: string; fecha: string; hora?: string }

export function ModalCita({
  modo,
  cita,
  inicial,
  pacienteInicial,
  profesionales,
  boxes,
  prestaciones,
  puedeSobrecupo,
  hoy,
  onClose,
  onListo,
}: {
  modo: "nueva" | "reagendar"
  cita?: CitaAgenda
  inicial: InicialCita
  pacienteInicial?: PacienteBusqueda | null
  profesionales: ProfesionalAgenda[]
  boxes: Box[]
  prestaciones: PrestacionAgenda[]
  puedeSobrecupo: boolean
  hoy: string
  onClose: () => void
  onListo: (mensaje: string) => void
}) {
  const reagendar = modo === "reagendar" && !!cita

  // Paciente
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(
    reagendar
      ? { id: cita.paciente_id, nombres: cita.paciente_nombre, apellidos: "", rut: cita.paciente_rut, telefono: cita.paciente_telefono }
      : pacienteInicial ?? null
  )
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<PacienteBusqueda[]>([])

  // Datos de la cita
  const [profesionalId, setProfesionalId] = useState(inicial.profesionalId ?? cita?.profesional_id ?? profesionales[0]?.id ?? "")
  const [prestacion, setPrestacion] = useState<PrestacionAgenda | null>(
    cita?.prestacion_id ? prestaciones.find((p) => p.id === cita?.prestacion_id) ?? null : null
  )
  const [filtroPrestacion, setFiltroPrestacion] = useState("")
  const [boxId, setBoxId] = useState(cita?.box_id ?? "")
  const [fecha, setFecha] = useState(inicial.fecha)
  const [duracion, setDuracion] = useState(cita?.duracion_min ?? 30)
  const [hora, setHora] = useState(inicial.hora ?? "")
  const [motivo, setMotivo] = useState("")
  const [sobrecupo, setSobrecupo] = useState(false)
  const [motivoSobrecupo, setMotivoSobrecupo] = useState("")

  const [libres, setLibres] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  // Buscar pacientes mientras se escribe
  useEffect(() => {
    if (paciente || busqueda.trim().length < 2) {
      setResultados([])
      return
    }
    let vigente = true
    const t = setTimeout(async () => {
      const r = await buscarPacientes(busqueda)
      if (vigente) setResultados(r)
    }, 250)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [busqueda, paciente])

  // Horas libres del profesional ese día
  useEffect(() => {
    if (!profesionalId || !fecha) return
    let vigente = true
    setLibres(null)
    horasDisponibles(profesionalId, fecha, duracion, boxId || null, reagendar ? cita?.id ?? null : null).then((h) => {
      if (vigente) setLibres(h)
    })
    return () => {
      vigente = false
    }
  }, [profesionalId, fecha, duracion, boxId, reagendar, cita?.id])

  const sugeridas = useMemo(() => {
    const q = filtroPrestacion.trim().toLowerCase()
    if (q.length < 2) return []
    return prestaciones
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.codigo_interno.toLowerCase().includes(q))
      .slice(0, 8)
  }, [filtroPrestacion, prestaciones])

  const duraciones = DURACIONES.includes(duracion) ? DURACIONES : [...DURACIONES, duracion].sort((a, b) => a - b)
  const horaLibre = !!hora && !!libres?.includes(hora)

  function elegirPrestacion(p: PrestacionAgenda) {
    setPrestacion(p)
    setFiltroPrestacion("")
    const d = Math.max(5, Math.round(p.duracion_min / 5) * 5)
    setDuracion(d)
  }

  function guardar() {
    setError(null)
    if (!paciente) return setError("Selecciona un paciente.")
    if (!hora) return setError("Selecciona una hora.")
    startTransition(async () => {
      const comun = {
        profesionalId,
        fecha,
        hora,
        duracion,
        boxId: boxId || null,
        motivo,
        sobrecupo,
        motivoSobrecupo,
      }
      const res = reagendar
        ? await reagendarCita(cita!.id, comun)
        : await agendarCita({ ...comun, pacienteId: paciente.id, prestacionId: prestacion?.id ?? null })
      if (res.ok) onListo(res.mensaje)
      else setError(res.mensaje)
    })
  }

  return (
    <Modal titulo={reagendar ? `Reagendar cita N° ${cita.numero}` : "Nueva cita"} onClose={onClose}>
      {/* PACIENTE */}
      <div>
        <span className={etiqueta}>Paciente</span>
        {paciente ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
            <div>
              <p className="font-extrabold text-gray-900">
                {paciente.nombres} {paciente.apellidos}
              </p>
              <p className="text-xs font-semibold text-gray-500">
                {paciente.rut}
                {paciente.telefono ? ` · ${paciente.telefono}` : ""}
              </p>
            </div>
            {!reagendar && (
              <button onClick={() => setPaciente(null)} className="text-xs font-bold text-blue-700 hover:underline">
                Cambiar
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, apellido o RUT…"
              className={campo}
            />
            {resultados.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setPaciente(p)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                    >
                      <span className="font-bold text-gray-900">
                        {p.nombres} {p.apellidos}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">{p.rut}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {busqueda.trim().length >= 2 && resultados.length === 0 && (
              <p className="mt-1 text-xs font-semibold text-gray-400">Sin resultados (solo pacientes habilitados).</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label>
          <span className={etiqueta}>Profesional</span>
          <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} className={campo}>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_completo}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={etiqueta}>Box</span>
          <select value={boxId} onChange={(e) => setBoxId(e.target.value)} className={campo}>
            <option value="">Sin box asignado</option>
            {boxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* PRESTACIÓN */}
      {!reagendar && (
        <div>
          <span className={etiqueta}>Prestación (opcional)</span>
          {prestacion ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <span className="font-bold text-gray-900">
                {prestacion.nombre} <span className="text-xs text-gray-500">· {prestacion.duracion_min} min</span>
              </span>
              <button onClick={() => setPrestacion(null)} className="text-xs font-bold text-gray-500 hover:text-rose-600">
                Quitar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={filtroPrestacion}
                onChange={(e) => setFiltroPrestacion(e.target.value)}
                placeholder="Ej: limpieza, endodoncia, DL-0012…"
                className={campo}
              />
              {sugeridas.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {sugeridas.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => elegirPrestacion(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                      >
                        <span className="font-semibold text-gray-900">{p.nombre}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {p.codigo_interno} · {p.duracion_min} min
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={etiqueta}>Fecha</span>
          <input type="date" value={fecha} min={hoy} onChange={(e) => e.target.value && setFecha(e.target.value)} className={campo} />
        </label>
        <label>
          <span className={etiqueta}>Duración</span>
          <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className={campo}>
            {duraciones.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* HORAS LIBRES */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={etiqueta}>Horas disponibles · {fechaTitulo(fecha, { weekday: "long", day: "numeric", month: "short" })}</span>
          <input
            type="time"
            step={300}
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-bold"
            title="Hora manual"
          />
        </div>
        {libres === null ? (
          <p className="text-xs font-semibold text-gray-400">Buscando horas…</p>
        ) : libres.length === 0 ? (
          <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No hay horas libres ese día para esta duración. Prueba otro día{puedeSobrecupo ? " o usa sobrecupo" : ""}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {libres.map((h) => (
              <button
                key={h}
                onClick={() => setHora(h)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  hora === h ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        )}
        {hora && libres && !horaLibre && !sobrecupo && (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            Las {hora} no aparece como hora libre (ocupada, bloqueada o fuera de horario).
            {puedeSobrecupo ? " Marca sobrecupo si quieres agendar igual." : ""}
          </p>
        )}
      </div>

      {puedeSobrecupo && (
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <input type="checkbox" checked={sobrecupo} onChange={(e) => setSobrecupo(e.target.checked)} />
            Sobrecupo (permite agendar sobre otra cita o fuera del horario)
          </label>
          {sobrecupo && (
            <input
              value={motivoSobrecupo}
              onChange={(e) => setMotivoSobrecupo(e.target.value)}
              placeholder="Motivo del sobrecupo (obligatorio). Ej: urgencia por dolor"
              className={campo}
            />
          )}
        </div>
      )}

      <label className="block">
        <span className={etiqueta}>{reagendar ? "Motivo del cambio" : "Motivo de consulta / notas"}</span>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={reagendar ? "Ej: paciente pidió cambiar el día" : "Ej: control, dolor molar…"}
          className={campo}
        />
      </label>

      {error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200">
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={pendiente || !paciente || !hora || (sobrecupo && !motivoSobrecupo.trim())}
          className="px-5 py-2 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
        >
          {pendiente ? "Guardando…" : reagendar ? `Reagendar a las ${hora || "—"}` : `Agendar ${hora ? `a las ${hora}` : ""}`}
        </button>
      </div>
    </Modal>
  )
}

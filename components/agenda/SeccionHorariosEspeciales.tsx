"use client"

import { useState, useEffect, useTransition } from "react"
import {
  listarHorariosEspeciales,
  guardarHorariosEspecialesLote,
  eliminarHorarioEspecial,
  type HorarioEspecial,
  type EntradaDiaEspecial,
} from "@/app/agenda/horarios-especiales/actions"

type Props = {
  profesionales: { id: string; nombre_completo: string }[]
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"]

function sumarSemanasISO(fechaISO: string, semanas: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + semanas * 7))
  return dt.toISOString().slice(0, 10)
}

function formatearFechaCorta(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function SeccionHorariosEspeciales({ profesionales }: Props) {
  const hoyISO = new Date().toISOString().slice(0, 10)
  const [anioMes, setAnioMes] = useState(() => {
    const [y, m] = hoyISO.split("-").map(Number)
    return { anio: y, mes: m - 1 }
  })

  const [lista, setLista] = useState<HorarioEspecial[]>([])
  const [profesionalId, setProfesionalId] = useState(profesionales[0]?.id ?? "")
  const [modo, setModo] = useState<"CALENDARIO" | "RECURRENCIA">("CALENDARIO")

  const [bloqueadoDefecto, setBloqueadoDefecto] = useState(false)
  const [horaInicioDef, setHoraInicioDef] = useState("09:00")
  const [horaFinDef, setHoraFinDef] = useState("14:00")
  const [motivo, setMotivo] = useState("")

  const [fechaInicioRec, setFechaInicioRec] = useState(hoyISO)
  const [cadaNSemanas, setCadaNSemanas] = useState(2)
  const [fechaHastaRec, setFechaHastaRec] = useState(() => sumarSemanasISO(hoyISO, 8))

  const [entradas, setEntradas] = useState<EntradaDiaEspecial[]>([])
  const [mensajeOk, setMensajeOk] = useState<string | null>(null)
  const [alertaCitas, setAlertaCitas] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  useEffect(() => {
    listarHorariosEspeciales(hoyISO).then(setLista)
  }, [hoyISO])

  const toggleFechaCalendario = (fechaISO: string) => {
    setEntradas((prev) => {
      const existe = prev.some((e) => e.fecha === fechaISO)
      if (existe) return prev.filter((e) => e.fecha !== fechaISO)
      return [
        ...prev,
        {
          fecha: fechaISO,
          bloqueado: bloqueadoDefecto,
          hora_inicio: bloqueadoDefecto ? null : horaInicioDef,
          hora_fin: bloqueadoDefecto ? null : horaFinDef,
        },
      ].sort((a, b) => a.fecha.localeCompare(b.fecha))
    })
  }

  const generarRecurrencia = () => {
    setError(null)
    if (!fechaInicioRec || !fechaHastaRec) return setError("Completa las fechas de inicio y término.")
    if (fechaInicioRec > fechaHastaRec) return setError("La fecha de inicio no puede ser posterior a la fecha límite.")

    const nuevas: EntradaDiaEspecial[] = []
    let actual = fechaInicioRec

    while (actual <= fechaHastaRec && nuevas.length < 60) {
      nuevas.push({
        fecha: actual,
        bloqueado: bloqueadoDefecto,
        hora_inicio: bloqueadoDefecto ? null : horaInicioDef,
        hora_fin: bloqueadoDefecto ? null : horaFinDef,
      })
      actual = sumarSemanasISO(actual, cadaNSemanas)
    }

    setEntradas(nuevas)
  }

  const actualizarEntrada = (fecha: string, cambios: Partial<EntradaDiaEspecial>) => {
    setEntradas((prev) =>
      prev.map((e) => {
        if (e.fecha !== fecha) return e
        const actualizado = { ...e, ...cambios }
        if (!actualizado.bloqueado) {
          actualizado.hora_inicio = actualizado.hora_inicio || horaInicioDef
          actualizado.hora_fin = actualizado.hora_fin || horaFinDef
        } else {
          actualizado.hora_inicio = null
          actualizado.hora_fin = null
        }
        return actualizado
      })
    )
  }

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMensajeOk(null)
    setAlertaCitas(0)

    if (!profesionalId) return setError("Selecciona un profesional.")
    if (entradas.length === 0) return setError("Selecciona al menos una fecha.")

    startTransition(async () => {
      const res = await guardarHorariosEspecialesLote({
        profesional_id: profesionalId,
        motivo,
        entradas,
      })

      if (res.error) {
        setError(res.error)
      } else {
        setEntradas([])
        setMotivo("")
        setMensajeOk(`Se configuraron ${res.creados} fecha(s) correctamente (reemplaza el horario semanal en esos días).`)
        setAlertaCitas(res.citasAfectadas ?? 0)
        const actualizada = await listarHorariosEspeciales(hoyISO)
        setLista(actualizada)
      }
    })
  }

  const handleEliminar = (id: string) => {
    startTransition(async () => {
      await eliminarHorarioEspecial(id)
      setLista((prev) => prev.filter((item) => item.id !== id))
    })
  }

  const primerDiaMes = new Date(Date.UTC(anioMes.anio, anioMes.mes, 1))
  const diaSemanaInicio = (primerDiaMes.getUTCDay() + 6) % 7
  const diasEnMes = new Date(Date.UTC(anioMes.anio, anioMes.mes + 1, 0)).getUTCDate()

  const celdasCalendario: (string | null)[] = [
    ...Array(diaSemanaInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => {
      const dia = String(i + 1).padStart(2, "0")
      const mes = String(anioMes.mes + 1).padStart(2, "0")
      return `${anioMes.anio}-${mes}-${dia}`
    }),
  ]

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-lg font-extrabold text-gray-900">📅 Horarios Especiales y Bloqueos</h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          Configura jornadas distintas en días puntuales o cada N semanas. Para esa fecha{" "}
          <strong className="text-gray-700">reemplaza el horario semanal</strong> del dentista; un día sin atención bloquea la jornada.
        </p>
      </div>

      <form onSubmit={handleGuardar} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-700 mb-1">Dentista</label>
            <select
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2 text-xs font-semibold bg-white"
            >
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  Dr(a). {p.nombre_completo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">Modalidad por defecto</label>
            <select
              value={bloqueadoDefecto ? "BLOQUEADO" : "ESPECIAL"}
              onChange={(e) => setBloqueadoDefecto(e.target.value === "BLOQUEADO")}
              className="w-full rounded-xl border border-gray-300 p-2 text-xs font-semibold bg-white"
            >
              <option value="ESPECIAL">🕒 Horario especial</option>
              <option value="BLOQUEADO">🚫 Día bloqueado (sin atención)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">Motivo / Nota</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Turno sábado, Congreso, Feriado..."
              className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
            />
          </div>

          {!bloqueadoDefecto && (
            <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-200/80">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Hora inicio base</label>
                <input
                  type="time"
                  value={horaInicioDef}
                  onChange={(e) => setHoraInicioDef(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-1.5 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Hora fin base</label>
                <input
                  type="time"
                  value={horaFinDef}
                  onChange={(e) => setHoraFinDef(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-1.5 text-xs bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModo("CALENDARIO")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-colors ${
              modo === "CALENDARIO"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            🗓️ Marcar días en calendario
          </button>
          <button
            type="button"
            onClick={() => setModo("RECURRENCIA")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-colors ${
              modo === "RECURRENCIA"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            🔁 Repetir cada N semanas
          </button>
        </div>

        {modo === "CALENDARIO" ? (
          <div className="rounded-xl border border-gray-200 p-4 max-w-md bg-white">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() =>
                  setAnioMes((prev) =>
                    prev.mes === 0 ? { anio: prev.anio - 1, mes: 11 } : { anio: prev.anio, mes: prev.mes - 1 }
                  )
                }
                className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold hover:bg-gray-50"
              >
                ←
              </button>
              <span className="text-xs font-black uppercase text-gray-800">
                {MESES[anioMes.mes]} {anioMes.anio}
              </span>
              <button
                type="button"
                onClick={() =>
                  setAnioMes((prev) =>
                    prev.mes === 11 ? { anio: prev.anio + 1, mes: 0 } : { anio: prev.anio, mes: prev.mes + 1 }
                  )
                }
                className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-bold hover:bg-gray-50"
              >
                →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-gray-400 mb-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {celdasCalendario.map((fechaISO, idx) => {
                if (!fechaISO) return <div key={`empty-${idx}`} />
                const seleccionada = entradas.find((e) => e.fecha === fechaISO)
                const diaNum = Number(fechaISO.slice(8, 10))
                return (
                  <button
                    key={fechaISO}
                    type="button"
                    onClick={() => toggleFechaCalendario(fechaISO)}
                    className={`h-8 rounded-lg text-xs font-bold transition-colors ${
                      seleccionada
                        ? seleccionada.bloqueado
                          ? "bg-rose-600 text-white"
                          : "bg-blue-600 text-white"
                        : "hover:bg-blue-50 text-gray-700 border border-gray-100"
                    }`}
                  >
                    {diaNum}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-blue-50/40 p-4 rounded-xl border border-blue-100">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Fecha inicial</label>
              <input
                type="date"
                value={fechaInicioRec}
                onChange={(e) => setFechaInicioRec(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Frecuencia (semanas)</label>
              <select
                value={cadaNSemanas}
                onChange={(e) => setCadaNSemanas(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white font-semibold"
              >
                <option value={1}>Cada 1 semana</option>
                <option value={2}>Cada 2 semanas (quincenal)</option>
                <option value={3}>Cada 3 semanas</option>
                <option value={4}>Cada 4 semanas</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Repetir hasta</label>
              <input
                type="date"
                value={fechaHastaRec}
                onChange={(e) => setFechaHastaRec(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
              />
            </div>
            <button
              type="button"
              onClick={generarRecurrencia}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
            >
              Generar fechas
            </button>
          </div>
        )}

        {entradas.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-gray-800">
                Fechas seleccionadas ({entradas.length}) — personaliza el horario de cada día:
              </p>
              <button
                type="button"
                onClick={() => setEntradas([])}
                className="text-[11px] font-bold text-gray-400 hover:text-rose-600"
              >
                Limpiar selección
              </button>
            </div>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
              {entradas.map((ent) => (
                <div key={ent.fecha} className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
                  <span className="font-bold text-gray-900 capitalize min-w-[140px]">
                    {formatearFechaCorta(ent.fecha)}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={ent.bloqueado ? "BLOQUEADO" : "ESPECIAL"}
                      onChange={(e) => actualizarEntrada(ent.fecha, { bloqueado: e.target.value === "BLOQUEADO" })}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold bg-white"
                    >
                      <option value="ESPECIAL">Horario especial</option>
                      <option value="BLOQUEADO">Día bloqueado</option>
                    </select>

                    {!ent.bloqueado && (
                      <>
                        <input
                          type="time"
                          value={ent.hora_inicio || "09:00"}
                          onChange={(e) => actualizarEntrada(ent.fecha, { hora_inicio: e.target.value })}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        />
                        <span className="text-gray-400">a</span>
                        <input
                          type="time"
                          value={ent.hora_fin || "14:00"}
                          onChange={(e) => actualizarEntrada(ent.fecha, { hora_fin: e.target.value })}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        />
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setEntradas((prev) => prev.filter((x) => x.fecha !== ent.fecha))}
                      className="text-rose-600 font-bold hover:underline ml-2"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

        {mensajeOk && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 space-y-1">
            <p>✅ {mensajeOk}</p>
            {alertaCitas > 0 && (
              <p className="text-amber-800">
                ⚠️ Atención: {alertaCitas} cita(s) agendada(s) quedaron fuera de horario y deben reprogramarse.
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pendiente || entradas.length === 0}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
        >
          {pendiente ? "Guardando..." : `Guardar (${entradas.length} fecha/s)`}
        </button>
      </form>

      <div className="space-y-2 pt-3 border-t border-gray-100">
        <p className="text-[11px] font-black uppercase text-gray-500">
          Próximos horarios especiales y bloqueos configurados
        </p>
        {lista.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No hay excepciones futuras registradas.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden text-xs">
            {lista.map((item) => {
              const esBloqueado = !item.hora_inicio || !item.hora_fin
              return (
                <li key={item.id} className="flex items-center justify-between p-3 bg-white hover:bg-gray-50">
                  <div>
                    <p className="font-bold text-gray-900 capitalize">
                      {formatearFechaCorta(item.fecha)} · Dr(a). {item.profesional?.nombre_completo ?? "Profesional"}
                    </p>
                    <p className="text-gray-600 mt-0.5">
                      {esBloqueado
                        ? "🚫 Día bloqueado (sin atención)"
                        : `🕒 Horario especial: ${item.hora_inicio?.slice(0, 5)} a ${item.hora_fin?.slice(0, 5)}`}
                      {item.motivo ? ` — ${item.motivo}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEliminar(item.id)}
                    disabled={pendiente}
                    className="text-rose-600 hover:underline font-bold disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
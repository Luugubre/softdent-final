"use client"

import { useState, useEffect, useMemo, useTransition } from "react"
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

  // Estado del formulario de creación/edición
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

  // Estado del Visor de horarios especiales y bloqueos
  const [visorModo, setVisorModo] = useState<"LISTA" | "CALENDARIO">("LISTA")
  const [visorProfesional, setVisorProfesional] = useState("TODOS")
  const [visorTipo, setVisorTipo] = useState<"TODOS" | "ESPECIAL" | "BLOQUEADO">("TODOS")
  const [visorBusqueda, setVisorBusqueda] = useState("")
  const [visorMes, setVisorMes] = useState(() => {
    const [y, m] = hoyISO.split("-").map(Number)
    return { anio: y, mes: m - 1 }
  })
  const [fechaInspeccion, setFechaInspeccion] = useState<string | null>(hoyISO)

  useEffect(() => {
    listarHorariosEspeciales().then(setLista).catch(console.error)
  }, [])

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
        const actualizada = await listarHorariosEspeciales()
        setLista(actualizada)
      }
    })
  }

  const handleEditarDesdeVisor = (item: HorarioEspecial) => {
    const esBloqueado = !item.hora_inicio || !item.hora_fin
    setProfesionalId(item.profesional_id)
    setMotivo(item.motivo ?? "")
    setModo("CALENDARIO")
    const [y, m] = item.fecha.split("-").map(Number)
    setAnioMes({ anio: y, mes: m - 1 })
    setEntradas([
      {
        fecha: item.fecha,
        bloqueado: esBloqueado,
        hora_inicio: esBloqueado ? null : item.hora_inicio?.slice(0, 5) ?? "09:00",
        hora_fin: esBloqueado ? null : item.hora_fin?.slice(0, 5) ?? "14:00",
      },
    ])
    setMensajeOk(null)
    setError(null)
  }

  const handleEliminar = (id: string) => {
    startTransition(async () => {
      await eliminarHorarioEspecial(id)
      setLista((prev) => prev.filter((item) => item.id !== id))
    })
  }

  // Filtrado del Visor
  const listaFiltradaVisor = useMemo(() => {
    return lista.filter((item) => {
      const esBloqueado = !item.hora_inicio || !item.hora_fin
      if (visorProfesional !== "TODOS" && item.profesional_id !== visorProfesional) return false
      if (visorTipo === "BLOQUEADO" && !esBloqueado) return false
      if (visorTipo === "ESPECIAL" && esBloqueado) return false
      if (visorBusqueda.trim()) {
        const q = visorBusqueda.toLowerCase()
        const coincide =
          (item.motivo?.toLowerCase().includes(q) ?? false) ||
          (item.profesional?.nombre_completo.toLowerCase().includes(q) ?? false) ||
          item.fecha.includes(q)
        if (!coincide) return false
      }
      return true
    })
  }, [lista, visorProfesional, visorTipo, visorBusqueda])

  const resumenVisor = useMemo(() => {
    const futuros = listaFiltradaVisor.filter((i) => i.fecha >= hoyISO)
    const bloqueados = futuros.filter((i) => !i.hora_inicio || !i.hora_fin).length
    const especiales = futuros.length - bloqueados
    return { total: futuros.length, especiales, bloqueados }
  }, [listaFiltradaVisor, hoyISO])

  // Grilla calendario formulario
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

  // Grilla calendario del Visor
  const primerDiaVisor = new Date(Date.UTC(visorMes.anio, visorMes.mes, 1))
  const diaInicioVisor = (primerDiaVisor.getUTCDay() + 6) % 7
  const diasEnMesVisor = new Date(Date.UTC(visorMes.anio, visorMes.mes + 1, 0)).getUTCDate()
  const celdasVisor: (string | null)[] = [
    ...Array(diaInicioVisor).fill(null),
    ...Array.from({ length: diasEnMesVisor }, (_, i) => {
      const dia = String(i + 1).padStart(2, "0")
      const mes = String(visorMes.mes + 1).padStart(2, "0")
      return `${visorMes.anio}-${mes}-${dia}`
    }),
  ]

  const eventosDiaInspeccion = useMemo(() => {
    if (!fechaInspeccion) return []
    return listaFiltradaVisor.filter((i) => i.fecha === fechaInspeccion)
  }, [listaFiltradaVisor, fechaInspeccion])

  return (
    <div className="space-y-6">
      {/* BLOQUE 1: Formulario de configuración */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="border-b border-gray-100 pb-4">
          <h2 className="text-lg font-extrabold text-gray-900">📅 Configurar Horarios Especiales y Bloqueos</h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Configura jornadas distintas en días puntuales o cada N semanas. Para esa fecha{" "}
            <strong className="text-gray-700">reemplaza el horario semanal</strong> del dentista; un día sin atención bloquea la jornada.
          </p>
        </div>

        <form onSubmit={handleGuardar} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="md:col-span-2">
              <label htmlFor="seccionhorariosespec-dentista" className="block text-[11px] font-bold text-gray-700 mb-1">Dentista</label>
              <select id="seccionhorariosespec-dentista"
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
              <label htmlFor="seccionhorariosespec-modalidad-por-defecto" className="block text-[11px] font-bold text-gray-700 mb-1">Modalidad por defecto</label>
              <select id="seccionhorariosespec-modalidad-por-defecto"
                value={bloqueadoDefecto ? "BLOQUEADO" : "ESPECIAL"}
                onChange={(e) => setBloqueadoDefecto(e.target.value === "BLOQUEADO")}
                className="w-full rounded-xl border border-gray-300 p-2 text-xs font-semibold bg-white"
              >
                <option value="ESPECIAL">🕒 Horario especial</option>
                <option value="BLOQUEADO">🚫 Día bloqueado (sin atención)</option>
              </select>
            </div>

            <div>
              <label htmlFor="seccionhorariosespec-motivo-nota" className="block text-[11px] font-bold text-gray-700 mb-1">Motivo / Nota</label>
              <input id="seccionhorariosespec-motivo-nota"
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
                  <label htmlFor="seccionhorariosespec-hora-inicio-base" className="block text-[10px] font-bold text-gray-500 uppercase">Hora inicio base</label>
                  <input id="seccionhorariosespec-hora-inicio-base"
                    type="time"
                    value={horaInicioDef}
                    onChange={(e) => setHoraInicioDef(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="seccionhorariosespec-hora-fin-base" className="block text-[10px] font-bold text-gray-500 uppercase">Hora fin base</label>
                  <input id="seccionhorariosespec-hora-fin-base"
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
                <label htmlFor="seccionhorariosespec-fecha-inicial" className="block text-[11px] font-bold text-gray-700 mb-1">Fecha inicial</label>
                <input id="seccionhorariosespec-fecha-inicial"
                  type="date"
                  value={fechaInicioRec}
                  onChange={(e) => setFechaInicioRec(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
                />
              </div>
              <div>
                <label htmlFor="seccionhorariosespec-frecuencia-semanas" className="block text-[11px] font-bold text-gray-700 mb-1">Frecuencia (semanas)</label>
                <select id="seccionhorariosespec-frecuencia-semanas"
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
                <label htmlFor="seccionhorariosespec-repetir-hasta" className="block text-[11px] font-bold text-gray-700 mb-1">Repetir hasta</label>
                <input id="seccionhorariosespec-repetir-hasta"
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
      </section>

      {/* BLOQUE 2: VISOR DE HORARIOS ESPECIALES Y BLOQUEOS */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">👁️ Visor de Horarios Especiales y Bloqueos</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Consulta, filtra o edita las excepciones de horario y días sin atención registrados por dentista.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setVisorModo("LISTA")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                visorModo === "LISTA" ? "bg-white text-blue-700 shadow-2xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📋 Vista Lista
            </button>
            <button
              type="button"
              onClick={() => setVisorModo("CALENDARIO")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                visorModo === "CALENDARIO" ? "bg-white text-blue-700 shadow-2xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              🗓️ Vista Calendario
            </button>
          </div>
        </div>

        {/* Mini KPIs del Visor */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
            <p className="text-[10px] font-black uppercase text-gray-400">Vigentes (hoy en adelante)</p>
            <p className="text-xl font-black text-gray-900 mt-0.5">{resumenVisor.total}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
            <p className="text-[10px] font-black uppercase text-blue-700">Horarios especiales</p>
            <p className="text-xl font-black text-blue-700 mt-0.5">{resumenVisor.especiales}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
            <p className="text-[10px] font-black uppercase text-rose-700">Días bloqueados</p>
            <p className="text-xl font-black text-rose-700 mt-0.5">{resumenVisor.bloqueados}</p>
          </div>
        </div>

        {/* Barra de Filtros del Visor */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
          <div>
            <label htmlFor="seccionhorariosespec-filtrar-por-dentista" className="block text-[10px] font-black uppercase text-gray-400 mb-1">Filtrar por dentista</label>
            <select id="seccionhorariosespec-filtrar-por-dentista"
              value={visorProfesional}
              onChange={(e) => setVisorProfesional(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold bg-white"
            >
              <option value="TODOS">Todos los dentistas</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  Dr(a). {p.nombre_completo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="seccionhorariosespec-tipo-de-excepcion" className="block text-[10px] font-black uppercase text-gray-400 mb-1">Tipo de excepción</label>
            <select id="seccionhorariosespec-tipo-de-excepcion"
              value={visorTipo}
              onChange={(e) => setVisorTipo(e.target.value as "TODOS" | "ESPECIAL" | "BLOQUEADO")}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold bg-white"
            >
              <option value="TODOS">Todos (Especiales y Bloqueos)</option>
              <option value="ESPECIAL">🕒 Solo horarios especiales</option>
              <option value="BLOQUEADO">🚫 Solo días bloqueados</option>
            </select>
          </div>

          <div>
            <label htmlFor="seccionhorariosespec-buscar-motivo-o" className="block text-[10px] font-black uppercase text-gray-400 mb-1">Buscar motivo o fecha</label>
            <input id="seccionhorariosespec-buscar-motivo-o"
              type="text"
              value={visorBusqueda}
              onChange={(e) => setVisorBusqueda(e.target.value)}
              placeholder="Ej: Congreso, sábado, 2026-11..."
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white"
            />
          </div>
        </div>

        {/* Contenido del Visor: Lista vs Calendario */}
        {visorModo === "LISTA" ? (
          listaFiltradaVisor.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-xs font-semibold text-gray-400">
              No se encontraron horarios especiales ni bloqueos con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Dentista</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Tramo Horario</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listaFiltradaVisor.map((item) => {
                    const esBloqueado = !item.hora_inicio || !item.hora_fin
                    const esPasado = item.fecha < hoyISO
                    return (
                      <tr key={item.id} className={esPasado ? "bg-gray-50/60 opacity-65" : "hover:bg-gray-50"}>
                        <td className="px-4 py-3 font-bold text-gray-900 capitalize whitespace-nowrap">
                          {formatearFechaCorta(item.fecha)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          Dr(a). {item.profesional?.nombre_completo ?? "Profesional"}
                        </td>
                        <td className="px-4 py-3">
                          {esBloqueado ? (
                            <span className="inline-block rounded-full border border-rose-200 bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-800">
                              🚫 Día bloqueado
                            </span>
                          ) : (
                            <span className="inline-block rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-800">
                              🕒 Horario especial
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                          {esBloqueado
                            ? "Sin atención"
                            : `${item.hora_inicio?.slice(0, 5)} a ${item.hora_fin?.slice(0, 5)}`}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.motivo || "—"}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                          <button
                            type="button"
                            onClick={() => handleEditarDesdeVisor(item)}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminar(item.id)}
                            disabled={pendiente}
                            className="text-rose-600 hover:underline font-bold disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Vista Calendario Mensual del Visor */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-xl border border-gray-200 p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() =>
                    setVisorMes((prev) =>
                      prev.mes === 0 ? { anio: prev.anio - 1, mes: 11 } : { anio: prev.anio, mes: prev.mes - 1 }
                    )
                  }
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold hover:bg-gray-50"
                >
                  ← Anterior
                </button>
                <span className="text-xs font-black uppercase text-gray-800">
                  {MESES[visorMes.mes]} {visorMes.anio}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setVisorMes((prev) =>
                      prev.mes === 11 ? { anio: prev.anio + 1, mes: 0 } : { anio: prev.anio, mes: prev.mes + 1 }
                    )
                  }
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold hover:bg-gray-50"
                >
                  Siguiente →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-black text-gray-400 mb-1.5">
                {DIAS_SEMANA.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {celdasVisor.map((fechaISO, idx) => {
                  if (!fechaISO) return <div key={`v-empty-${idx}`} />
                  const eventosDia = listaFiltradaVisor.filter((i) => i.fecha === fechaISO)
                  const tieneBloqueo = eventosDia.some((e) => !e.hora_inicio || !e.hora_fin)
                  const tieneEspecial = eventosDia.some((e) => e.hora_inicio && e.hora_fin)
                  const seleccionado = fechaInspeccion === fechaISO
                  const diaNum = Number(fechaISO.slice(8, 10))

                  return (
                    <button
                      key={fechaISO}
                      type="button"
                      onClick={() => setFechaInspeccion(fechaISO)}
                      className={`h-14 rounded-xl border p-1.5 flex flex-col justify-between text-left transition-all ${
                        seleccionado
                          ? "border-blue-600 ring-2 ring-blue-200 bg-blue-50/40"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`text-xs font-extrabold ${
                          fechaISO === hoyISO ? "text-blue-600 underline" : "text-gray-800"
                        }`}
                      >
                        {diaNum}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {tieneEspecial && (
                          <span className="h-2 w-2 rounded-full bg-blue-600" title="Horario especial" />
                        )}
                        {tieneBloqueo && (
                          <span className="h-2 w-2 rounded-full bg-rose-600" title="Día bloqueado" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-[11px] font-semibold text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Horario especial
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Día bloqueado (sin atención)
                </span>
              </div>
            </div>

            {/* Panel lateral del día seleccionado */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-black uppercase text-gray-700 capitalize">
                {fechaInspeccion ? formatearFechaCorta(fechaInspeccion) : "Selecciona un día"}
              </p>

              {eventosDiaInspeccion.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Sin horarios especiales ni bloqueos para esta fecha (aplica el horario semanal normal).
                </p>
              ) : (
                <div className="space-y-2.5">
                  {eventosDiaInspeccion.map((ev) => {
                    const esBloqueado = !ev.hora_inicio || !ev.hora_fin
                    return (
                      <div key={ev.id} className="rounded-xl border border-gray-200 bg-white p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-900">
                            Dr(a). {ev.profesional?.nombre_completo ?? "Profesional"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              esBloqueado ? "bg-rose-100 text-rose-800" : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {esBloqueado ? "Bloqueado" : "Especial"}
                          </span>
                        </div>
                        <p className="font-mono text-gray-700">
                          {esBloqueado
                            ? "🚫 Día sin atención"
                            : `🕒 ${ev.hora_inicio?.slice(0, 5)} a ${ev.hora_fin?.slice(0, 5)}`}
                        </p>
                        {ev.motivo && <p className="text-gray-500">{ev.motivo}</p>}
                        <div className="flex gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => handleEditarDesdeVisor(ev)}
                            className="text-blue-600 font-bold hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminar(ev.id)}
                            disabled={pendiente}
                            className="text-rose-600 font-bold hover:underline"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
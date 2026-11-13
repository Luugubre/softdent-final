"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { DetalleCita } from "@/components/agenda/DetalleCita"
import {
  diaSemana,
  fechaTitulo,
  horaAMinutos,
  minutosAHora,
  partesChile,
  rangoEnDia,
  sumarDias,
} from "@/lib/fechas-agenda"
import {
  ESTADOS_CITA,
  ESTADO_CITA,
  TIPO_BLOQUEO,
  type BloqueoAgenda,
  type Box,
  type CitaAgenda,
  type HorarioAtencion,
  type ProfesionalAgenda,
} from "@/types/cita"

const PX_POR_MIN = 2.4 // 36px por cada bloque de 15 min (legible y cómodo para lectura diaria)
const PASO_MIN = 15
const ESTADOS_OCULTOS = ["CANCELADA", "REAGENDADA"]

type Props = {
  fecha: string
  hoy: string
  ahoraMinInicial: number
  citas: CitaAgenda[]
  bloqueos: BloqueoAgenda[]
  horarios: HorarioAtencion[]
  profesionales: ProfesionalAgenda[]
  boxes: Box[]
  agruparPor: "doctor" | "box"
  profesionalFiltro?: string
  usuarioId: string
  permisos: {
    verTodas: boolean
    gestionar: boolean
    clinico: boolean
  }
}

type ColumnaDia = {
  id: string
  titulo: string
  subtitulo?: string
  citas: CitaAgenda[]
  tramos: [number, number][] | null
  bloqueos: { b: BloqueoAgenda; desde: number; hasta: number }[]
}

export function VistaDiariaDoctor(props: Props) {
  const {
    fecha,
    hoy,
    ahoraMinInicial,
    citas,
    bloqueos,
    horarios,
    profesionales,
    boxes,
    agruparPor,
    profesionalFiltro,
    usuarioId,
    permisos,
  } = props

  const router = useRouter()
  const lineaActualRef = useRef<HTMLDivElement>(null)
  const scrollInicialHecho = useRef(false)

  const [ahoraMin, setAhoraMin] = useState(ahoraMinInicial)
  const [detalle, setDetalle] = useState<CitaAgenda | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const esHoy = fecha === hoy

  // Reloj cada 30s (hora Chile) + refresco de datos del servidor cada 60s
  useEffect(() => {
    const actualizarReloj = () => {
      const actual = partesChile(new Date().toISOString())
      setAhoraMin(actual.minutos)
    }

    const intervaloReloj = setInterval(actualizarReloj, 30_000)
    const intervaloDatos = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh()
      }
    }, 60_000)

    return () => {
      clearInterval(intervaloReloj)
      clearInterval(intervaloDatos)
    }
  }, [router])

  // Auto-scroll hacia la línea roja al abrir la vista (solo una vez por carga de día)
  useEffect(() => {
    if (esHoy && lineaActualRef.current && !scrollInicialHecho.current) {
      scrollInicialHecho.current = true
      lineaActualRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [esHoy, fecha])

  function construirUrl(cambios: Record<string, string | undefined>) {
    const q = new URLSearchParams()
    const actual: Record<string, string | undefined> = {
      fecha,
      agrupar: permisos.verTodas && agruparPor === "box" ? "box" : undefined,
      profesional: permisos.verTodas ? profesionalFiltro : undefined,
      ...cambios,
    }
    for (const [k, v] of Object.entries(actual)) {
      if (v) q.set(k, v)
    }
    const qs = q.toString()
    return qs ? `/agenda/dia?${qs}` : "/agenda/dia"
  }

  const citasActivas = useMemo(
    () => citas.filter((c) => !ESTADOS_OCULTOS.includes(c.estado)),
    [citas]
  )

  // Construcción de columnas (por Doctor o por Box)
  const columnas = useMemo<ColumnaDia[]>(() => {
    const diaSem = diaSemana(fecha)

    if (agruparPor === "box" && permisos.verTodas) {
      const activos = boxes.filter((b) => b.activo)
      const cols: ColumnaDia[] = activos.map((box) => {
        const delBox = citasActivas.filter((c) => c.box_id === box.id)
        const bloq = bloqueos
          .filter((b) => (!b.profesional_id && !b.box_id) || b.box_id === box.id)
          .map((b) => ({ b, r: rangoEnDia(b.inicio, b.fin, fecha) }))
          .filter((x): x is { b: BloqueoAgenda; r: [number, number] } => x.r !== null)
          .map(({ b, r }) => ({ b, desde: r[0], hasta: r[1] }))

        return {
          id: box.id,
          titulo: box.nombre,
          subtitulo: `${delBox.length} cita${delBox.length === 1 ? "" : "s"}`,
          citas: delBox,
          tramos: null,
          bloqueos: bloq,
        }
      })

      // Si hay citas sin box asignado, agregar columna extra para no perderlas de vista
      const sinBox = citasActivas.filter((c) => !c.box_id)
      if (sinBox.length > 0) {
        cols.push({
          id: "sin-box",
          titulo: "Sin box asignado",
          subtitulo: `${sinBox.length} cita${sinBox.length === 1 ? "" : "s"}`,
          citas: sinBox,
          tramos: null,
          bloqueos: [],
        })
      }
      return cols
    }

    // Por Doctor
    const listaDoctores = !permisos.verTodas
      ? profesionales.filter((p) => p.id === usuarioId)
      : profesionalFiltro
        ? profesionales.filter((p) => p.id === profesionalFiltro)
        : profesionales

    return listaDoctores.map((doc) => {
      const propias = citasActivas.filter((c) => c.profesional_id === doc.id)
      const horariosDoc = horarios.filter((h) => h.profesional_id === doc.id)
      const tramos: [number, number][] =
        horariosDoc.length === 0
          ? diaSem < 7
            ? [[540, 1140]]
            : []
          : horariosDoc
              .filter((h) => h.dia_semana === diaSem)
              .map((h) => [horaAMinutos(h.hora_inicio), horaAMinutos(h.hora_fin)])

      const bloq = bloqueos
        .filter((b) => (!b.profesional_id && !b.box_id) || b.profesional_id === doc.id)
        .map((b) => ({ b, r: rangoEnDia(b.inicio, b.fin, fecha) }))
        .filter((x): x is { b: BloqueoAgenda; r: [number, number] } => x.r !== null)
        .map(({ b, r }) => ({ b, desde: r[0], hasta: r[1] }))

      return {
        id: doc.id,
        titulo: doc.nombre_completo,
        subtitulo: doc.especialidad ? `${doc.especialidad} · ${propias.length} cita${propias.length === 1 ? "" : "s"}` : `${propias.length} cita${propias.length === 1 ? "" : "s"}`,
        citas: propias,
        tramos,
        bloqueos: bloq,
      }
    })
  }, [agruparPor, permisos.verTodas, boxes, citasActivas, bloqueos, fecha, profesionales, usuarioId, profesionalFiltro, horarios])

  // Calcular primera y última hora de atención del día
  const { inicioMin, finMin } = useMemo(() => {
    let min = Infinity
    let max = -Infinity

    for (const col of columnas) {
      for (const [a, b] of col.tramos ?? []) {
        min = Math.min(min, a)
        max = Math.max(max, b)
      }
      for (const c of col.citas) {
        min = Math.min(min, c.minuto_inicio)
        max = Math.max(max, c.minuto_inicio + c.duracion_min)
      }
    }

    // Fallback si es domingo o no hay horarios/citas configuradas
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 480 // 08:00
      max = 1140 // 19:00
    }

    const inicioRedondeado = Math.floor(min / 60) * 60
    const finRedondeado = Math.min(1440, Math.ceil(max / 60) * 60)
    return { inicioMin: inicioRedondeado, finMin: Math.max(inicioRedondeado + 60, finRedondeado) }
  }, [columnas])

  // Texto dinámico junto a la línea roja ("Termina en X min" / "Próximo paciente en X min")
  const estadoTiempoLinea = useMemo(() => {
    if (!esHoy) return null

    // Relevantes para el usuario/vista actual (excluye anuladas/no asistió)
    const relevantes = citasActivas
      .filter((c) => c.estado !== "NO_ASISTIO")
      .sort((a, b) => a.minuto_inicio - b.minuto_inicio)

    // 1. ¿Hay alguna cita en curso en este minuto?
    const enCurso = relevantes.find((c) => {
      const finCita = c.minuto_inicio + c.duracion_min
      return (ahoraMin >= c.minuto_inicio && ahoraMin < finCita) || c.estado === "EN_ATENCION"
    })

    if (enCurso) {
      const finCita = enCurso.minuto_inicio + enCurso.duracion_min
      const restantes = Math.max(1, finCita - ahoraMin)
      return {
        tipo: "curso" as const,
        texto: `Termina en ${restantes} min`,
      }
    }

    // 2. Si no hay cita en curso, buscar la próxima cita del día
    const proxima = relevantes.find((c) => c.minuto_inicio > ahoraMin && c.estado !== "REALIZADA")
    if (proxima) {
      const faltan = proxima.minuto_inicio - ahoraMin
      return {
        tipo: "proximo" as const,
        texto: `Próximo paciente en ${faltan} min`,
      }
    }

    return null
  }, [esHoy, citasActivas, ahoraMin])

  const altoTotal = (finMin - inicioMin) * PX_POR_MIN
  const slots: number[] = []
  for (let m = inicioMin; m < finMin; m += PASO_MIN) slots.push(m)

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Cabecera */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={construirUrl({ fecha: sumarDias(fecha, -1) })}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-gray-700"
          >
            ←
          </Link>
          <Link
            href={construirUrl({ fecha: hoy })}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700"
          >
            Hoy
          </Link>
          <Link
            href={construirUrl({ fecha: sumarDias(fecha, 1) })}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-gray-700"
          >
            →
          </Link>
          <div className="ml-2">
            <h1 className="text-lg md:text-2xl font-black text-gray-900 capitalize">
              {fechaTitulo(fecha)}
            </h1>
            <p className="text-xs font-semibold text-gray-500">
              Vista diaria · {citasActivas.length} cita{citasActivas.length === 1 ? "" : "s"} programada{citasActivas.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={fecha}
            onChange={(e) => e.target.value && router.push(construirUrl({ fecha: e.target.value }))}
            className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700"
          />

          {/* Selector Por Doctor / Por Box solo para quienes ven toda la agenda */}
          {permisos.verTodas && (
            <div className="flex bg-gray-100 rounded-xl p-1">
              <Link
                href={construirUrl({ agrupar: undefined })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  agruparPor === "doctor" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Por Doctor
              </Link>
              <Link
                href={construirUrl({ agrupar: "box", profesional: undefined })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  agruparPor === "box" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Por Box
              </Link>
            </div>
          )}

          {/* Filtro por doctor específico si agrupa por doctor y tiene permiso */}
          {permisos.verTodas && agruparPor === "doctor" && (
            <select
              value={profesionalFiltro ?? ""}
              onChange={(e) => router.push(construirUrl({ profesional: e.target.value || undefined }))}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700"
            >
              <option value="">Todos los doctores</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo}
                </option>
              ))}
            </select>
          )}

          <Link
            href={`/agenda?fecha=${fecha}${profesionalFiltro ? `&profesional=${profesionalFiltro}` : ""}`}
            className="px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            ☰ Lista
          </Link>
          <Link
            href={`/agenda/grilla?fecha=${fecha}${profesionalFiltro ? `&profesional=${profesionalFiltro}` : ""}`}
            className="px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            ▦ Grilla
          </Link>
        </div>
      </div>

      {aviso && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-800">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)} className="font-black">
            ✕
          </button>
        </div>
      )}

      {/* Grilla horaria de 15 minutos */}
      {columnas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm font-semibold text-gray-400">
          No hay columnas disponibles para mostrar en esta vista.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-auto max-h-[78vh] relative">
          <div className="flex min-w-max">
            {/* Eje izquierdo de horas (cada 15 min) */}
            <div className="w-16 shrink-0 sticky left-0 z-20 bg-white border-r border-gray-200">
              <div className="h-14 border-b border-gray-200 sticky top-0 bg-white z-10 flex items-center justify-center">
                <span className="text-[10px] font-black uppercase text-gray-400">Hora</span>
              </div>
              <div className="relative" style={{ height: altoTotal }}>
                {slots.map((m) => {
                  const esHoraEnPunto = m % 60 === 0
                  return (
                    <div
                      key={m}
                      className="absolute right-2 -translate-y-1/2 flex items-center"
                      style={{ top: (m - inicioMin) * PX_POR_MIN }}
                    >
                      <span
                        className={
                          esHoraEnPunto
                            ? "text-[11px] font-black text-gray-700"
                            : "text-[9px] font-medium text-gray-400"
                        }
                      >
                        {minutosAHora(m)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Contenedor de columnas + línea roja transversal */}
            <div className="flex flex-1 relative">
              {columnas.map((col) => {
                const carriles = calcularCarriles(col.citas)
                return (
                  <div
                    key={col.id}
                    className="flex-1 min-w-[240px] border-r border-gray-200 last:border-r-0"
                  >
                    {/* Header de columna */}
                    <div className="h-14 sticky top-0 z-10 bg-white border-b border-gray-200 flex flex-col items-center justify-center px-3">
                      <span className="text-sm font-black text-gray-900 truncate max-w-full">
                        {col.titulo}
                      </span>
                      {col.subtitulo && (
                        <span className="text-[11px] font-semibold text-gray-400 truncate max-w-full">
                          {col.subtitulo}
                        </span>
                      )}
                    </div>

                    {/* Cuerpo de bloques de 15 min */}
                    <div className="relative" style={{ height: altoTotal }}>
                      {slots.map((m) => {
                        const enHorario =
                          col.tramos === null || col.tramos.some(([a, b]) => m >= a && m < b)
                        const pasada = fecha < hoy || (esHoy && m + PASO_MIN <= ahoraMin)
                        return (
                          <div
                            key={m}
                            className={`absolute inset-x-0 border-b ${
                              m % 60 === 45 ? "border-gray-200" : "border-gray-100"
                            } ${
                              !enHorario
                                ? "bg-gray-100/80"
                                : pasada
                                  ? "bg-gray-50/50"
                                  : "bg-white"
                            }`}
                            style={{
                              top: (m - inicioMin) * PX_POR_MIN,
                              height: PASO_MIN * PX_POR_MIN,
                            }}
                          />
                        )
                      })}

                      {/* Bloqueos */}
                      {col.bloqueos.map(({ b, desde, hasta }) => {
                        const a = Math.max(desde, inicioMin)
                        const z = Math.min(hasta, finMin)
                        if (z <= a) return null
                        return (
                          <div
                            key={b.id}
                            title={`${TIPO_BLOQUEO[b.tipo]}: ${b.motivo}`}
                            className="absolute inset-x-0 z-[1] border-y border-slate-300 bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_6px,#f8fafc_6px,#f8fafc_12px)] px-2.5 py-1 overflow-hidden"
                            style={{
                              top: (a - inicioMin) * PX_POR_MIN,
                              height: (z - a) * PX_POR_MIN,
                            }}
                          >
                            <span className="text-[10px] font-black uppercase text-slate-600">
                              🚫 {TIPO_BLOQUEO[b.tipo]} · {b.motivo}
                            </span>
                          </div>
                        )
                      })}

                      {/* Citas */}
                      {col.citas.map((c) => {
                        const { carril, total } = carriles.get(c.id) ?? { carril: 0, total: 1 }
                        const finCita = c.minuto_inicio + c.duracion_min
                        const esPasada =
                          fecha < hoy ||
                          (esHoy && finCita <= ahoraMin && c.estado !== "EN_ATENCION")
                        const esEnCurso =
                          esHoy &&
                          ((ahoraMin >= c.minuto_inicio && ahoraMin < finCita) ||
                            c.estado === "EN_ATENCION") &&
                          c.estado !== "REALIZADA" &&
                          c.estado !== "NO_ASISTIO"

                        const alturaPx = Math.max(c.duracion_min * PX_POR_MIN, 28)

                        return (
                          <button
                            key={c.id}
                            onClick={() => setDetalle(c)}
                            className={`absolute z-[2] rounded-xl border-l-4 px-2.5 py-1.5 text-left overflow-hidden transition-all ${
                              ESTADO_CITA[c.estado].tarjeta
                            } ${
                              esEnCurso
                                ? "!ring-2 !ring-red-500 shadow-lg z-[3] scale-[1.005]"
                                : esPasada
                                  ? "opacity-45 grayscale-[30%] hover:opacity-80"
                                  : "shadow-sm hover:brightness-95"
                            }`}
                            style={{
                              top: (c.minuto_inicio - inicioMin) * PX_POR_MIN + 1,
                              height: alturaPx - 2,
                              left: `calc(${(carril * 100) / total}% + 4px)`,
                              width: `calc(${100 / total}% - 8px)`,
                            }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-black truncate leading-tight">
                                {c.hora_inicio} - {c.hora_fin} · {c.paciente_nombre}
                              </p>
                              {esEnCurso && (
                                <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                                  En curso
                                </span>
                              )}
                            </div>

                            {alturaPx >= 42 && (
                              <p className="text-[11px] font-semibold opacity-85 truncate mt-0.5">
                                {c.prestacion_nombre ?? c.motivo ?? ESTADO_CITA[c.estado].etiqueta}
                                {agruparPor === "doctor" && c.box_nombre ? ` · ${c.box_nombre}` : ""}
                                {agruparPor === "box" ? ` · ${c.profesional_nombre}` : ""}
                              </p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Línea horizontal roja de hora actual (America/Santiago) */}
              {esHoy && ahoraMin >= inicioMin && ahoraMin <= finMin && (
                <div
                  ref={lineaActualRef}
                  className="absolute inset-x-0 z-[5] pointer-events-none flex items-center"
                  style={{ top: 56 + (ahoraMin - inicioMin) * PX_POR_MIN }} // 56px = h-14 del header
                >
                  {/* Punto rojo izquierdo */}
                  <div className="-ml-1.5 h-3 w-3 rounded-full bg-red-600 shadow-sm shrink-0" />
                  {/* Línea roja */}
                  <div className="h-[2px] w-full bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.5)]" />
                  {/* Etiqueta de hora + tiempo restante */}
                  <div className="sticky left-2 -ml-full flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-md whitespace-nowrap">
                    <span>{minutosAHora(ahoraMin)}</span>
                    {estadoTiempoLinea && (
                      <>
                        <span className="opacity-75">·</span>
                        <span>{estadoTiempoLinea.texto}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leyenda de estados */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        {ESTADOS_CITA.filter((e) => !ESTADOS_OCULTOS.includes(e)).map((e) => (
          <span key={e} className={`px-2.5 py-0.5 rounded-full ${ESTADO_CITA[e].chip}`}>
            {ESTADO_CITA[e].icono} {ESTADO_CITA[e].etiqueta}
          </span>
        ))}
      </div>

      {/* Modal de detalle de cita existente */}
      {detalle && (
        <DetalleCita
          cita={detalle}
          puedeGestionar={permisos.gestionar}
          verClinico={permisos.clinico}
          onClose={() => setDetalle(null)}
          onReagendar={() => {
            setDetalle(null)
            router.push(`/agenda?fecha=${detalle.fecha}&profesional=${detalle.profesional_id}`)
          }}
          onListo={(mensaje) => {
            setDetalle(null)
            setAviso(mensaje)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function calcularCarriles(citas: CitaAgenda[]) {
  const orden = [...citas].sort((a, b) => a.minuto_inicio - b.minuto_inicio)
  const res = new Map<string, { carril: number; total: number }>()
  let grupo: CitaAgenda[] = []
  let finGrupo = -1
  let carriles: number[] = []

  const cerrar = () => {
    const total = Math.max(1, carriles.length)
    for (const c of grupo) {
      res.set(c.id, { carril: res.get(c.id)!.carril, total })
    }
    grupo = []
    carriles = []
  }

  for (const c of orden) {
    const fin = c.minuto_inicio + c.duracion_min
    if (c.minuto_inicio >= finGrupo && grupo.length) cerrar()
    let carril = carriles.findIndex((f) => f <= c.minuto_inicio)
    if (carril === -1) {
      carril = carriles.length
      carriles.push(fin)
    } else {
      carriles[carril] = fin
    }
    res.set(c.id, { carril, total: 1 })
    grupo.push(c)
    finGrupo = Math.max(finGrupo, fin)
  }
  if (grupo.length) cerrar()
  return res
}
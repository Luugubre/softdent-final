"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  agendarCitas,
  buscarPacientes,
  buscarPrestaciones,
  crearPacienteRapido,
  disponibilidadSemana,
  reprogramarCita,
  resumenPacienteAgenda,
} from "@/app/agenda/actions"
import { Ventana } from "@/components/agenda/Ventana"
import { enlaceWhatsapp } from "@/lib/clinica"
import { fechaTitulo, hoyEnChile, lunesDeLaSemana, minutosAHora, partesChile, sumarDias } from "@/lib/fechas-agenda"
import { mensajeCambioHora, mensajeCitaAgendada } from "@/lib/mensajes-agenda"
import { PREVISIONES } from "@/lib/validaciones"
import type { BloqueElegido, Box, CitaAgenda, DisponibilidadSemana, PacienteBusqueda, PrestacionAgenda, ProfesionalAgenda, TipoAtencion } from "@/types/cita"

const DURACIONES = [15, 30, 45, 60, 90, 120, 150, 180, 210, 240]
const PASO = 15

/** Cómo se abre el modal: nueva cita, reprogramación o desde "Buscar hora" */
export type ConfigAgendar = {
  clave: number // cambia en cada apertura para reiniciar el formulario
  cita?: CitaAgenda // si viene, se reprograma esta cita
  profesionalId?: string
  duracion?: number
  semana?: string // cualquier día de la semana a mostrar
  bloques?: BloqueElegido[]
  paciente?: PacienteBusqueda | null
  motivo?: string
}

type Ticket = { paciente: string; telefono: string | null; profesional: string; bloques: BloqueElegido[]; reprogramada?: CitaAgenda }

const tarjeta = "bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"
const tituloSeccion = "text-sm font-black uppercase text-gray-800 mb-4 flex items-center gap-2"
const campo =
  "w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

const solapan = (a: number, b: number, rangos: [number, number][]) => rangos.some(([x, y]) => a < y && b > x)
const cabe = (a: number, b: number, tramos: [number, number][]) => tramos.some(([x, y]) => a >= x && b <= y)
const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))

export function ModalAgendar({
  config,
  profesionales,
  boxes,
  puedeSobrecupo,
  puedeVerTodos,
  usuarioId,
  tiposAtencion = [],
  onClose,
  onGuardado,
}: {
  config: ConfigAgendar
  tiposAtencion?: TipoAtencion[]
  profesionales: ProfesionalAgenda[]
  boxes: Box[]
  puedeSobrecupo: boolean
  puedeVerTodos: boolean
  usuarioId: string
  onClose: () => void
  onGuardado: (mensaje: string) => void
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const reprogramando = config.cita ?? null

  if (ticket) return <TicketCita ticket={ticket} onFinalizar={onClose} />

  return (
    <Formulario
      key={config.clave}
      config={config}
      reprogramando={reprogramando}
      profesionales={profesionales}
      boxes={boxes}
      puedeSobrecupo={puedeSobrecupo}
      puedeVerTodos={puedeVerTodos}
      usuarioId={usuarioId}
      tiposAtencion={tiposAtencion}
      onClose={onClose}
      onListo={(t, mensaje) => {
        setTicket(t)
        onGuardado(mensaje)
      }}
    />
  )
}

// =====================================================================
// FORMULARIO
// =====================================================================
function Formulario({
  config,
  reprogramando,
  profesionales,
  boxes,
  puedeSobrecupo,
  puedeVerTodos,
  usuarioId,
  tiposAtencion,
  onClose,
  onListo,
}: {
  config: ConfigAgendar
  tiposAtencion: TipoAtencion[]
  reprogramando: CitaAgenda | null
  profesionales: ProfesionalAgenda[]
  boxes: Box[]
  puedeSobrecupo: boolean
  puedeVerTodos: boolean
  usuarioId: string
  onClose: () => void
  onListo: (t: Ticket, mensaje: string) => void
}) {
  const hoy = hoyEnChile()
  const visibles = puedeVerTodos ? profesionales : profesionales.filter((p) => p.id === usuarioId)

  // ---------- Paciente ----------
  const inicialPaciente: PacienteBusqueda | null = reprogramando
    ? {
        id: reprogramando.paciente_id,
        nombres: reprogramando.paciente_nombres,
        apellidos: reprogramando.paciente_apellidos,
        rut: reprogramando.paciente_rut,
        telefono: reprogramando.paciente_telefono,
      }
    : config.paciente ?? null
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(inicialPaciente)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<(PacienteBusqueda & { activo: boolean })[]>([])
  const [nuevo, setNuevo] = useState<null | { nombres: string; apellidos: string; rut: string; extranjero: boolean; fechaNacimiento: string; telefono: string; prevision: string }>(null)
  const [resumen, setResumen] = useState<Awaited<ReturnType<typeof resumenPacienteAgenda>>>(null)

  // ---------- Motivo ----------
  const [motivo, setMotivo] = useState(config.motivo ?? reprogramando?.motivo ?? "")
  const [presupuestoId, setPresupuestoId] = useState<string>("")
  const [prestacion, setPrestacion] = useState<PrestacionAgenda | null>(null)
  const [filtroPrestacion, setFiltroPrestacion] = useState("")
  const [sugeridas, setSugeridas] = useState<PrestacionAgenda[]>([])
  const [boxId, setBoxId] = useState(reprogramando?.box_id ?? "")
  const [tipoId, setTipoId] = useState("")

  // ---------- Fecha y hora ----------
  const [profesionalId, setProfesionalId] = useState(
    config.profesionalId ?? reprogramando?.profesional_id ?? (puedeVerTodos ? "" : usuarioId) ?? ""
  )
  const [duracion, setDuracion] = useState(config.duracion ?? reprogramando?.duracion_min ?? 30)
  const [lunes, setLunes] = useState(lunesDeLaSemana(config.semana ?? reprogramando?.fecha ?? hoy))
  const [bloques, setBloques] = useState<BloqueElegido[]>(config.bloques ?? [])
  const [dispo, setDispo] = useState<DisponibilidadSemana | null>(null)
  const [cargando, setCargando] = useState(false)

  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()
  const ahoraMin = partesChile(new Date().toISOString()).minutos

  // Resumen del paciente (tratamientos activos, inasistencias)
  useEffect(() => {
    if (!paciente) {
      setResumen(null)
      return
    }
    let vigente = true
    resumenPacienteAgenda(paciente.id).then((r) => vigente && setResumen(r))
    return () => {
      vigente = false
    }
  }, [paciente])

  // Buscador de pacientes
  useEffect(() => {
    if (paciente || busqueda.trim().length < 2) return setResultados([])
    let vigente = true
    const t = setTimeout(async () => {
      const r = await buscarPacientes(busqueda)
      if (vigente) setResultados(r)
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [busqueda, paciente])

  // Buscador de prestaciones
  useEffect(() => {
    if (filtroPrestacion.trim().length < 2) return setSugeridas([])
    let vigente = true
    const t = setTimeout(async () => {
      const r = await buscarPrestaciones(filtroPrestacion)
      if (vigente) setSugeridas(r)
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [filtroPrestacion])

  // Disponibilidad del especialista en la semana
  const pedido = useRef(0)
  useEffect(() => {
    if (!profesionalId) return setDispo(null)
    const n = ++pedido.current
    setCargando(true)
    disponibilidadSemana(profesionalId, lunes, reprogramando?.id ?? null)
      .then((d) => {
        if (n !== pedido.current) return
        setDispo(d)
        setCargando(false)
        if (!d) setAviso({ ok: false, texto: "No se pudo cargar la disponibilidad del especialista." })
      })
      .catch(() => {
        if (n !== pedido.current) return
        setCargando(false)
        setAviso({ ok: false, texto: "No se pudo cargar la disponibilidad. ¿Ejecutaste los SQL 13 y 14 en Supabase?" })
      })
  }, [profesionalId, lunes, reprogramando?.id])

  const dias = useMemo(() => {
    const todos = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
    // El domingo solo se muestra si el especialista atiende ese día
    return dispo && (dispo.tramos[todos[6]]?.length ?? 0) > 0 ? todos : todos.slice(0, 6)
  }, [lunes, dispo])

  // ---------- Reglas de cada bloque ----------
  function estadoSlot(fecha: string, hora: string, dur: number) {
    if (!dispo) return "cargando"
    const a = aMin(hora)
    const b = a + dur
    if (fecha < hoy || (fecha === hoy && a < ahoraMin)) return "pasado"
    if (solapan(a, b, dispo.bloqueadas[fecha] ?? [])) return "bloqueado"
    if (solapan(a, b, dispo.ocupadas[fecha] ?? [])) return "ocupado"
    return "libre"
  }

  function slotsDelDia(fecha: string) {
    if (!dispo) return []
    const tramos = dispo.tramos[fecha] ?? []
    const res: string[] = []
    for (const [ini, fin] of tramos) for (let m = ini; m + duracion <= fin; m += PASO) res.push(minutosAHora(m))
    return [...new Set(res)].sort()
  }

  function clicSlot(fecha: string, hora: string) {
    setAviso(null)
    const ya = bloques.find((x) => x.fecha === fecha && x.hora === hora)
    if (ya) return setBloques(bloques.filter((x) => x !== ya))

    const estado = estadoSlot(fecha, hora, duracion)
    if (estado === "pasado") return setAviso({ ok: false, texto: "Ese horario ya pasó." })
    if (estado === "bloqueado") return setAviso({ ok: false, texto: "Ese horario está bloqueado para el especialista." })

    const a = aMin(hora)
    const choca = !reprogramando && bloques.some((s) => s.fecha === fecha && a < aMin(s.hora) + s.duracion && a + duracion > aMin(s.hora))
    if (choca) return setAviso({ ok: false, texto: "Ese horario se cruza con otro bloque que ya elegiste." })

    let sobrecupo = false
    if (estado === "ocupado") {
      if (!puedeSobrecupo) return setAviso({ ok: false, texto: "Ese horario está ocupado. Solo un administrador o dentista puede autorizar sobrecupos." })
      if (!window.confirm("⚠️ Ese bloque choca con otra cita. ¿Deseas forzar un SOBRECUPO?")) return
      sobrecupo = true
    }
    const b: BloqueElegido = { fecha, hora, duracion, sobrecupo }
    setBloques(reprogramando ? [b] : [...bloques, b])
  }

  function cambiarDuracion(d: number) {
    setDuracion(d)
    if (!dispo || bloques.length === 0) return
    const ajustados = bloques.map((b) => ({ ...b, duracion: d }))
    const validos = ajustados.filter((b) => {
      const a = aMin(b.hora)
      return cabe(a, a + d, dispo.tramos[b.fecha] ?? []) && !solapan(a, a + d, dispo.bloqueadas[b.fecha] ?? [])
    })
    const quitados = ajustados.length - validos.length
    if (quitados > 0) setAviso({ ok: false, texto: `${quitados} horario(s) se quitaron porque no caben con ${d} min.` })
    setBloques(validos.map((b) => ({ ...b, sobrecupo: b.sobrecupo || solapan(aMin(b.hora), aMin(b.hora) + d, dispo.ocupadas[b.fecha] ?? []) })))
  }

  // ---------- Paciente nuevo ----------
  function registrarNuevo() {
    if (!nuevo) return
    setAviso(null)
    startTransition(async () => {
      const r = await crearPacienteRapido(nuevo).catch(() => ({ ok: false, mensaje: "No se pudo conectar con el servidor.", paciente: undefined }))
      if (r.ok && r.paciente) {
        setPaciente(r.paciente)
        setNuevo(null)
        setAviso({ ok: true, texto: "Paciente registrado. Completa sus demás datos en la ficha cuando puedas." })
      } else setAviso({ ok: false, texto: r.mensaje })
    })
  }

  // ---------- Guardar ----------
  const profesional = profesionales.find((p) => p.id === profesionalId)
  const ordenados = [...bloques].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
  const haySobrecupo = bloques.some((b) => b.sobrecupo)

  function guardar() {
    setAviso(null)
    if (!paciente) return setAviso({ ok: false, texto: "Selecciona un paciente." })
    if (!profesionalId) return setAviso({ ok: false, texto: "Selecciona un especialista." })
    if (bloques.length === 0) return setAviso({ ok: false, texto: "Selecciona al menos un horario." })

    startTransition(async () => {
      try {
      const res = reprogramando
        ? await reprogramarCita(reprogramando.id, { profesionalId, bloque: ordenados[0], motivo, boxId: boxId || null })
        : await agendarCitas({
            pacienteId: paciente.id,
            profesionalId,
            bloques: ordenados,
            motivo,
            presupuestoId: presupuestoId || null,
            prestacionId: prestacion?.id ?? null,
            boxId: boxId || null,
            tipoAtencionId: tipoId || null,
          })
      if (!res.ok) return setAviso({ ok: false, texto: res.mensaje })
      onListo(
        {
          paciente: `${paciente.nombres} ${paciente.apellidos}`.trim(),
          telefono: paciente.telefono,
          profesional: profesional?.nombre_completo ?? "",
          bloques: ordenados,
          reprogramada: reprogramando ?? undefined,
        },
        res.mensaje
      )
      } catch {
        setAviso({ ok: false, texto: "No se pudo conectar con el servidor. Revisa la terminal donde corre npm run dev." })
      }
    })
  }

  const subtitulo = reprogramando
    ? `Cita original: ${fechaTitulo(reprogramando.fecha, { weekday: "short", day: "numeric", month: "short" })} a las ${reprogramando.hora_inicio}`
    : "Paciente · motivo · fecha y hora"

  return (
    <Ventana
      titulo={reprogramando ? "Reprogramar cita" : "Agendar nueva cita"}
      subtitulo={subtitulo}
      icono="📅"
      ancho="max-w-5xl"
      onClose={onClose}
      pie={
        <div className="space-y-3">
        {aviso && (
          <p
            role="alert"
            className={`rounded-xl px-4 py-2.5 text-sm font-bold border ${
              aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-300 text-rose-800"
            }`}
          >
            {aviso.ok ? "✔ " : "⚠ "}
            {aviso.texto}
          </p>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-xs font-black text-gray-500 uppercase tracking-wider min-w-0">
            {ordenados.length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-emerald-600">✔ {ordenados.length} bloque(s) seleccionado(s)</span>
                <div className="flex flex-wrap gap-1.5">
                  {ordenados.map((b) => (
                    <span
                      key={`${b.fecha}-${b.hora}`}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] normal-case tracking-normal border ${
                        b.sobrecupo ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                      }`}
                    >
                      {fechaTitulo(b.fecha, { weekday: "short", day: "numeric", month: "short" })} · {b.hora} ({b.duracion} min)
                      {b.sobrecupo ? " · sobrecupo" : ""}
                      <button onClick={() => setBloques(bloques.filter((x) => x !== b))} className="ml-1 hover:text-red-600">
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              "Selecciona un horario en el calendario"
            )}
          </div>
          <button
            onClick={guardar}
            disabled={pendiente}
            className="shrink-0 px-8 py-4 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-40 shadow-lg"
          >
            {pendiente ? "Guardando…" : reprogramando ? "Confirmar reprogramación" : "Confirmar y agendar"}
          </button>
        </div>
        </div>
      }
    >
      <div className="p-5 md:p-7 flex flex-col gap-5">

        {/* 1. PACIENTE */}
        <section className={tarjeta}>
          <h3 className={tituloSeccion}>👤 1. Datos del paciente</h3>
          {nuevo ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input placeholder="Nombres *" value={nuevo.nombres} onChange={(e) => setNuevo({ ...nuevo, nombres: e.target.value })} className={campo} />
                <input placeholder="Apellidos *" value={nuevo.apellidos} onChange={(e) => setNuevo({ ...nuevo, apellidos: e.target.value })} className={campo} />
                <input
                  placeholder={nuevo.extranjero ? "N° pasaporte / documento *" : "RUT (12345678-9) *"}
                  value={nuevo.rut}
                  onChange={(e) => setNuevo({ ...nuevo, rut: e.target.value })}
                  className={campo}
                />
                <input placeholder="Teléfono (9 dígitos)" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} className={campo} />
                <label className="text-xs font-bold text-gray-500">
                  Fecha de nacimiento *
                  <input type="date" max={hoy} value={nuevo.fechaNacimiento} onChange={(e) => setNuevo({ ...nuevo, fechaNacimiento: e.target.value })} className={`${campo} mt-1`} />
                </label>
                <label className="text-xs font-bold text-gray-500">
                  Previsión
                  <select value={nuevo.prevision} onChange={(e) => setNuevo({ ...nuevo, prevision: e.target.value })} className={`${campo} mt-1`}>
                    {PREVISIONES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-fit">
                <input type="checkbox" checked={nuevo.extranjero} onChange={(e) => setNuevo({ ...nuevo, extranjero: e.target.checked })} />
                Extranjero / otro documento
              </label>
              <div className="flex gap-2">
                <button onClick={() => setNuevo(null)} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-gray-500 bg-gray-100 hover:bg-gray-200">
                  ← Volver a buscar
                </button>
                <button
                  onClick={registrarNuevo}
                  disabled={pendiente}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Registrar paciente
                </button>
              </div>
            </div>
          ) : paciente ? (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  {`${paciente.nombres.charAt(0)}${paciente.apellidos.charAt(0)}`.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-emerald-900 text-sm uppercase truncate">
                    {paciente.nombres} {paciente.apellidos}
                  </p>
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    RUT: {paciente.rut}
                    {paciente.telefono ? ` · ${paciente.telefono}` : <span className="ml-2 text-amber-600">· Sin teléfono</span>}
                  </p>
                </div>
                {!reprogramando && (
                  <button onClick={() => setPaciente(null)} className="ml-auto px-2 py-1 rounded-lg hover:bg-emerald-200 text-emerald-800 font-black">
                    ✕
                  </button>
                )}
              </div>
              {resumen && resumen.inasistencias > 0 && (
                <p
                  className={`p-3 rounded-xl border text-xs font-bold ${
                    resumen.inasistencias >= 3 ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  🚫 <span className="font-black uppercase">{resumen.inasistencias} inasistencia(s)</span> en los últimos 12 meses.
                  {resumen.inasistencias >= 3
                    ? " Se recomienda pedir confirmación (o abono) antes de reservar."
                    : " Considera recordarle la cita con anticipación."}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por RUT o nombre…" className={`${campo} pl-11`} />
              </div>
              {resultados.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  {resultados.map((p) => (
                    <button
                      key={p.id}
                      disabled={!p.activo}
                      onClick={() => {
                        setPaciente(p)
                        setBusqueda("")
                      }}
                      className={`w-full text-left px-5 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 ${p.activo ? "" : "opacity-50 cursor-not-allowed"}`}
                    >
                      <p className="font-black text-gray-800 uppercase">
                        {p.nombres} {p.apellidos}
                        {!p.activo && <span className="ml-2 text-[9px] font-black text-red-500">DESHABILITADO</span>}
                      </p>
                      <p className="text-xs font-semibold text-gray-500">
                        RUT: {p.rut}
                        {p.telefono ? ` · ${p.telefono}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {busqueda.trim().length >= 2 && resultados.length === 0 && <p className="text-xs font-semibold text-gray-400">Sin resultados.</p>}
              <button
                onClick={() => setNuevo({ nombres: "", apellidos: "", rut: "", extranjero: false, fechaNacimiento: "", telefono: "", prevision: PREVISIONES[0] })}
                className="text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider"
              >
                + Registrar paciente nuevo
              </button>
            </div>
          )}
        </section>

        {/* 2. MOTIVO */}
        <section className={tarjeta}>
          <h3 className={tituloSeccion}>📋 2. Motivo o tratamiento</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {!reprogramando && resumen && resumen.tratamientos.length > 0 && (
              <select
                value={presupuestoId}
                onChange={(e) => {
                  setPresupuestoId(e.target.value)
                  const t = resumen.tratamientos.find((x) => x.id === e.target.value)
                  if (t && !motivo.trim()) setMotivo(t.nombre)
                }}
                className={`${campo} md:col-span-2`}
              >
                <option value="">— Sin asociar a un tratamiento —</option>
                {resumen.tratamientos.map((t) => (
                  <option key={t.id} value={t.id}>
                    Tratamiento N° {t.numero} · {t.nombre}
                  </option>
                ))}
              </select>
            )}
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={reprogramando ? "Motivo del cambio (opcional)" : "Ej: Evaluación, Limpieza, Control…"}
              className={`${campo} md:col-span-2`}
            />
            {!reprogramando && (
              <div className="relative">
                {prestacion ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm">
                    <span className="font-bold text-blue-900 truncate">🦷 {prestacion.nombre}</span>
                    <button onClick={() => setPrestacion(null)} className="text-xs font-black text-blue-700">
                      ✕
                    </button>
                  </div>
                ) : (
                  <input
                    value={filtroPrestacion}
                    onChange={(e) => setFiltroPrestacion(e.target.value)}
                    placeholder="Prestación (opcional): limpieza, DL-0012…"
                    className={campo}
                  />
                )}
                {!prestacion && sugeridas.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {sugeridas.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => {
                            setPrestacion(p)
                            setFiltroPrestacion("")
                            if (!motivo.trim()) setMotivo(p.nombre)
                            const d = Math.max(15, Math.round(p.duracion_min / 15) * 15)
                            if (d !== duracion) cambiarDuracion(d)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                        >
                          <span className="font-semibold">{p.nombre}</span>
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
            {!reprogramando && tiposAtencion.length > 0 && (
              <select
                value={tipoId}
                onChange={(e) => {
                  setTipoId(e.target.value)
                  const t = tiposAtencion.find((x) => x.id === e.target.value)
                  if (t) {
                    if (!motivo.trim()) setMotivo(t.nombre)
                    const d = Math.max(15, Math.round(t.duracion_min / 15) * 15)
                    if (d !== duracion) cambiarDuracion(d)
                  }
                }}
                className={campo}
              >
                <option value="">Tipo de atención (opcional)</option>
                {tiposAtencion.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {t.duracion_min} min
                  </option>
                ))}
              </select>
            )}
            <select value={boxId} onChange={(e) => setBoxId(e.target.value)} className={campo}>
              <option value="">Sin box asignado</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* 3. FECHA Y HORA */}
        <section className={tarjeta}>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
            <h3 className={`${tituloSeccion} !mb-0`}>🕒 3. Fecha y hora</h3>
            <div className="flex items-center gap-2">
              <select
                value={profesionalId}
                disabled={!puedeVerTodos}
                onChange={(e) => {
                  setProfesionalId(e.target.value)
                  setBloques([])
                }}
                className="p-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg outline-none disabled:bg-gray-100"
              >
                {!profesionalId && <option value="">Seleccione especialista…</option>}
                {visibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_completo}
                  </option>
                ))}
              </select>
              <select
                value={duracion}
                onChange={(e) => cambiarDuracion(Number(e.target.value))}
                className="p-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg outline-none"
              >
                {[...new Set([...DURACIONES, duracion])]
                  .sort((a, b) => a - b)
                  .map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-100">
            <button onClick={() => setLunes(sumarDias(lunes, -7))} className="px-3 py-1.5 hover:bg-gray-200 rounded-lg font-black text-gray-500">
              ←
            </button>
            <span className="text-xs font-black uppercase tracking-widest text-gray-700">
              Semana del {fechaTitulo(lunes, { day: "numeric", month: "short" })}
              {cargando && <span className="ml-2 text-gray-400 normal-case">cargando…</span>}
            </span>
            <button onClick={() => setLunes(sumarDias(lunes, 7))} className="px-3 py-1.5 hover:bg-gray-200 rounded-lg font-black text-gray-500">
              →
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-white border border-gray-300" /> Libre
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Ocupado {puedeSobrecupo ? "(sobrecupo)" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300" /> Bloqueado / pasado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500" /> Seleccionado
            </span>
          </div>

          {!profesionalId ? (
            <p className="text-center text-xs font-bold text-gray-400 py-8">Selecciona un especialista para ver sus horarios.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className={`grid gap-2 min-w-[560px] ${dias.length === 7 ? "grid-cols-7" : "grid-cols-6"}`}>
                {dias.map((d) => {
                  const slots = slotsDelDia(d)
                  const pasado = d < hoy
                  return (
                    <div key={d} className={`text-center rounded-xl ${pasado ? "opacity-40" : ""}`}>
                      <div className="mb-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{fechaTitulo(d, { weekday: "short" })}</p>
                        <p className={`text-base font-black ${d === hoy ? "text-blue-600" : "text-gray-800"}`}>{Number(d.slice(8))}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                        {dispo && slots.length === 0 && <span className="text-[10px] font-bold text-gray-300 italic py-4">Sin horario</span>}
                        {slots.map((h) => {
                          const sel = bloques.find((x) => x.fecha === d && x.hora === h)
                          const est = estadoSlot(d, h, duracion)
                          const clase = sel
                            ? sel.sobrecupo
                              ? "bg-red-500 text-white border-red-600 shadow-md"
                              : "bg-emerald-500 text-white border-emerald-600 shadow-md"
                            : est === "ocupado"
                              ? "bg-red-50 text-red-500 border-red-200 opacity-70"
                              : est === "bloqueado" || est === "pasado"
                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                : "bg-white text-gray-600 border-gray-200 hover:border-blue-500 hover:text-blue-600 shadow-sm"
                          return (
                            <button
                              key={h}
                              onClick={() => clicSlot(d, h)}
                              title={est === "ocupado" ? "Ocupado (sobrecupo)" : est === "bloqueado" ? "Bloqueado" : est === "pasado" ? "Ya pasó" : "Disponible"}
                              className={`py-2 text-[11px] font-black rounded-lg border transition-all ${clase}`}
                            >
                              {h}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {haySobrecupo && <p className="mt-3 text-xs font-bold text-red-600">⚠ Hay bloques marcados como sobrecupo (quedarán registrados como tales).</p>}
        </section>
      </div>
    </Ventana>
  )
}

// =====================================================================
// TICKET "¡Cita lista!" con envío por WhatsApp
// =====================================================================
function TicketCita({ ticket: t, onFinalizar }: { ticket: Ticket; onFinalizar: () => void }) {
  const mensaje = t.reprogramada
    ? mensajeCambioHora(t.reprogramada, t.bloques[0].fecha, t.bloques[0].hora, t.profesional)
    : mensajeCitaAgendada(t.paciente, t.profesional, t.bloques)
  const enlace = enlaceWhatsapp(t.telefono, mensaje)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 text-center space-y-6">
        <p className="text-6xl">✅</p>
        <h2 className="text-3xl font-black uppercase tracking-tighter text-gray-800">{t.reprogramada ? "¡Cita movida!" : "¡Cita lista!"}</h2>
        <div className="text-left bg-gray-50 p-5 rounded-3xl border border-gray-100 space-y-3">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Paciente</p>
            <p className="font-black text-base text-gray-800 uppercase leading-tight">{t.paciente}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Con</p>
            <p className="font-bold text-sm text-gray-800">{t.profesional}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Fecha y hora</p>
            {t.bloques.map((b) => (
              <p key={`${b.fecha}-${b.hora}`} className="font-black text-base text-gray-800 uppercase leading-tight">
                {fechaTitulo(b.fecha, { weekday: "short", day: "numeric", month: "short" })} • {b.hora} hrs
              </p>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {enlace ? (
            <a
              href={enlace}
              target="_blank"
              rel="noreferrer"
              onClick={() => setTimeout(onFinalizar, 300)}
              className="w-full py-4 bg-emerald-500 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-md hover:bg-emerald-600"
            >
              💬 Confirmar y enviar por WhatsApp
            </a>
          ) : (
            <p className="text-xs font-bold text-amber-700 bg-amber-50 rounded-xl p-2">El paciente no tiene un teléfono válido para WhatsApp.</p>
          )}
          <button onClick={onFinalizar} className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200">
            Finalizar sin enviar
          </button>
        </div>
      </div>
    </div>
  )
}

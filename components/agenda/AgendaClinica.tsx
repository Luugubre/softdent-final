"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { cambiarEstadoCita, marcarRecordatorio } from "@/app/agenda/actions"
import { DetalleCita } from "@/components/agenda/DetalleCita"
import { ModalAgendar, type ConfigAgendar } from "@/components/agenda/ModalAgendar"
import { ModalBloqueo } from "@/components/agenda/ModalBloqueo"
import { ModalAnuladas, ModalBuscarHora, ModalRecordatorios } from "@/components/agenda/ModalesRecepcion"
import { TarjetaCitaDia, TarjetaCitaSemana, type AccionesCita } from "@/components/agenda/TarjetaCita"
import { enlaceWhatsapp } from "@/lib/clinica"
import { ComoFunciona, Termino } from "@/components/ui/Ayuda"
import { fechaTitulo, sumarDias } from "@/lib/fechas-agenda"
import { mensajeInasistencia, mensajeRecordatorio } from "@/lib/mensajes-agenda"
import { ESTADO_CITA, type Box, type CitaAgenda, type EstadoCita, type InfoPaciente, type PacienteBusqueda, type ProfesionalAgenda, type TipoAtencion } from "@/types/cita"

type Props = {
  vista: "dia" | "semana"
  fecha: string
  hoy: string
  dias: string[]
  citas: CitaAgenda[]
  info: Record<string, InfoPaciente>
  profesionales: ProfesionalAgenda[]
  boxes: Box[]
  tiposAtencion: TipoAtencion[]
  profesional?: string
  usuarioId: string
  permisos: { gestionar: boolean; sobrecupo: boolean; configurar: boolean; clinico: boolean; finanzas: boolean; verTodos: boolean }
  pacienteInicial: PacienteBusqueda | null
}

type Modal = null | "bloqueo" | "buscar" | "recordatorios" | "anuladas"

export function AgendaClinica(p: Props) {
  const { vista, fecha, hoy, dias, citas, info, profesionales, boxes, profesional, usuarioId, permisos } = p
  const router = useRouter()
  const fechaRef = useRef<HTMLInputElement>(null)

  const [busqueda, setBusqueda] = useState("")
  const [agendar, setAgendar] = useState<ConfigAgendar | null>(
    p.pacienteInicial && permisos.gestionar ? { clave: Date.now(), paciente: p.pacienteInicial, profesionalId: profesional, semana: fecha } : null
  )
  const [modal, setModal] = useState<Modal>(null)
  const [detalle, setDetalle] = useState<CitaAgenda | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string; whatsapp?: string } | null>(null)
  const [, startTransition] = useTransition()

  const [ahoraMs, setAhoraMs] = useState(() => Date.now())
  useEffect(() => {
    const reloj = setInterval(() => setAhoraMs(Date.now()), 30000)
    const refresco = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh()
    }, 60000)
    return () => {
      clearInterval(reloj)
      clearInterval(refresco)
    }
  }, [router])

  function url(cambios: Record<string, string | undefined>) {
    const q = new URLSearchParams()
    const actual: Record<string, string | undefined> = { vista, fecha, profesional, ...cambios }
    for (const [k, v] of Object.entries(actual)) if (v) q.set(k, v)
    return `/agenda?${q.toString()}`
  }

  const anuladas = citas.filter((c) => c.estado === "CANCELADA")
  const activas = citas.filter((c) => c.estado !== "CANCELADA" && c.estado !== "REAGENDADA")
  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return activas
    return activas.filter((c) => c.paciente_nombre.toLowerCase().includes(t) || c.paciente_rut.toLowerCase().includes(t))
  }, [activas, busqueda])

  const esHoy = fecha === hoy
  const etiquetaFecha =
    vista === "dia"
      ? fechaTitulo(fecha, { weekday: "long", day: "numeric", month: "short" })
      : `${fechaTitulo(dias[0], { day: "numeric", month: "short" })} – ${fechaTitulo(dias[dias.length - 1], { day: "numeric", month: "short" })}`

  function abrirAgendar(cfg: Omit<ConfigAgendar, "clave"> = {}) {
    setAgendar({ clave: Date.now(), profesionalId: profesional, semana: fecha < hoy ? hoy : fecha, ...cfg })
  }

  function cerrarAgendar() {
    setAgendar(null)
    if (p.pacienteInicial) router.replace(url({}))
  }

  const acciones: AccionesCita = {
    onCambiarEstado: (cita: CitaAgenda, estado: EstadoCita) => {
      let motivo: string | undefined
      if (estado === "CANCELADA") {
        const m = window.prompt(`Motivo de la anulación de la cita de ${cita.paciente_nombre}:`)
        if (!m?.trim()) return
        motivo = m
      }
      startTransition(async () => {
        const r = await cambiarEstadoCita(cita.id, estado, motivo)
        if (!r.ok) return setAviso({ ok: false, texto: r.mensaje })
        if (estado === "NO_ASISTIO") {
          const w = enlaceWhatsapp(cita.paciente_telefono, mensajeInasistencia(cita))
          setAviso({ ok: true, texto: `${cita.paciente_nombre} no asistió. ¿Enviarle un WhatsApp para reagendar?`, whatsapp: w ?? undefined })
        } else setAviso({ ok: true, texto: `${cita.paciente_nombre}: ${ESTADO_CITA[estado].etiqueta}.` })
        router.refresh()
      })
    },
    onReprogramar: (cita) =>
      setAgendar({ clave: Date.now(), cita, profesionalId: cita.profesional_id, duracion: cita.duracion_min, semana: cita.fecha < hoy ? hoy : cita.fecha }),
    onRecordatorio: (cita) => {
      const mismoDia = citas.filter((c) => c.paciente_id === cita.paciente_id && c.fecha === cita.fecha && ["AGENDADA", "CONFIRMADA"].includes(c.estado))
      const w = enlaceWhatsapp(cita.paciente_telefono, mensajeRecordatorio(mismoDia.length ? mismoDia : [cita]))
      if (!w) return setAviso({ ok: false, texto: "El paciente no tiene un teléfono válido registrado." })
      window.open(w, "_blank")
      startTransition(async () => {
        await marcarRecordatorio((mismoDia.length ? mismoDia : [cita]).map((c) => c.id))
        router.refresh()
      })
    },
    onInasistencia: (cita) => {
      const w = enlaceWhatsapp(cita.paciente_telefono, mensajeInasistencia(cita))
      if (!w) return setAviso({ ok: false, texto: "El paciente no tiene un teléfono válido registrado." })
      window.open(w, "_blank")
    },
    onDetalle: setDetalle,
  }

  const boton = "w-full lg:w-auto justify-center px-3 md:px-4 py-2.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 bg-white"

  return (
    <div className="min-h-full bg-gray-50 text-gray-800 p-4 sm:p-6 md:p-10 pb-24">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            📅 Agenda <span className="italic font-serif text-blue-600">Clínica</span>
          </h1>
          <p className="text-sm font-medium text-gray-500">
            Citas del día o la semana. Haz clic en una cita para ver su detalle o cambiar su estado.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
          {permisos.gestionar && (
            <button onClick={() => setModal("recordatorios")} className={`${boton} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}>
              🔔 Recordar citas
            </button>
          )}
          <Link href={`/agenda/hoja-ruta?fecha=${fecha}${profesional ? `&profesional=${profesional}` : ""}`} className={`${boton} border-gray-200 text-gray-600 hover:bg-gray-50`}>
            🗒 Hoja de ruta
          </Link>
          <button onClick={() => setModal("buscar")} className={`${boton} border-blue-200 text-blue-700 hover:bg-blue-50`}>
            🔍 Buscar hora
          </button>
          {permisos.gestionar && (
            <button onClick={() => setModal("bloqueo")} className={`${boton} border-red-200 text-red-600 hover:bg-red-50`}>
              🔒 Bloquear
            </button>
          )}
          <Link href={`/agenda/grilla?fecha=${fecha}${profesional ? `&profesional=${profesional}` : ""}`} className={`${boton} border-gray-200 text-gray-600 hover:bg-gray-50`}>
            ▦ Vista grilla
          </Link>
          {permisos.configurar && (
            <Link href="/agenda/configuracion" className={`${boton} border-gray-200 text-gray-600 hover:bg-gray-50`}>
              ⚙ Horarios
            </Link>
          )}
          {permisos.gestionar && (
            <button
              onClick={() => abrirAgendar()}
              className="col-span-2 lg:col-span-1 justify-center px-6 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-wider shadow-md flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700"
            >
              + Agendar
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <ComoFunciona
          titulo="¿Cómo se usa la agenda?"
          pasos={[
            <>Para una cita nueva presiona <strong>+ Agendar</strong>, busca al paciente y elige un horario libre.</>,
            <>Cuando el paciente llega, márcalo <strong>En espera</strong>; al pasar al sillón, <strong>En box</strong>; al terminar, <strong>Atendido</strong>.</>,
            <><strong>🔔 Recordar citas</strong> arma los mensajes de WhatsApp de las citas de mañana.</>,
            <><strong>🔍 Buscar hora</strong> encuentra el próximo horario libre; <strong>🗒 Hoja de ruta</strong> imprime el día.</>,
          ]}
          reglas={[
            <>Solo se agenda dentro del <Termino t="horario">horario del dentista</Termino>; fuera de él es <Termino t="sobrecupo" />.</>,
            <>Un <Termino t="bloqueo" /> (🔒 Bloquear) impide agendar en ese período.</>,
            <>Las citas no se borran: se anulan o se reprograman y queda el historial.</>,
            <>Los horarios y boxes se configuran en <strong>⚙ Horarios</strong>.</>,
          ]}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
            <Termino t="estado_cita">Colores</Termino>:
          </span>
          {(Object.keys(ESTADO_CITA) as EstadoCita[]).map((e) => (
            <span key={e} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ESTADO_CITA[e].pill}`}>
              {ESTADO_CITA[e].icono} {ESTADO_CITA[e].etiqueta}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm flex items-center gap-2">
          <span>👥</span>
          <select
            value={profesional ?? ""}
            disabled={!permisos.verTodos}
            onChange={(e) => router.push(url({ profesional: e.target.value || undefined }))}
            className="text-[11px] font-bold uppercase text-gray-600 bg-transparent outline-none cursor-pointer pr-2 disabled:cursor-not-allowed"
          >
            {permisos.verTodos && <option value="">Todos los especialistas</option>}
            {profesionales
              .filter((x) => permisos.verTodos || x.id === usuarioId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre_completo}
                </option>
              ))}
          </select>
        </div>

        <div className="flex bg-white rounded-full p-1 border border-gray-200 shadow-sm">
          {(["dia", "semana"] as const).map((v) => (
            <Link
              key={v}
              href={url({ vista: v })}
              className={`flex-1 text-center px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider ${vista === v ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
            >
              {v === "dia" ? "☰ Día" : "▦ Semana"}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-between bg-white rounded-full px-2 py-1 border border-gray-200 shadow-sm">
            <Link href={url({ fecha: sumarDias(fecha, vista === "semana" ? -7 : -1) })} className="px-3 py-1.5 text-gray-400 hover:text-gray-900 font-black">
              ‹
            </Link>
            <button
              onClick={() => {
                try {
                  fechaRef.current?.showPicker()
                } catch {
                  fechaRef.current?.focus()
                }
              }}
              className="relative px-4 text-[12px] font-bold text-gray-700 capitalize min-w-[150px]"
            >
              📅 {etiquetaFecha}
              <input
                ref={fechaRef}
                type="date"
                value={fecha}
                onChange={(e) => e.target.value && router.push(url({ fecha: e.target.value }))}
                className="sr-only"
              />
            </button>
            <Link href={url({ fecha: sumarDias(fecha, vista === "semana" ? 7 : 1) })} className="px-3 py-1.5 text-gray-400 hover:text-gray-900 font-black">
              ›
            </Link>
          </div>
          {!esHoy && (
            <Link href={url({ fecha: hoy })} className="px-4 py-2.5 rounded-full bg-white border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-blue-50">
              Hoy
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-6">
        <div className="relative w-full sm:max-w-lg">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por paciente o RUT…"
            className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-full text-sm outline-none shadow-sm focus:border-blue-500"
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 px-2 text-gray-400 hover:text-gray-700">
              ✕
            </button>
          )}
        </div>
        <div className="bg-white text-gray-700 px-5 py-3 rounded-full border border-gray-200 shadow-sm flex items-center justify-center gap-2">
          <span className="font-bold text-xs uppercase tracking-widest">
            🗓 {filtradas.length} {vista === "dia" ? (esHoy ? "citas hoy" : "citas del día") : "citas en la semana"}
          </span>
          {anuladas.length > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <button onClick={() => setModal("anuladas")} className="font-bold text-xs uppercase tracking-widest text-red-500 hover:text-red-700">
                {anuladas.length} anulada{anuladas.length === 1 ? "" : "s"}
              </button>
            </>
          )}
        </div>
      </div>

      {aviso && (
        <div
          className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{aviso.texto}</span>
          <span className="flex items-center gap-2">
            {aviso.whatsapp && (
              <a href={aviso.whatsapp} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-black uppercase">
                💬 Enviar WhatsApp
              </a>
            )}
            <button onClick={() => setAviso(null)} className="font-black">
              ✕
            </button>
          </span>
        </div>
      )}

      {vista === "dia" && (
        <div className="relative md:pl-[140px] pt-2">
          {filtradas.length > 0 && <div className="absolute left-[100px] top-6 bottom-0 w-[2px] bg-gradient-to-b from-blue-300 to-blue-50 hidden md:block" />}
          {filtradas.length > 0 ? (
            filtradas.map((c) => (
              <TarjetaCitaDia
                key={c.id}
                cita={c}
                info={info[c.paciente_id]}
                ahoraMs={ahoraMs}
                puedeGestionar={permisos.gestionar}
                verFinanzas={permisos.finanzas}
                acciones={acciones}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400 rounded-3xl border-2 border-dashed border-gray-200 md:-ml-[140px]">
              <p className="text-5xl mb-3 opacity-40">🗓</p>
              <h3 className="font-black uppercase tracking-widest text-gray-600">{busqueda ? "Sin resultados" : "Agenda libre"}</h3>
              <p className="mt-1 font-bold text-xs">{busqueda ? "Ningún paciente coincide con la búsqueda." : "No hay citas programadas para este día."}</p>
              {permisos.gestionar && !busqueda && fecha >= hoy && (
                <button onClick={() => abrirAgendar({ semana: fecha })} className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black uppercase">
                  + Agendar en este día
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {vista === "semana" && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${dias.length === 7 ? "lg:grid-cols-7" : "lg:grid-cols-6"} gap-3`}>
          {dias.map((d) => {
            const delDia = filtradas.filter((c) => c.fecha === d)
            const esHoyCol = d === hoy
            return (
              <div key={d} className="flex flex-col gap-2">
                <Link
                  href={url({ vista: "dia", fecha: d })}
                  title="Ver este día"
                  className={`rounded-xl p-2.5 text-center sticky top-2 z-10 border shadow-sm ${esHoyCol ? "bg-blue-600 border-blue-700" : "bg-white border-gray-200 hover:border-blue-400"}`}
                >
                  <p className={`text-[9px] font-black uppercase ${esHoyCol ? "text-white/80" : "text-gray-500"}`}>{fechaTitulo(d, { weekday: "long" })}</p>
                  <p className={`text-base font-black ${esHoyCol ? "text-white" : "text-gray-900"}`}>{Number(d.slice(8))}</p>
                  <p className={`text-[9px] font-bold ${esHoyCol ? "text-white/80" : "text-gray-400"}`}>
                    {delDia.length} cita{delDia.length === 1 ? "" : "s"}
                  </p>
                </Link>
                {delDia.length > 0 ? (
                  delDia.map((c) => (
                    <TarjetaCitaSemana
                      key={c.id}
                      cita={c}
                      info={info[c.paciente_id]}
                      ahoraMs={ahoraMs}
                      puedeGestionar={permisos.gestionar}
                      verFinanzas={permisos.finanzas}
                      acciones={acciones}
                    />
                  ))
                ) : (
                  <div className="h-20 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl opacity-50">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sin citas</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {agendar && (
        <ModalAgendar
          config={agendar}
          tiposAtencion={p.tiposAtencion}
          profesionales={profesionales}
          boxes={boxes}
          puedeSobrecupo={permisos.sobrecupo}
          puedeVerTodos={permisos.verTodos}
          usuarioId={usuarioId}
          onClose={cerrarAgendar}
          onGuardado={(m) => {
            setAviso({ ok: true, texto: m })
            router.refresh()
          }}
        />
      )}
      {modal === "buscar" && (
        <ModalBuscarHora
          profesionales={profesionales.filter((x) => permisos.verTodos || x.id === usuarioId)}
          profesionalInicial={permisos.verTodos ? profesional : usuarioId}
          puedeVerTodos={permisos.verTodos}
          onClose={() => setModal(null)}
          onElegir={(h, duracion) => {
            setModal(null)
            abrirAgendar({ profesionalId: h.profesional_id, duracion, semana: h.fecha, bloques: [{ fecha: h.fecha, hora: h.hora, duracion }] })
          }}
        />
      )}
      {modal === "recordatorios" && <ModalRecordatorios profesionalId={profesional} onClose={() => setModal(null)} />}
      {modal === "anuladas" && <ModalAnuladas citas={anuladas} mostrarFecha={vista === "semana"} onClose={() => setModal(null)} />}
      {modal === "bloqueo" && (
        <ModalBloqueo
          fecha={fecha < hoy ? hoy : fecha}
          profesionales={profesionales}
          boxes={boxes}
          onClose={() => setModal(null)}
          onListo={(m) => {
            setModal(null)
            setAviso({ ok: true, texto: m })
            router.refresh()
          }}
        />
      )}
      {detalle && (
        <DetalleCita
          cita={detalle}
          puedeGestionar={permisos.gestionar}
          verClinico={permisos.clinico}
          onClose={() => setDetalle(null)}
          onReagendar={() => {
            acciones.onReprogramar(detalle)
            setDetalle(null)
          }}
          onListo={(m) => {
            setDetalle(null)
            setAviso({ ok: true, texto: m })
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

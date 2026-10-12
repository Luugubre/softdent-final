"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { DetalleCita } from "@/components/agenda/DetalleCita"
import { ModalBloqueo } from "@/components/agenda/ModalBloqueo"
import { ModalAgendar, type ConfigAgendar } from "@/components/agenda/ModalAgendar"
import {
  diaSemana,
  fechaTitulo,
  horaAMinutos,
  minutosAHora,
  rangoEnDia,
  sumarDias,
  sumarMeses,
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

export type Vista = "dia" | "semana" | "mes"

const PX = 1.2
const PASO = 15
const OCULTAS_POR_DEFECTO = ["CANCELADA", "REAGENDADA"]

type Columna = {
  clave: string
  fecha: string
  profesionalId?: string
  titulo: string
  subtitulo?: string
  citas: CitaAgenda[]
  tramos: [number, number][] | null
  bloqueos: { b: BloqueoAgenda; desde: number; hasta: number }[]
}

type Props = {
  vista: Vista
  fecha: string
  hoy: string
  ahoraMin: number
  dias: string[]
  citas: CitaAgenda[]
  bloqueos: BloqueoAgenda[]
  horarios: HorarioAtencion[]
  profesionales: ProfesionalAgenda[]
  boxes: Box[]
  filtros: { profesional?: string; box?: string; estado?: string }
  permisos: { gestionar: boolean; sobrecupo: boolean; configurar: boolean; clinico: boolean; verTodos: boolean }
  usuarioId: string
}

export function AgendaVista(props: Props) {
  const { vista, fecha, hoy, ahoraMin, dias, citas, bloqueos, horarios, profesionales, boxes, filtros, permisos, usuarioId } = props
  const router = useRouter()

  const [modal, setModal] = useState<{ tipo: "agendar"; config: ConfigAgendar } | { tipo: "bloqueo" } | null>(null)
  const [detalle, setDetalle] = useState<CitaAgenda | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  function url(cambios: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const actual = { vista, fecha, profesional: filtros.profesional, box: filtros.box, estado: filtros.estado, ...cambios }
    for (const [k, v] of Object.entries(actual)) if (v) p.set(k, v)
    return `/agenda/grilla?${p.toString()}`
  }

  const paso = (n: number) =>
    vista === "dia" ? sumarDias(fecha, n) : vista === "semana" ? sumarDias(fecha, 7 * n) : sumarMeses(fecha, n)

  const titulo =
    vista === "dia"
      ? fechaTitulo(fecha)
      : vista === "semana"
        ? `${fechaTitulo(dias[0], { day: "numeric", month: "short" })} – ${fechaTitulo(dias[6], { day: "numeric", month: "short", year: "numeric" })}`
        : fechaTitulo(fecha, { month: "long", year: "numeric" })

  const visibles = filtros.estado ? citas : citas.filter((c) => !OCULTAS_POR_DEFECTO.includes(c.estado))
  const ocultas = citas.length - visibles.length

  function cerrarModal() {
    setModal(null)
  }

  function listo(mensaje: string) {
    setModal(null)
    setDetalle(null)
    setAviso(mensaje)
    router.refresh()
  }

  function nueva(inicial: { fecha?: string; hora?: string; profesionalId?: string } = {}) {
    const dia = inicial.fecha ?? (fecha < hoy ? hoy : fecha)
    setModal({
      tipo: "agendar",
      config: {
        clave: Date.now(),
        profesionalId: inicial.profesionalId ?? filtros.profesional ?? (permisos.verTodos ? undefined : usuarioId),
        semana: dia,
        bloques: inicial.hora ? [{ fecha: dia, hora: inicial.hora, duracion: 30 }] : [],
      },
    })
  }

  const columnas = useMemo<Columna[]>(() => {
    const tramosDe = (profesionalId: string | undefined, dia: string): [number, number][] | null => {
      if (!profesionalId) return null
      const propios = horarios.filter((h) => h.profesional_id === profesionalId)
      if (propios.length === 0) return diaSemana(dia) < 7 ? [[540, 1140]] : []
      return propios
        .filter((h) => h.dia_semana === diaSemana(dia))
        .map((h) => [horaAMinutos(h.hora_inicio), horaAMinutos(h.hora_fin)] as [number, number])
    }
    const bloqueosDe = (profesionalId: string | undefined, dia: string) =>
      bloqueos
        .filter(
          (b) =>
            (!b.profesional_id && !b.box_id) ||
            (b.profesional_id && (!profesionalId || b.profesional_id === profesionalId)) ||
            (b.box_id && filtros.box === b.box_id)
        )
        .map((b) => ({ b, r: rangoEnDia(b.inicio, b.fin, dia) }))
        .filter((x): x is { b: BloqueoAgenda; r: [number, number] } => x.r !== null)
        .map(({ b, r }) => ({ b, desde: r[0], hasta: r[1] }))

    if (vista === "dia") {
      const lista = filtros.profesional ? profesionales.filter((p) => p.id === filtros.profesional) : profesionales
      return lista.map((p) => {
        const propias = visibles.filter((c) => c.profesional_id === p.id && c.fecha === fecha)
        return {
          clave: p.id,
          fecha,
          profesionalId: p.id,
          titulo: p.nombre_completo,
          subtitulo: `${propias.length} cita${propias.length === 1 ? "" : "s"}`,
          citas: propias,
          tramos: tramosDe(p.id, fecha),
          bloqueos: bloqueosDe(p.id, fecha),
        }
      })
    }
    return dias.map((d) => {
      const propias = visibles.filter((c) => c.fecha === d)
      return {
        clave: d,
        fecha: d,
        profesionalId: filtros.profesional,
        titulo: fechaTitulo(d, { weekday: "short", day: "numeric" }),
        subtitulo: `${propias.length} cita${propias.length === 1 ? "" : "s"}`,
        citas: propias,
        tramos: tramosDe(filtros.profesional, d),
        bloqueos: bloqueosDe(filtros.profesional, d),
      }
    })
  }, [vista, fecha, dias, visibles, profesionales, horarios, bloqueos, filtros.profesional, filtros.box])

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={url({ fecha: paso(-1) })} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-gray-700">
              ←
            </Link>
            <Link href={url({ fecha: hoy })} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700">
              Hoy
            </Link>
            <Link href={url({ fecha: paso(1) })} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-gray-700">
              →
            </Link>
            <h1 className="ml-2 text-xl md:text-2xl font-black text-gray-900 capitalize">{titulo}</h1>
            <input
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && router.push(url({ fecha: e.target.value }))}
              className="ml-1 rounded-lg border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-600"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {permisos.gestionar && (
              <>
                <button onClick={() => nueva()} className="px-4 py-2 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700">
                  + Nueva cita
                </button>
                <button
                  onClick={() => setModal({ tipo: "bloqueo" })}
                  className="px-3 py-2 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
                >
                  🚫 Bloquear
                </button>
              </>
            )}
            <Link href={`/agenda?fecha=${fecha}${filtros.profesional ? `&profesional=${filtros.profesional}` : ""}`} className="px-3 py-2 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200">
              ☰ Vista lista
            </Link>
            {permisos.configurar && (
              <Link href="/agenda/configuracion" className="px-3 py-2 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200">
                ⚙ Configurar
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-gray-100 pt-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(["dia", "semana", "mes"] as const).map((v) => (
              <Link
                key={v}
                href={url({ vista: v })}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold ${vista === v ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                {v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filtro
              valor={filtros.profesional}
              vacio="Todos los profesionales"
              opciones={profesionales.map((p) => ({ id: p.id, nombre: p.nombre_completo }))}
              onCambio={(v) => router.push(url({ profesional: v }))}
            />
            <Filtro
              valor={filtros.box}
              vacio="Todos los boxes"
              opciones={boxes.map((b) => ({ id: b.id, nombre: b.nombre }))}
              onCambio={(v) => router.push(url({ box: v }))}
            />
            <Filtro
              valor={filtros.estado}
              vacio="Estados vigentes"
              opciones={ESTADOS_CITA.map((e) => ({ id: e, nombre: ESTADO_CITA[e].etiqueta }))}
              onCambio={(v) => router.push(url({ estado: v }))}
            />
            {(filtros.profesional || filtros.box || filtros.estado) && (
              <Link href={url({ profesional: undefined, box: undefined, estado: undefined })} className="text-xs font-bold text-rose-600 hover:underline">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </div>

      {aviso && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-800">
          {aviso}
          <button onClick={() => setAviso(null)} className="font-black">
            ✕
          </button>
        </div>
      )}

      {vista === "mes" ? (
        <VistaMes
          dias={dias}
          fecha={fecha}
          hoy={hoy}
          citas={visibles}
          bloqueos={bloqueos}
          urlDia={(d) => url({ vista: "dia", fecha: d })}
          onCita={setDetalle}
        />
      ) : columnas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm font-semibold text-gray-400">
          No hay dentistas activos. Crea usuarios con rol Dentista para usar la agenda.
        </p>
      ) : (
        <Grilla
          columnas={columnas}
          vista={vista}
          hoy={hoy}
          ahoraMin={ahoraMin}
          puedeAgendar={permisos.gestionar}
          onSlot={(col, min) => nueva({ fecha: col.fecha, hora: minutosAHora(min), profesionalId: col.profesionalId })}
          onCita={setDetalle}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        {ESTADOS_CITA.map((e) => (
          <span key={e} className={`px-2 py-0.5 rounded-full ${ESTADO_CITA[e].chip}`}>
            {ESTADO_CITA[e].etiqueta}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded-full bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_4px,#f8fafc_4px,#f8fafc_8px)] text-slate-700">
          Bloqueado
        </span>
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Fuera de horario</span>
        {ocultas > 0 && (
          <span className="text-gray-500 font-semibold">
            · {ocultas} cancelada(s)/reagendada(s) oculta(s) — filtra por estado para verlas
          </span>
        )}
      </div>

      {modal?.tipo === "agendar" && (
        <ModalAgendar
          config={modal.config}
          profesionales={profesionales}
          boxes={boxes}
          puedeSobrecupo={permisos.sobrecupo}
          puedeVerTodos={permisos.verTodos}
          usuarioId={usuarioId}
          onClose={cerrarModal}
          onGuardado={(m) => {
            setAviso(m)
            router.refresh()
          }}
        />
      )}
      {modal?.tipo === "bloqueo" && (
        <ModalBloqueo fecha={fecha < hoy ? hoy : fecha} profesionales={profesionales} boxes={boxes} onClose={cerrarModal} onListo={listo} />
      )}
      {detalle && (
        <DetalleCita
          cita={detalle}
          puedeGestionar={permisos.gestionar}
          verClinico={permisos.clinico}
          onClose={() => setDetalle(null)}
          onReagendar={() => {
            setModal({
              tipo: "agendar",
              config: { clave: Date.now(), cita: detalle, profesionalId: detalle.profesional_id, duracion: detalle.duracion_min, semana: detalle.fecha < hoy ? hoy : detalle.fecha },
            })
            setDetalle(null)
          }}
          onListo={listo}
        />
      )}
    </div>
  )
}

function Filtro({
  valor,
  vacio,
  opciones,
  onCambio,
}: {
  valor?: string
  vacio: string
  opciones: { id: string; nombre: string }[]
  onCambio: (v: string | undefined) => void
}) {
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => onCambio(e.target.value || undefined)}
      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">{vacio}</option>
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  )
}

function Grilla({
  columnas,
  vista,
  hoy,
  ahoraMin,
  puedeAgendar,
  onSlot,
  onCita,
}: {
  columnas: Columna[]
  vista: Vista
  hoy: string
  ahoraMin: number
  puedeAgendar: boolean
  onSlot: (col: Columna, minuto: number) => void
  onCita: (c: CitaAgenda) => void
}) {
  let inicio = 480
  let fin = 1200
  for (const c of columnas) {
    for (const [a, b] of c.tramos ?? []) {
      inicio = Math.min(inicio, a)
      fin = Math.max(fin, b)
    }
    for (const x of c.citas) {
      inicio = Math.min(inicio, x.minuto_inicio)
      fin = Math.max(fin, x.minuto_inicio + x.duracion_min)
    }
  }
  inicio = Math.floor(inicio / 60) * 60
  fin = Math.min(1440, Math.ceil(fin / 60) * 60)
  const alto = (fin - inicio) * PX
  const slots: number[] = []
  for (let m = inicio; m < fin; m += PASO) slots.push(m)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-auto max-h-[78vh]">
      <div className="flex min-w-max">
        <div className="w-14 shrink-0 sticky left-0 z-20 bg-white border-r border-gray-200">
          <div className="h-12 border-b border-gray-200 sticky top-0 bg-white z-10" />
          <div className="relative" style={{ height: alto }}>
            {slots
              .filter((m) => m % 60 === 0)
              .map((m) => (
                <span key={m} className="absolute right-1.5 -translate-y-1/2 text-[10px] font-bold text-gray-400" style={{ top: (m - inicio) * PX }}>
                  {minutosAHora(m)}
                </span>
              ))}
          </div>
        </div>

        {columnas.map((col) => {
          const lanes = asignarCarriles(col.citas)
          const esHoy = col.fecha === hoy
          return (
            <div key={col.clave} className={`flex-1 border-r border-gray-200 last:border-r-0 ${vista === "dia" ? "min-w-[200px]" : "min-w-[140px]"}`}>
              <div className={`h-12 sticky top-0 z-10 border-b border-gray-200 flex flex-col items-center justify-center px-2 ${esHoy && vista === "semana" ? "bg-blue-50" : "bg-white"}`}>
                <span className={`text-sm font-extrabold truncate max-w-full capitalize ${esHoy && vista === "semana" ? "text-blue-700" : "text-gray-900"}`}>
                  {col.titulo}
                </span>
                {col.subtitulo && <span className="text-[10px] font-bold text-gray-400">{col.subtitulo}</span>}
              </div>

              <div className="relative" style={{ height: alto }}>
                {slots.map((m) => {
                  const enHorario = col.tramos === null || col.tramos.some(([a, b]) => m >= a && m < b)
                  const pasado = col.fecha < hoy || (esHoy && m + PASO <= ahoraMin)
                  const clic = puedeAgendar && !pasado
                  return (
                    <div
                      key={m}
                      onClick={clic ? () => onSlot(col, m) : undefined}
                      title={clic ? `Agendar a las ${minutosAHora(m)}` : undefined}
                      className={`absolute inset-x-0 border-b ${m % 60 === 45 ? "border-gray-200" : "border-gray-100"} ${
                        enHorario ? (pasado ? "bg-gray-50/60" : "bg-white") : "bg-gray-100"
                      } ${clic ? "cursor-pointer hover:bg-blue-50" : ""}`}
                      style={{ top: (m - inicio) * PX, height: PASO * PX }}
                    />
                  )
                })}

                {col.bloqueos.map(({ b, desde, hasta }) => {
                  const a = Math.max(desde, inicio)
                  const z = Math.min(hasta, fin)
                  if (z <= a) return null
                  return (
                    <div
                      key={b.id}
                      title={`${TIPO_BLOQUEO[b.tipo]}: ${b.motivo}`}
                      className="absolute inset-x-0 z-[1] border-y border-slate-300 bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_6px,#f8fafc_6px,#f8fafc_12px)] px-2 py-1 overflow-hidden"
                      style={{ top: (a - inicio) * PX, height: (z - a) * PX }}
                    >
                      <span className="text-[10px] font-black uppercase text-slate-600">
                        🚫 {TIPO_BLOQUEO[b.tipo]}
                        {b.profesional && vista === "semana" ? ` · ${b.profesional.nombre_completo}` : ""} · {b.motivo}
                      </span>
                    </div>
                  )
                })}

                {col.citas.map((c) => {
                  const { carril, total } = lanes.get(c.id) ?? { carril: 0, total: 1 }
                  const alturaPx = Math.max(c.duracion_min * PX, 16)
                  const compacta = alturaPx < 34
                  return (
                    <button
                      key={c.id}
                      onClick={() => onCita(c)}
                      className={`absolute z-[2] rounded-lg border-l-4 px-1.5 py-0.5 text-left overflow-hidden shadow-sm hover:brightness-95 hover:z-[3] ${ESTADO_CITA[c.estado].tarjeta}`}
                      style={{
                        top: (c.minuto_inicio - inicio) * PX + 1,
                        height: alturaPx - 2,
                        left: `calc(${(carril * 100) / total}% + 2px)`,
                        width: `calc(${100 / total}% - 4px)`,
                      }}
                    >
                      <p className={`font-extrabold truncate leading-tight ${compacta ? "text-[10px]" : "text-xs"}`}>
                        {c.hora_inicio} {c.paciente_nombre}
                        {c.sobrecupo ? " ⚠" : ""}
                      </p>
                      {!compacta && (
                        <p className="text-[10px] font-semibold opacity-80 truncate">
                          {vista === "semana" ? `${c.profesional_nombre} · ` : ""}
                          {c.prestacion_nombre ?? c.motivo ?? ESTADO_CITA[c.estado].etiqueta}
                          {c.box_nombre ? ` · ${c.box_nombre}` : ""}
                        </p>
                      )}
                    </button>
                  )
                })}

                {esHoy && ahoraMin >= inicio && ahoraMin <= fin && (
                  <div className="absolute inset-x-0 z-[4] pointer-events-none" style={{ top: (ahoraMin - inicio) * PX }}>
                    <div className="h-0.5 bg-rose-500" />
                    <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function asignarCarriles(citas: CitaAgenda[]) {
  const orden = [...citas].sort((a, b) => a.minuto_inicio - b.minuto_inicio)
  const res = new Map<string, { carril: number; total: number }>()
  let grupo: CitaAgenda[] = []
  let finGrupo = -1
  let carriles: number[] = []

  const cerrar = () => {
    const total = Math.max(1, carriles.length)
    for (const c of grupo) res.set(c.id, { carril: res.get(c.id)!.carril, total })
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
    } else carriles[carril] = fin
    res.set(c.id, { carril, total: 1 })
    grupo.push(c)
    finGrupo = Math.max(finGrupo, fin)
  }
  if (grupo.length) cerrar()
  return res
}

function VistaMes({
  dias,
  fecha,
  hoy,
  citas,
  bloqueos,
  urlDia,
  onCita,
}: {
  dias: string[]
  fecha: string
  hoy: string
  citas: CitaAgenda[]
  bloqueos: BloqueoAgenda[]
  urlDia: (d: string) => string
  onCita: (c: CitaAgenda) => void
}) {
  const mes = fecha.slice(0, 7)
  const porDia = new Map<string, CitaAgenda[]>()
  for (const c of citas) porDia.set(c.fecha, [...(porDia.get(c.fecha) ?? []), c])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 text-[11px] font-black uppercase tracking-wider text-gray-500">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="px-2 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const lista = porDia.get(d) ?? []
          const otroMes = d.slice(0, 7) !== mes
          const bloqueado = bloqueos.some((b) => !b.profesional_id && !b.box_id && rangoEnDia(b.inicio, b.fin, d))
          return (
            <div
              key={d}
              className={`min-h-28 border-b border-r border-gray-100 p-1.5 space-y-1 ${otroMes ? "bg-gray-50/70" : ""} ${bloqueado ? "bg-slate-100" : ""}`}
            >
              <div className="flex items-center justify-between">
                <Link
                  href={urlDia(d)}
                  className={`h-6 min-w-6 px-1 rounded-full flex items-center justify-center text-xs font-black hover:bg-blue-100 ${
                    d === hoy ? "bg-blue-600 text-white hover:bg-blue-700" : otroMes ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {Number(d.slice(8))}
                </Link>
                {lista.length > 0 && <span className="text-[10px] font-bold text-gray-400">{lista.length}</span>}
              </div>
              {lista.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onCita(c)}
                  className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-bold border-l-2 ${ESTADO_CITA[c.estado].tarjeta}`}
                >
                  {c.hora_inicio} {c.paciente_nombre}
                </button>
              ))}
              {lista.length > 4 && (
                <Link href={urlDia(d)} className="block text-[10px] font-bold text-blue-600 hover:underline">
                  +{lista.length - 4} más
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


"use client"

import Link from "next/link"
import { formatearPesos } from "@/lib/formato"
import { partesChile } from "@/lib/fechas-agenda"
import { ESTADO_CITA, siguientesEstados, type CitaAgenda, type EstadoCita, type InfoPaciente } from "@/types/cita"

export type AccionesCita = {
  onCambiarEstado: (cita: CitaAgenda, estado: EstadoCita) => void
  onReprogramar: (cita: CitaAgenda) => void
  onRecordatorio: (cita: CitaAgenda) => void
  onInasistencia: (cita: CitaAgenda) => void
  onDetalle: (cita: CitaAgenda) => void
}

type Comunes = {
  cita: CitaAgenda
  info?: InfoPaciente
  ahoraMs: number
  puedeGestionar: boolean
  verFinanzas: boolean
  acciones: AccionesCita
}

const AVATARES = [
  "bg-blue-100 text-blue-700 border-l-blue-500",
  "bg-red-100 text-red-700 border-l-red-500",
  "bg-emerald-100 text-emerald-700 border-l-emerald-500",
  "bg-purple-100 text-purple-700 border-l-purple-500",
  "bg-amber-100 text-amber-700 border-l-amber-500",
]
function colorAvatar(nombre: string) {
  let h = 0
  for (let i = 0; i < nombre.length; i++) h = nombre.charCodeAt(i) + ((h << 5) - h)
  return AVATARES[Math.abs(h) % AVATARES.length]
}
const iniciales = (c: CitaAgenda) => `${c.paciente_nombres.charAt(0)}${c.paciente_apellidos.charAt(0)}`.toUpperCase()

function semaforo(c: CitaAgenda, ahoraMs: number) {
  if (c.estado !== "EN_ESPERA" || !c.hora_llegada) return null
  const min = Math.max(0, Math.floor((ahoraMs - new Date(c.hora_llegada).getTime()) / 60000))
  const nivel = min >= 20 ? "rojo" : min >= 15 ? "naranja" : "verde"
  return { min, nivel, llegada: horaChile(c.hora_llegada) }
}
const horaChile = (iso: string) => {
  const m = partesChile(iso).minutos
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}
const badgeSemaforo = (n: string) =>
  n === "rojo" ? "bg-red-600 text-white animate-pulse" : n === "naranja" ? "bg-orange-500 text-white" : "bg-amber-100 text-amber-800"
const fondoSemaforo = (n?: string) =>
  n === "rojo" ? "!bg-red-50 !border-red-400 ring-2 ring-red-300" : n === "naranja" ? "!bg-orange-50 !border-orange-300 ring-2 ring-orange-200" : ""
const estiloFaltas = (n: number) =>
  n >= 3 ? "bg-red-600 text-white border-red-700" : n === 2 ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"

const badge = "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1"

function SelectorEstado({ cita, habilitado, onCambiar, compacto }: { cita: CitaAgenda; habilitado: boolean; onCambiar: (e: EstadoCita) => void; compacto?: boolean }) {
  const estilo = ESTADO_CITA[cita.estado]
  const opciones = habilitado ? siguientesEstados(cita.estado) : []
  const sem = cita.estado === "EN_ESPERA" && cita.hora_llegada ? ` desde ${horaChile(cita.hora_llegada)}` : ""
  return (
    <div className={`relative inline-flex items-center gap-1.5 rounded-full border shadow-sm ${estilo.pill} ${compacto ? "px-2 py-0.5" : "px-3 py-1.5"}`}>
      <span className={compacto ? "text-[10px]" : "text-xs"}>{estilo.icono}</span>
      {opciones.length === 0 ? (
        <span className={`font-black uppercase ${compacto ? "text-[9px]" : "text-[11px]"}`}>
          {estilo.etiqueta}
          {sem}
        </span>
      ) : (
        <>
          <select
            value={cita.estado}
            onChange={(e) => onCambiar(e.target.value as EstadoCita)}
            className={`appearance-none bg-transparent outline-none cursor-pointer pr-4 font-black uppercase ${compacto ? "text-[9px]" : "text-[11px]"}`}
          >
            <option value={cita.estado} className="text-gray-800 bg-white">
              {estilo.etiqueta}
              {sem}
            </option>
            {opciones.map((e) => (
              <option key={e} value={e} className="text-gray-800 bg-white">
                → {ESTADO_CITA[e].etiqueta}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 text-[9px] opacity-70">▼</span>
        </>
      )}
    </div>
  )
}

function ChipFinanzas({ cita, info }: { cita: CitaAgenda; info?: InfoPaciente }) {
  if (!info || info.totalTratamientos === 0) {
    return <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider">Sin saldo</span>
  }
  if (info.porCobrar > 0) {
    return (
      <Link
        href={`/pacientes/${cita.paciente_id}/pagos`}
        className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse"
        title="Lo realizado y aún no pagado"
      >
        🔔 Por cobrar: {formatearPesos(info.porCobrar)}
      </Link>
    )
  }
  if (info.deuda > 0) {
    return (
      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider" title="Saldo de sus tratamientos">
        Saldo tratamientos: {formatearPesos(info.deuda)}
      </span>
    )
  }
  return <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider">Saldado</span>
}

export function TarjetaCitaDia({ cita: c, info, ahoraMs, puedeGestionar, verFinanzas, acciones }: Comunes) {
  const sem = semaforo(c, ahoraMs)
  const estilo = ESTADO_CITA[c.estado]
  const color = colorAvatar(c.paciente_nombre)
  const vigente = c.estado === "AGENDADA" || c.estado === "CONFIRMADA"
  const btn = "px-2.5 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 text-sm leading-none"

  return (
    <div className="relative mb-5 group">
      <div className="md:absolute md:-left-[140px] md:top-4 md:w-[80px] md:text-right flex md:block items-baseline gap-2 mb-1 md:mb-0 px-1 md:px-0">
        <p className="text-xl font-black text-gray-900 leading-none tracking-tight">{c.hora_inicio}</p>
        <p className="text-xs font-semibold text-gray-400 md:mt-1">{c.hora_fin}</p>
      </div>
      <div
        className={`hidden md:block absolute -left-[45px] top-5 w-3 h-3 rounded-full bg-white border-[3px] shadow-[0_0_0_6px_#f9fafb] z-20 ${
          c.sobrecupo ? "border-red-500" : "border-blue-500"
        }`}
      />

      <div
        className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 border-l-4 ${color.split(" ")[2]} p-5 flex flex-col gap-4 ${
          c.sobrecupo ? "!border-r-red-100 !border-t-red-100 !border-b-red-100" : ""
        } ${fondoSemaforo(sem?.nivel)}`}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${color}`}>{iniciales(c)}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {sem && (
                  <span className={`${badge} ${badgeSemaforo(sem.nivel)}`} title={`Llegó a las ${sem.llegada}`}>
                    ⏱ Esperando {sem.min} min
                  </span>
                )}
                {info && info.inasistencias > 0 && (
                  <span className={`${badge} border ${estiloFaltas(info.inasistencias)}`} title="Citas 'No asistió' en los últimos 12 meses">
                    🚫 {info.inasistencias} inasistencia{info.inasistencias === 1 ? "" : "s"}
                  </span>
                )}
                {c.sobrecupo && (
                  <span className={`${badge} bg-red-500 text-white animate-pulse`} title={c.motivo_sobrecupo ?? ""}>
                    ⚠ Sobrecupo
                  </span>
                )}
                {c.cita_original_id && <span className={`${badge} bg-violet-50 text-violet-700 border border-violet-100`}>🔁 Reprogramada</span>}
                {c.recordatorio_enviado_en && vigente && (
                  <span className={`${badge} bg-emerald-50 text-emerald-700 border border-emerald-100`}>💬 Recordatorio enviado</span>
                )}
              </div>
              <Link href={`/pacientes/${c.paciente_id}`} className="text-base font-black text-gray-900 uppercase tracking-wide leading-tight hover:text-blue-700">
                {c.paciente_nombre}
              </Link>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs font-semibold text-gray-400 uppercase">
                <span>RUT: {c.paciente_rut}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>📞 {c.paciente_telefono || "Sin teléfono"}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>👤 {c.profesional_nombre}</span>
                {c.box_nombre && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>🚪 {c.box_nombre}</span>
                  </>
                )}
              </div>
              <p className="text-[9px] font-bold text-gray-400 tracking-wider mt-1">
                AGENDÓ: {(c.creado_por_nombre ?? "—").split(" ")[0].toUpperCase()} · {c.duracion_min} MIN
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {c.tipo_atencion_nombre && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                    🏷 {c.tipo_atencion_nombre}
                  </span>
                )}
                {c.motivo && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-gray-50 text-gray-600 border border-gray-200">
                    📝 {c.motivo}
                  </span>
                )}
                {c.tratamiento_nombre && (
                  <Link
                    href={`/pacientes/${c.paciente_id}/tratamientos/${c.presupuesto_id}`}
                    className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-100 hover:bg-cyan-100"
                  >
                    📋 Trat. N° {c.tratamiento_numero} · {c.tratamiento_nombre}
                  </Link>
                )}
                {c.prestacion_nombre && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    🦷 {c.prestacion_nombre}
                  </span>
                )}
              </div>
            </div>
          </div>
          <SelectorEstado cita={c} habilitado={puedeGestionar} onCambiar={(e) => acciones.onCambiarEstado(c, e)} />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 border-t border-gray-50 gap-3">
          <div>{verFinanzas ? <ChipFinanzas cita={c} info={info} /> : <span className={`text-[10px] font-black uppercase ${estilo.texto}`}>{estilo.etiqueta}</span>}</div>

          <div className="flex flex-wrap items-center gap-1.5">
            {puedeGestionar && vigente && (
              <button onClick={() => acciones.onReprogramar(c)} className={btn} title="Reprogramar">
                📅
              </button>
            )}
            {puedeGestionar && vigente && (
              <button onClick={() => acciones.onRecordatorio(c)} className={btn} title="Enviar recordatorio por WhatsApp">
                💬
              </button>
            )}
            {verFinanzas && (
              <Link href={`/pacientes/${c.paciente_id}/pagos`} className={btn} title="Caja / cobrar">
                💳
              </Link>
            )}
            <button onClick={() => acciones.onDetalle(c)} className={btn} title="Detalle e historial">
              ⋯
            </button>
            {c.estado === "NO_ASISTIO" && puedeGestionar && (
              <button
                onClick={() => acciones.onInasistencia(c)}
                className="px-3 py-2 border border-rose-200 bg-rose-50 rounded-lg text-rose-600 hover:bg-rose-100 text-[10px] font-black uppercase tracking-wider"
              >
                💬 Reagendar por WhatsApp
              </button>
            )}
            <Link
              href={`/pacientes/${c.paciente_id}`}
              className="text-[10px] font-black text-blue-600 px-3 py-2 uppercase tracking-wider hover:bg-blue-50 border border-blue-100 rounded-lg"
            >
              📋 Ficha
            </Link>
            <Link
              href={`/pacientes/${c.paciente_id}/tratamientos`}
              className="text-[10px] font-black text-cyan-700 px-3 py-2 uppercase tracking-wider hover:bg-cyan-50 border border-cyan-100 rounded-lg"
            >
              🦷 Tratamientos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TarjetaCitaSemana({ cita: c, info, ahoraMs, puedeGestionar, acciones }: Comunes) {
  const sem = semaforo(c, ahoraMs)
  const color = colorAvatar(c.paciente_nombre)
  return (
    <div
      onClick={() => acciones.onDetalle(c)}
      className={`bg-white p-3 rounded-xl border border-gray-200 border-l-4 ${color.split(" ")[2]} shadow-sm hover:shadow-md cursor-pointer ${
        c.sobrecupo ? "bg-red-50/40" : ""
      } ${fondoSemaforo(sem?.nivel)}`}
    >
      <div className="flex flex-wrap gap-1 mb-1">
        {sem && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${badgeSemaforo(sem.nivel)}`}>⏱ {sem.min} min</span>}
        {info && info.inasistencias > 0 && (
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${estiloFaltas(info.inasistencias)}`}>🚫 {info.inasistencias}</span>
        )}
        {c.sobrecupo && <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded">SOBRECUPO</span>}
        {info && info.porCobrar > 0 && <span className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded">POR COBRAR</span>}
      </div>
      <p className="text-xs font-black text-gray-900 leading-tight truncate uppercase">{c.paciente_nombre}</p>
      <p className="text-[10px] font-semibold text-gray-400 truncate">
        {c.profesional_nombre}
        {c.motivo ? ` · ${c.motivo}` : ""}
      </p>
      <div className="flex items-center justify-between mt-2 gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] font-black text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-md">{c.hora_inicio}</span>
        <SelectorEstado cita={c} habilitado={puedeGestionar} onCambiar={(e) => acciones.onCambiarEstado(c, e)} compacto />
      </div>
    </div>
  )
}

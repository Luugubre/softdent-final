"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { cambiarEstadoCita, historialCita } from "@/app/agenda/actions"
import { Modal } from "@/components/odontograma/Modales"
import { enlaceWhatsapp } from "@/lib/clinica"
import { fechaTitulo } from "@/lib/fechas-agenda"
import { formatearFechaHora } from "@/lib/formato"
import { mensajeRecordatorio } from "@/lib/mensajes-agenda"
import { ESTADO_CITA, puedePasarA, type CitaAgenda, type EstadoCita } from "@/types/cita"

type Historial = Awaited<ReturnType<typeof historialCita>>

const ACCIONES: { estado: EstadoCita; texto: string; estilo: string }[] = [
  { estado: "CONFIRMADA", texto: "📞 Confirmar", estilo: "bg-blue-600 hover:bg-blue-700 text-white" },
  { estado: "EN_ESPERA", texto: "⏳ Llegó (sala de espera)", estilo: "bg-amber-400 hover:bg-amber-500 text-amber-950" },
  { estado: "EN_ATENCION", texto: "🦷 Pasa a box", estilo: "bg-fuchsia-600 hover:bg-fuchsia-700 text-white" },
  { estado: "REALIZADA", texto: "✅ Atendido", estilo: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { estado: "NO_ASISTIO", texto: "🚫 No asistió", estilo: "bg-slate-200 hover:bg-slate-300 text-slate-800" },
]

export function DetalleCita({
  cita,
  puedeGestionar,
  verClinico,
  onClose,
  onReagendar,
  onListo,
}: {
  cita: CitaAgenda
  puedeGestionar: boolean
  verClinico: boolean
  onClose: () => void
  onReagendar: () => void
  onListo: (mensaje: string) => void
}) {
  const [historial, setHistorial] = useState<Historial | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()
  const estilo = ESTADO_CITA[cita.estado]
  const whatsapp = enlaceWhatsapp(cita.paciente_telefono, mensajeRecordatorio([cita]))

  useEffect(() => {
    historialCita(cita.id).then(setHistorial)
  }, [cita.id])

  function cambiar(estado: EstadoCita) {
    let motivo: string | undefined
    if (estado === "CANCELADA") {
      const m = window.prompt("Motivo de la anulación (obligatorio):")
      if (!m?.trim()) return
      motivo = m
    }
    setError(null)
    startTransition(async () => {
      const res = await cambiarEstadoCita(cita.id, estado, motivo)
      if (res.ok) onListo(res.mensaje)
      else setError(res.mensaje)
    })
  }

  return (
    <Modal titulo={`Cita N° ${cita.numero}`} onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/pacientes/${cita.paciente_id}`} className="text-xl font-black text-gray-900 hover:text-blue-700 hover:underline">
            {cita.paciente_nombre}
          </Link>
          <p className="text-sm font-semibold text-gray-500">
            {cita.paciente_rut}
            {cita.paciente_telefono ? ` · ${cita.paciente_telefono}` : ""}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap ${estilo.chip}`}>{estilo.etiqueta}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm rounded-xl bg-gray-50 border border-gray-200 p-3">
        <div className="col-span-2">
          <dt className="text-[11px] font-black uppercase tracking-wider text-gray-500">Cuándo</dt>
          <dd className="font-bold text-gray-900 capitalize">
            {fechaTitulo(cita.fecha)} · {cita.hora_inicio} a {cita.hora_fin} ({cita.duracion_min} min)
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-black uppercase tracking-wider text-gray-500">Profesional</dt>
          <dd className="font-semibold text-gray-900">{cita.profesional_nombre}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-black uppercase tracking-wider text-gray-500">Box</dt>
          <dd className="font-semibold text-gray-900">{cita.box_nombre ?? "—"}</dd>
        </div>
        {cita.prestacion_nombre && (
          <div className="col-span-2">
            <dt className="text-[11px] font-black uppercase tracking-wider text-gray-500">Prestación</dt>
            <dd className="font-semibold text-gray-900">{cita.prestacion_nombre}</dd>
          </div>
        )}
        {cita.motivo && (
          <div className="col-span-2">
            <dt className="text-[11px] font-black uppercase tracking-wider text-gray-500">Motivo / notas</dt>
            <dd className="font-medium text-gray-800">{cita.motivo}</dd>
          </div>
        )}
        {cita.sobrecupo && (
          <div className="col-span-2 text-xs font-bold text-orange-700">⚠ Sobrecupo: {cita.motivo_sobrecupo}</div>
        )}
        {cita.motivo_cancelacion && (
          <div className="col-span-2 text-xs font-bold text-rose-700">Anulada: {cita.motivo_cancelacion}</div>
        )}
      </dl>

      {puedeGestionar && (
        <div className="flex flex-wrap gap-2">
          {ACCIONES.filter((a) => puedePasarA(cita.estado, a.estado)).map((a) => (
            <button
              key={a.estado}
              disabled={pendiente}
              onClick={() => cambiar(a.estado)}
              className={`px-3 py-2 rounded-xl text-sm font-bold disabled:opacity-50 ${a.estilo}`}
            >
              {a.texto}
            </button>
          ))}
          {puedePasarA(cita.estado, "REAGENDADA") && (
            <button
              disabled={pendiente}
              onClick={onReagendar}
              className="px-3 py-2 rounded-xl text-sm font-bold bg-purple-100 text-purple-800 hover:bg-purple-200 disabled:opacity-50"
            >
              📅 Reprogramar
            </button>
          )}
          {puedePasarA(cita.estado, "CANCELADA") && (
            <button
              disabled={pendiente}
              onClick={() => cambiar("CANCELADA")}
              className="px-3 py-2 rounded-xl text-sm font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              Anular cita
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/pacientes/${cita.paciente_id}`} className="px-3 py-1.5 rounded-lg font-bold text-blue-700 bg-blue-50 hover:bg-blue-100">
          Ver ficha
        </Link>
        {verClinico && (
          <Link
            href={`/pacientes/${cita.paciente_id}/odontograma`}
            className="px-3 py-1.5 rounded-lg font-bold text-blue-700 bg-blue-50 hover:bg-blue-100"
          >
            🦷 Odontograma
          </Link>
        )}
        <Link
          href={`/pacientes/${cita.paciente_id}/pagos`}
          className="px-3 py-1.5 rounded-lg font-bold text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          💳 Pagos
        </Link>
        {whatsapp && ["AGENDADA", "CONFIRMADA"].includes(cita.estado) && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg font-bold text-green-800 bg-green-50 hover:bg-green-100"
          >
            💬 Recordar por WhatsApp
          </a>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}

      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Historial de la cita</p>
        {historial === null ? (
          <p className="text-xs text-gray-400">Cargando…</p>
        ) : (
          <ol className="space-y-1 text-xs">
            {historial.map((h) => (
              <li key={h.id} className="flex gap-2">
                <span className="text-gray-400 whitespace-nowrap">{formatearFechaHora(h.fecha)}</span>
                <span className="font-semibold text-gray-700">
                  {h.estado_anterior ? `${ESTADO_CITA[h.estado_anterior].etiqueta} → ` : ""}
                  {ESTADO_CITA[h.estado_nuevo].etiqueta}
                  {h.usuario ? ` · ${h.usuario.nombre_completo}` : ""}
                  {h.motivo ? ` · ${h.motivo}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        {cita.cita_original_id && <p className="mt-1 text-xs font-semibold text-purple-700">Esta cita viene de una reprogramación.</p>}
      </div>
    </Modal>
  )
}

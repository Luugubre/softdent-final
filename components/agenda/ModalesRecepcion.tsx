"use client"

import { useEffect, useState, useTransition } from "react"
import { buscarHorasLibres, citasParaRecordar, marcarRecordatorio } from "@/app/agenda/actions"
import { Ventana } from "@/components/agenda/Ventana"
import { enlaceWhatsapp } from "@/lib/clinica"
import { diaSemana, fechaTitulo, hoyEnChile, sumarDias } from "@/lib/fechas-agenda"
import { mensajeRecordatorio } from "@/lib/mensajes-agenda"
import type { CitaAgenda, HoraLibre, ProfesionalAgenda } from "@/types/cita"

// =====================================================================
// ¿CUÁNDO HAY HORA? — próximas horas libres
// =====================================================================
export function ModalBuscarHora({
  profesionales,
  profesionalInicial,
  puedeVerTodos,
  onElegir,
  onClose,
}: {
  profesionales: ProfesionalAgenda[]
  profesionalInicial?: string
  puedeVerTodos: boolean
  onElegir: (h: HoraLibre, duracion: number) => void
  onClose: () => void
}) {
  const hoy = hoyEnChile()
  const [filtro, setFiltro] = useState({
    profesional: profesionalInicial ?? "",
    duracion: 30,
    turno: "cualquiera" as "cualquiera" | "manana" | "tarde",
    desde: hoy,
    limite: 10,
  })
  const [horas, setHoras] = useState<HoraLibre[] | null>(null)
  const [pendiente, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      setHoras(
        await buscarHorasLibres({
          duracion: filtro.duracion,
          desde: filtro.desde,
          profesionalId: filtro.profesional || null,
          turno: filtro.turno,
          limite: filtro.limite,
        })
      )
    })
  }, [filtro])

  const porDia = new Map<string, HoraLibre[]>()
  for (const h of horas ?? []) porDia.set(h.fecha, [...(porDia.get(h.fecha) ?? []), h])
  const sel = "p-2.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl outline-none"

  return (
    <Ventana titulo="¿Cuándo hay hora?" subtitulo="Próximas horas libres según horario, citas y bloqueos" icono="🔍" ancho="max-w-2xl" onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select
            value={filtro.profesional}
            disabled={!puedeVerTodos}
            onChange={(e) => setFiltro({ ...filtro, profesional: e.target.value, limite: 10 })}
            className={sel}
          >
            {puedeVerTodos && <option value="">Todos los especialistas</option>}
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_completo}
              </option>
            ))}
          </select>
          <select value={filtro.duracion} onChange={(e) => setFiltro({ ...filtro, duracion: Number(e.target.value), limite: 10 })} className={sel}>
            {[15, 30, 45, 60, 90, 120].map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
          <select value={filtro.turno} onChange={(e) => setFiltro({ ...filtro, turno: e.target.value as typeof filtro.turno, limite: 10 })} className={sel}>
            <option value="cualquiera">Cualquier hora</option>
            <option value="manana">Mañana (antes de 13:00)</option>
            <option value="tarde">Tarde (desde 13:00)</option>
          </select>
          <input type="date" min={hoy} value={filtro.desde} onChange={(e) => e.target.value && setFiltro({ ...filtro, desde: e.target.value, limite: 10 })} className={sel} />
        </div>

        {horas === null || (pendiente && horas.length === 0) ? (
          <p className="text-center text-sm font-bold text-gray-400 py-10">Buscando horas…</p>
        ) : horas.length === 0 ? (
          <p className="text-center text-sm font-bold text-gray-400 py-10">No se encontraron horas libres en los próximos 4 meses.</p>
        ) : (
          <div className="space-y-3">
            {[...porDia.entries()].map(([fecha, lista]) => (
              <div key={fecha} className="bg-white rounded-2xl border border-gray-200 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2 capitalize">
                  {fecha === hoy ? "Hoy · " : fecha === sumarDias(hoy, 1) ? "Mañana · " : ""}
                  {fechaTitulo(fecha, { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <div className="grid gap-1.5">
                  {lista.map((h) => (
                    <div key={`${h.profesional_id}-${h.hora}`} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                      <span className="text-sm font-black text-gray-900">{h.hora}</span>
                      <span className="flex-1 text-sm font-semibold text-gray-600 truncate">{h.profesional_nombre}</span>
                      <button
                        onClick={() => onElegir(h, filtro.duracion)}
                        className="px-3 py-1.5 rounded-lg text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700"
                      >
                        + Agendar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              disabled={pendiente}
              onClick={() => setFiltro({ ...filtro, limite: filtro.limite + 10 })}
              className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
            >
              {pendiente ? "Buscando…" : "Ver más opciones ↓"}
            </button>
          </div>
        )}
      </div>
    </Ventana>
  )
}

// =====================================================================
// RECORDAR CITAS (por defecto: próximo día hábil)
// =====================================================================
export function ModalRecordatorios({ profesionalId, onClose }: { profesionalId?: string; onClose: () => void }) {
  const hoy = hoyEnChile()
  const manana = sumarDias(hoy, 1)
  const [fecha, setFecha] = useState(diaSemana(manana) === 7 ? sumarDias(manana, 1) : manana)
  const [citas, setCitas] = useState<CitaAgenda[] | null>(null)
  const [enviados, setEnviados] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  useEffect(() => {
    let vigente = true
    setCitas(null)
    citasParaRecordar(fecha, profesionalId).then((c) => vigente && setCitas(c))
    return () => {
      vigente = false
    }
  }, [fecha, profesionalId])

  // Un mensaje por paciente (si tiene varias citas ese día, van juntas)
  const porPaciente = new Map<string, CitaAgenda[]>()
  for (const c of citas ?? []) porPaciente.set(c.paciente_id, [...(porPaciente.get(c.paciente_id) ?? []), c])
  const grupos = [...porPaciente.values()]
  const pendientes = grupos.filter((g) => !g.every((c) => c.recordatorio_enviado_en) && !enviados.has(g[0].paciente_id)).length

  function enviar(grupo: CitaAgenda[]) {
    const enlace = enlaceWhatsapp(grupo[0].paciente_telefono, mensajeRecordatorio(grupo))
    if (!enlace) return
    window.open(enlace, "_blank")
    setEnviados(new Set([...enviados, grupo[0].paciente_id]))
    startTransition(async () => {
      await marcarRecordatorio(grupo.map((c) => c.id))
    })
  }

  return (
    <Ventana
      titulo="Recordar citas"
      subtitulo={`${pendientes} paciente(s) sin recordatorio`}
      icono="🔔"
      ancho="max-w-2xl"
      onClose={onClose}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <input type="date" min={hoy} value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="p-2.5 text-sm font-bold bg-white border border-gray-200 rounded-xl" />
          <span className="text-sm font-bold text-gray-500 capitalize">{fechaTitulo(fecha, { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        {citas === null ? (
          <p className="text-center text-sm font-bold text-gray-400 py-10">Cargando…</p>
        ) : grupos.length === 0 ? (
          <p className="text-center text-sm font-bold text-gray-400 py-10">No hay citas por recordar ese día.</p>
        ) : (
          <ul className="space-y-2">
            {grupos.map((g) => {
              const c0 = g[0]
              const listo = enviados.has(c0.paciente_id) || g.every((c) => c.recordatorio_enviado_en)
              const tieneTelefono = !!enlaceWhatsapp(c0.paciente_telefono, "x")
              return (
                <li key={c0.paciente_id} className={`flex items-center gap-3 rounded-2xl border p-3 ${listo ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900 uppercase truncate">{c0.paciente_nombre}</p>
                    <p className="text-xs font-semibold text-gray-500">
                      {g.map((c) => `${c.hora_inicio} · ${c.profesional_nombre}`).join("  |  ")}
                      {c0.estado === "CONFIRMADA" ? " · ya confirmada" : ""}
                    </p>
                    {!tieneTelefono && <p className="text-[11px] font-bold text-amber-600">Sin teléfono válido</p>}
                  </div>
                  {listo ? (
                    <span className="text-xs font-black text-emerald-700">✔ Enviado</span>
                  ) : (
                    <button
                      disabled={!tieneTelefono}
                      onClick={() => enviar(g)}
                      className="px-3 py-2 rounded-xl text-xs font-black uppercase text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40"
                    >
                      💬 Enviar
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-[11px] font-semibold text-gray-400">
          El mensaje pide responder “SÍ”. Cuando el paciente confirme, cambia su cita a “Confirmada” en la agenda.
        </p>
      </div>
    </Ventana>
  )
}

// =====================================================================
// CITAS ANULADAS DEL PERÍODO
// =====================================================================
export function ModalAnuladas({ citas, mostrarFecha, onClose }: { citas: CitaAgenda[]; mostrarFecha: boolean; onClose: () => void }) {
  return (
    <Ventana titulo="Citas anuladas" subtitulo={`${citas.length} en el período`} icono="🗑" ancho="max-w-xl" onClose={onClose}>
      <ul className="p-5 space-y-2">
        {citas.map((c) => (
          <li key={c.id} className="rounded-2xl bg-white border border-gray-200 p-3">
            <p className="font-black text-gray-900 uppercase">
              {mostrarFecha ? `${fechaTitulo(c.fecha, { weekday: "short", day: "numeric" })} · ` : ""}
              {c.hora_inicio} · {c.paciente_nombre}
            </p>
            <p className="text-xs font-semibold text-gray-500">
              {c.profesional_nombre}
              {c.motivo ? ` · ${c.motivo}` : ""}
            </p>
            {c.motivo_cancelacion && <p className="text-xs font-bold text-rose-700 mt-1">Motivo: {c.motivo_cancelacion}</p>}
          </li>
        ))}
      </ul>
    </Ventana>
  )
}

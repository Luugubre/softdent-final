"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { registrarContactoInasistencia } from "@/app/agenda/inasistencias/actions"
import { NOMBRE_CLINICA, enlaceWhatsapp } from "@/lib/clinica"
import { fechaTitulo } from "@/lib/fechas-agenda"
import type { Inasistencia, ResumenInasistencias } from "@/lib/inasistencias"

type Filtro = "TODAS" | "SIN_HORA" | "REINCIDENTES" | "SIN_CONTACTO"

const fechaCorta = (f: string) => fechaTitulo(f, { weekday: "short", day: "numeric", month: "short" })
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })

function mensaje(i: Inasistencia) {
  const nombre = i.paciente_nombre.trim().split(/\s+/)[0] ?? ""
  return (
    `Hola ${nombre}, te escribimos de ${NOMBRE_CLINICA}. El ${fechaTitulo(i.fecha, { weekday: "long", day: "numeric", month: "long" })} ` +
    `te esperábamos a las ${i.hora} hrs para tu cita con ${i.profesional_nombre} y no pudiste asistir.\n\n` +
    "¿Te gustaría que te busquemos una nueva hora? Respóndenos este mensaje y te ayudamos a reagendar.\n\n¡Saludos! 🦷"
  )
}

export function ListaInasistencias({
  datos,
  desde,
  hasta,
  hoy,
  profesional,
  verTodos,
}: {
  datos: ResumenInasistencias
  desde: string
  hasta: string
  hoy: string
  profesional: string
  verTodos: boolean
}) {
  const router = useRouter()
  const [rango, setRango] = useState({ desde, hasta, profesional })
  const [filtro, setFiltro] = useState<Filtro>("TODAS")
  const [busqueda, setBusqueda] = useState("")
  const [contactando, setContactando] = useState<Inasistencia | null>(null)

  const { lista, atendidas } = datos
  const pacientes = new Set(lista.map((i) => i.paciente_id)).size
  const reincidentes = new Set(lista.filter((i) => i.inasistencias_total >= 2).map((i) => i.paciente_id)).size
  const sinHora = new Set(lista.filter((i) => !i.proxima_cita).map((i) => i.paciente_id)).size
  const tasa = lista.length + atendidas > 0 ? Math.round((lista.length / (lista.length + atendidas)) * 1000) / 10 : 0

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return lista.filter((i) => {
      if (filtro === "SIN_HORA" && i.proxima_cita) return false
      if (filtro === "REINCIDENTES" && i.inasistencias_total < 2) return false
      if (filtro === "SIN_CONTACTO" && i.ultimo_contacto) return false
      if (!q) return true
      return [i.paciente_nombre, i.paciente_rut, i.profesional_nombre, i.prestacion ?? ""].some((t) => t.toLowerCase().includes(q))
    })
  }, [lista, filtro, busqueda])

  function aplicar(e: React.FormEvent) {
    e.preventDefault()
    const p = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta })
    if (rango.profesional) p.set("profesional", rango.profesional)
    router.push(`/agenda/inasistencias?${p}`)
  }

  const tarjeta = "bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
  const etiqueta = "block text-[10px] font-black uppercase text-gray-400 mb-1"
  const control = "w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold bg-white"

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={tarjeta}>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Inasistencias</p>
          <p className="mt-1 text-2xl font-black text-rose-600">{lista.length}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">
            {pacientes} paciente{pacientes === 1 ? "" : "s"}
          </p>
        </div>
        <div className={tarjeta}>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Tasa de inasistencia</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{tasa.toLocaleString("es-CL")}%</p>
          <p className="mt-1 text-xs font-medium text-gray-500">Sobre {lista.length + atendidas} citas cerradas</p>
        </div>
        <div className={tarjeta}>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Sin hora futura</p>
          <p className="mt-1 text-2xl font-black text-amber-600">{sinHora}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">Pacientes por reagendar</p>
        </div>
        <div className={tarjeta}>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Reincidentes</p>
          <p className="mt-1 text-2xl font-black text-purple-600">{reincidentes}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">Con 2 o más inasistencias</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className={etiqueta}>Buscar</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Paciente, RUT, dentista o prestación…"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium"
          />
        </div>
        <div>
          <label className={etiqueta}>Mostrar</label>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className={control}>
            <option value="TODAS">Todas</option>
            <option value="SIN_HORA">Sin hora futura</option>
            <option value="SIN_CONTACTO">Sin contactar</option>
            <option value="REINCIDENTES">Reincidentes</option>
          </select>
        </div>
        <form onSubmit={aplicar} className="md:col-span-3 grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          {verTodos && (
            <div className="col-span-2 md:col-span-1">
              <label className={etiqueta}>Dentista</label>
              <select value={rango.profesional} onChange={(e) => setRango({ ...rango, profesional: e.target.value })} className={control}>
                <option value="">Todos</option>
                {datos.profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={etiqueta}>Desde</label>
            <input type="date" max={hoy} value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} className={control} />
          </div>
          <div>
            <label className={etiqueta}>Hasta</label>
            <input type="date" max={hoy} value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} className={control} />
          </div>
          <button type="submit" className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800">
            Ver
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
              <tr>
                <th className="px-4 py-3">Cita perdida</th>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Dentista</th>
                <th className="px-4 py-3 text-center">Faltas</th>
                <th className="px-4 py-3">Próxima hora</th>
                <th className="px-4 py-3">Último contacto</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 font-medium">
                    {lista.length === 0 ? "No hay inasistencias en el período. 🎉" : "Ninguna inasistencia coincide con el filtro."}
                  </td>
                </tr>
              ) : (
                visibles.map((i) => {
                  const wa = enlaceWhatsapp(i.telefono, mensaje(i))
                  return (
                    <tr key={i.cita_id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-gray-900 capitalize">{fechaCorta(i.fecha)}</div>
                        <div className="text-[11px] text-gray-500">
                          {i.hora} hrs · N° {i.numero}
                          {i.prestacion ? ` · ${i.prestacion}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <Link href={`/pacientes/${i.paciente_id}`} className="font-bold text-gray-900 hover:underline">
                          {i.paciente_nombre}
                        </Link>
                        <div className="text-[10px] font-mono text-gray-400 whitespace-nowrap">{i.paciente_rut}</div>
                        <div className="text-[10px] font-mono text-gray-400 whitespace-nowrap">{i.telefono ?? "Sin teléfono"}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-700">{i.profesional_nombre}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                            i.inasistencias_total >= 3
                              ? "bg-rose-100 text-rose-800"
                              : i.inasistencias_total === 2
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-700"
                          }`}
                          title="Total de inasistencias del paciente"
                        >
                          {i.inasistencias_total}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {i.proxima_cita ? (
                          <span className="font-bold text-emerald-700">✓ {fechaHora(i.proxima_cita)}</span>
                        ) : (
                          <span className="font-bold text-amber-700">Sin hora</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {i.ultimo_contacto ? (
                          <>
                            <div className="text-[11px] font-bold text-gray-700">
                              {fechaHora(i.ultimo_contacto.fecha)} · {i.ultimo_contacto.usuario}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate" title={i.ultimo_contacto.nota}>
                              {i.ultimo_contacto.nota}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-stretch gap-1 min-w-[120px]">
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-center text-[11px] font-bold text-white hover:bg-emerald-700"
                            >
                              WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setContactando(i)}
                            className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                          >
                            Registrar contacto
                          </button>
                          {!i.proxima_cita && (
                            <Link
                              href={`/agenda?agendar=${i.paciente_id}`}
                              className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-center text-[11px] font-bold text-white hover:bg-blue-700"
                            >
                              Reagendar
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {contactando && <ModalContacto inasistencia={contactando} onClose={() => setContactando(null)} />}
    </div>
  )
}

function ModalContacto({ inasistencia, onClose }: { inasistencia: Inasistencia; onClose: () => void }) {
  const router = useRouter()
  const [canal, setCanal] = useState<"WHATSAPP" | "LLAMADA" | "CORREO" | "PRESENCIAL">("WHATSAPP")
  const [nota, setNota] = useState("")
  const [error, setError] = useState("")
  const [pendiente, startTransition] = useTransition()

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const r = await registrarContactoInasistencia({ citaId: inasistencia.cita_id, canal, nota })
      if (r.error) {
        setError(r.error)
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4"
      >
        <div>
          <h3 className="text-base font-extrabold text-gray-900">Registrar contacto</h3>
          <p className="text-xs text-gray-500">{inasistencia.paciente_nombre}</p>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Canal</label>
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value as typeof canal)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold bg-white"
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="LLAMADA">Llamada</option>
            <option value="CORREO">Correo</option>
            <option value="PRESENCIAL">Presencial</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Resultado del contacto</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={500}
            rows={3}
            required
            placeholder="Ej.: No contesta / Reagenda la próxima semana / Ya no continuará el tratamiento"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  )
}

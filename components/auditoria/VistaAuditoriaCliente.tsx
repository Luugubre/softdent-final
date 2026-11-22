"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { AccesoFicha, EventoAuditoria, TipoAccion } from "@/lib/auditoria"

const MODULOS: { valor: string; etiqueta: string }[] = [
  { valor: "PACIENTES", etiqueta: "Pacientes" },
  { valor: "CLINICO", etiqueta: "Ficha clínica" },
  { valor: "AGENDA", etiqueta: "Agenda" },
  { valor: "TRATAMIENTOS", etiqueta: "Tratamientos" },
  { valor: "CAJA", etiqueta: "Pagos y caja" },
  { valor: "RECETARIO", etiqueta: "Recetario" },
  { valor: "DOCUMENTOS", etiqueta: "Documentos, plantillas y consentimientos" },
  { valor: "USUARIOS", etiqueta: "Perfiles y firmas" },
  { valor: "CONFIGURACION", etiqueta: "Configuración" },
]
const ETIQUETA_MODULO = Object.fromEntries(MODULOS.map((m) => [m.valor, m.etiqueta]))

const BADGE_ACCION: Record<TipoAccion, { texto: string; clase: string }> = {
  CREAR: { texto: "Creación", clase: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  EDITAR: { texto: "Modificación", clase: "bg-blue-100 text-blue-800 border-blue-200" },
  ANULAR: { texto: "Anulación", clase: "bg-rose-100 text-rose-800 border-rose-200" },
  ESTADO: { texto: "Cambio de estado", clase: "bg-slate-100 text-slate-700 border-slate-200" },
  FIRMA: { texto: "Firma", clase: "bg-violet-100 text-violet-800 border-violet-200" },
}

function descargarCsv(nombre: string, filas: (string | number | undefined)[][]) {
  const celda = (v: string | number | undefined) => {
    let s = String(v ?? "")
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function VistaAuditoriaCliente({
  eventos,
  accesos,
  desde,
  hasta,
  hoy,
  truncado,
}: {
  eventos: EventoAuditoria[]
  accesos: AccesoFicha[]
  desde: string
  hasta: string
  hoy: string
  truncado: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<"CAMBIOS" | "ACCESOS">("CAMBIOS")
  const [busqueda, setBusqueda] = useState("")
  const [filtroModulo, setFiltroModulo] = useState("TODOS")
  const [filtroAccion, setFiltroAccion] = useState("TODAS")
  const [eventoDetalle, setEventoDetalle] = useState<EventoAuditoria | null>(null)
  const [rango, setRango] = useState({ desde, hasta })
  const [mostrar, setMostrar] = useState(50)

  const q = busqueda.trim().toLowerCase()

  const eventosFiltrados = useMemo(
    () =>
      eventos.filter((e) => {
        if (filtroModulo !== "TODOS" && e.modulo !== filtroModulo) return false
        if (filtroAccion !== "TODAS" && e.accion !== filtroAccion) return false
        if (!q) return true
        return [e.usuario_nombre, e.descripcion, e.paciente_nombre, e.paciente_rut, e.detalle_despues].some((t) =>
          t?.toLowerCase().includes(q)
        )
      }),
    [eventos, filtroModulo, filtroAccion, q]
  )

  const accesosFiltrados = useMemo(
    () =>
      q
        ? accesos.filter((a) =>
            [a.usuario_nombre, a.paciente_nombre, a.paciente_rut, a.seccion, String(a.ficha_numero)].some((t) =>
              t.toLowerCase().includes(q)
            )
          )
        : accesos,
    [accesos, q]
  )

  const pacientesConsultados = new Set(accesos.map((a) => a.paciente_id)).size
  const cambiosClinicos = eventos.filter((e) => e.accion === "CREAR" || e.accion === "EDITAR").length
  const anulaciones = eventos.filter((e) => e.accion === "ANULAR").length

  function aplicarRango(e: React.FormEvent) {
    e.preventDefault()
    if (!rango.desde || !rango.hasta) return
    router.push(`/administracion/auditoria?desde=${rango.desde}&hasta=${rango.hasta}`)
  }

  function exportar() {
    if (tab === "CAMBIOS") {
      descargarCsv(`auditoria-cambios-${desde}-${hasta}.csv`, [
        ["Fecha", "Usuario", "Rol", "Módulo", "Acción", "Detalle", "Paciente", "RUT", "Antes", "Después"],
        ...eventosFiltrados.map((e) => [
          e.fecha,
          e.usuario_nombre,
          e.usuario_rol,
          ETIQUETA_MODULO[e.modulo],
          BADGE_ACCION[e.accion].texto,
          e.descripcion,
          e.paciente_nombre,
          e.paciente_rut,
          e.detalle_antes,
          e.detalle_despues,
        ]),
      ])
    } else {
      descargarCsv(`auditoria-accesos-${desde}-${hasta}.csv`, [
        ["Fecha", "Usuario", "Rol", "Paciente", "RUT", "Ficha", "Sección", "IP"],
        ...accesosFiltrados.map((a) => [a.fecha, a.usuario_nombre, a.usuario_rol, a.paciente_nombre, a.paciente_rut, a.ficha_numero, a.seccion, a.ip]),
      ])
    }
  }

  const tarjeta = "bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
  const etiqueta = "block text-[10px] font-black uppercase text-gray-400 mb-1"
  const control = "w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold bg-white"

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={tarjeta}>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Eventos en el período</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{eventos.length}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">En todos los módulos</p>
        </div>
        <div className={tarjeta}>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Accesos a fichas</p>
          <p className="mt-1 text-2xl font-black text-blue-600">{accesos.length}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">
            {pacientesConsultados} paciente{pacientesConsultados === 1 ? "" : "s"} distinto{pacientesConsultados === 1 ? "" : "s"}
          </p>
        </div>
        <div className={tarjeta}>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Creaciones y cambios</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{cambiosClinicos}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">Registros creados o modificados</p>
        </div>
        <div className={tarjeta}>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Anulaciones</p>
          <p className="mt-1 text-2xl font-black text-rose-600">{anulaciones}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">Citas, recetas, pagos o documentos</p>
        </div>
      </div>

      {truncado && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          Se muestran los 1.000 registros más recientes del período. Acota las fechas para ver el resto.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
          {(
            [
              ["CAMBIOS", "📋 Bitácora de cambios"],
              ["ACCESOS", "👁️ Accesos a fichas de pacientes"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setTab(valor)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
                tab === valor ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportar}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
        >
          ⬇️ Exportar registro (CSV)
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className={tab === "CAMBIOS" ? "md:col-span-2" : "md:col-span-4"}>
          <label className={etiqueta}>Buscar</label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setMostrar(50)
            }}
            placeholder="Usuario, paciente, RUT o descripción del evento..."
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {tab === "CAMBIOS" && (
          <>
            <div>
              <label className={etiqueta}>Módulo</label>
              <select value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)} className={control}>
                <option value="TODOS">Todos los módulos</option>
                {MODULOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiqueta}>Tipo de acción</label>
              <select value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)} className={control}>
                <option value="TODAS">Todas las acciones</option>
                {Object.entries(BADGE_ACCION).map(([valor, b]) => (
                  <option key={valor} value={valor}>
                    {b.texto}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <form onSubmit={aplicarRango} className="md:col-span-2 grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
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

      {tab === "CAMBIOS" ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Detalle del evento</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3 text-right">Inspección</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {eventosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 font-medium">
                      No hay eventos que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  eventosFiltrados.slice(0, mostrar).map((ev) => {
                    const badge = BADGE_ACCION[ev.accion]
                    return (
                      <tr key={ev.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">{ev.fecha}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{ev.usuario_nombre}</div>
                          <div className="text-[10px] font-semibold text-gray-400">{ev.usuario_rol}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-extrabold text-gray-700 whitespace-nowrap">
                            {ETIQUETA_MODULO[ev.modulo]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${badge.clase}`}>
                            {badge.texto}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-md">{ev.descripcion}</td>
                        <td className="px-4 py-3">
                          {ev.paciente_nombre ? (
                            <Link href={`/pacientes/${ev.paciente_id}`} className="block hover:underline">
                              <div className="font-bold text-gray-900">{ev.paciente_nombre}</div>
                              <div className="text-[10px] font-mono text-gray-400">{ev.paciente_rut}</div>
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEventoDetalle(ev)}
                            className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Profesional / Usuario</th>
                  <th className="px-4 py-3">Paciente consultado</th>
                  <th className="px-4 py-3">Ficha</th>
                  <th className="px-4 py-3">Sección visualizada</th>
                  <th className="px-4 py-3 text-right">Dirección IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accesosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-medium">
                      No se encontraron accesos con ese criterio.
                    </td>
                  </tr>
                ) : (
                  accesosFiltrados.slice(0, mostrar).map((acc) => (
                    <tr key={acc.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">{acc.fecha}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{acc.usuario_nombre}</div>
                        <div className="text-[10px] font-semibold text-gray-400">{acc.usuario_rol}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/pacientes/${acc.paciente_id}`} className="block hover:underline">
                          <div className="font-bold text-gray-900">{acc.paciente_nombre}</div>
                          <div className="text-[10px] font-mono text-gray-400">{acc.paciente_rut}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-700">#{acc.ficha_numero}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                          {acc.seccion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-gray-400">{acc.ip}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(tab === "CAMBIOS" ? eventosFiltrados : accesosFiltrados).length > mostrar && (
        <button
          type="button"
          onClick={() => setMostrar(mostrar + 50)}
          className="w-full rounded-xl bg-blue-50 py-3 text-xs font-black uppercase tracking-wider text-blue-700 hover:bg-blue-100"
        >
          Ver más ({(tab === "CAMBIOS" ? eventosFiltrados : accesosFiltrados).length - mostrar} restantes)
        </button>
      )}

      {eventoDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" onClick={() => setEventoDetalle(null)}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">🔍 Detalle del registro</h3>
              <button type="button" onClick={() => setEventoDetalle(null)} className="text-gray-400 hover:text-gray-600 font-bold text-sm">
                ✕
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <dt className="text-[10px] font-black uppercase text-gray-400">Usuario</dt>
                <dd className="font-bold text-gray-900">{eventoDetalle.usuario_nombre}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase text-gray-400">Fecha y hora</dt>
                <dd className="font-mono font-semibold text-gray-800">{eventoDetalle.fecha}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase text-gray-400">Módulo</dt>
                <dd className="font-bold text-gray-900">{ETIQUETA_MODULO[eventoDetalle.modulo]}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase text-gray-400">Paciente</dt>
                <dd className="font-bold text-gray-900">{eventoDetalle.paciente_nombre ?? "—"}</dd>
              </div>
            </dl>
            <div className="space-y-2 text-xs">
              <p className="font-bold text-gray-800">{eventoDetalle.descripcion}</p>
              {eventoDetalle.detalle_antes && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                  <p className="text-[10px] font-black uppercase text-rose-700 mb-0.5">Valor anterior</p>
                  <p className="font-mono text-rose-900 break-words">{eventoDetalle.detalle_antes}</p>
                </div>
              )}
              {eventoDetalle.detalle_despues && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <p className="text-[10px] font-black uppercase text-emerald-700 mb-0.5">
                    {eventoDetalle.detalle_antes ? "Valor registrado" : "Detalle"}
                  </p>
                  <p className="font-mono text-emerald-900 break-words whitespace-pre-line">{eventoDetalle.detalle_despues}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setEventoDetalle(null)}
                className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-gray-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

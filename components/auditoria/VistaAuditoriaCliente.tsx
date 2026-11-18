"use client"

import { useState, useMemo } from "react"

type TipoAccion = "CREAR" | "EDITAR" | "ANULAR" | "VER_FICHA" | "EXPORTAR_PDF"

type EventoAuditoriaMock = {
  id: string
  fecha: string
  usuario_nombre: string
  usuario_rol: string
  modulo: "PACIENTES" | "AGENDA" | "TRATAMIENTOS" | "CAJA" | "RECETARIO" | "CONFIGURACION"
  accion: TipoAccion
  descripcion: string
  paciente_nombre?: string
  paciente_rut?: string
  ip: string
  detalle_antes?: string
  detalle_despues?: string
}

type AccesoFichaMock = {
  id: string
  fecha: string
  usuario_nombre: string
  usuario_rol: string
  paciente_nombre: string
  paciente_rut: string
  ficha_numero: number
  seccion: string
  ip: string
}

const EVENTOS_MOCK: EventoAuditoriaMock[] = [
  {
    id: "aud-1",
    fecha: "18-11-2026 14:52",
    usuario_nombre: "Dr. Alexis Romero",
    usuario_rol: "ADMINISTRADOR",
    modulo: "RECETARIO",
    accion: "CREAR",
    descripcion: "Emitió receta médica Folio #48 (Amoxicilina 875mg)",
    paciente_nombre: "María Fernanda Soto",
    paciente_rut: "18.432.119-4",
    ip: "190.162.44.12",
    detalle_despues: "Folio #48 · Diagnóstico: Periodontitis apical aguda",
  },
  {
    id: "aud-2",
    fecha: "18-11-2026 14:30",
    usuario_nombre: "Camila Valdés",
    usuario_rol: "RECEPCIONISTA",
    modulo: "AGENDA",
    accion: "ANULAR",
    descripcion: "Anuló cita N° 312 (Motivo: Paciente solicita reagendar por viaje)",
    paciente_nombre: "Jorge Luis Muñoz",
    paciente_rut: "14.908.221-K",
    ip: "190.162.44.15",
    detalle_antes: "Estado: CONFIRMADA · 18-11-2026 16:00",
    detalle_despues: "Estado: CANCELADA",
  },
  {
    id: "aud-3",
    fecha: "18-11-2026 13:18",
    usuario_nombre: "Dra. Valentina Rojas",
    usuario_rol: "DENTISTA",
    modulo: "TRATAMIENTOS",
    accion: "EDITAR",
    descripcion: "Actualizó estado de prestación 'Resina compuesta 2 caras (Pieza 1.6)'",
    paciente_nombre: "Andrea Paz Contreras",
    paciente_rut: "19.220.843-1",
    ip: "190.162.44.18",
    detalle_antes: "Estado: PLANIFICADO",
    detalle_despues: "Estado: REALIZADO · Valor: $45.000",
  },
  {
    id: "aud-4",
    fecha: "18-11-2026 12:05",
    usuario_nombre: "Camila Valdés",
    usuario_rol: "RECEPCIONISTA",
    modulo: "CAJA",
    accion: "CREAR",
    descripcion: "Registró pago de $60.000 (Débito) en Tratamiento N° 14",
    paciente_nombre: "Carlos Alberto Pérez",
    paciente_rut: "12.654.987-3",
    ip: "190.162.44.15",
    detalle_despues: "Comprobante #891 · Medio: Tarjeta Débito · Monto: $60.000",
  },
  {
    id: "aud-5",
    fecha: "18-11-2026 10:40",
    usuario_nombre: "Dr. Alexis Romero",
    usuario_rol: "ADMINISTRADOR",
    modulo: "CONFIGURACION",
    accion: "EDITAR",
    descripcion: "Configuró horario especial para Dra. Valentina Rojas (22-11-2026)",
    ip: "190.162.44.12",
    detalle_antes: "Horario semanal: 09:00 a 18:00",
    detalle_despues: "Horario especial: 09:00 a 13:30 (Turno sábado)",
  },
]

const ACCESOS_MOCK: AccesoFichaMock[] = [
  {
    id: "acc-1",
    fecha: "18-11-2026 14:50",
    usuario_nombre: "Dr. Alexis Romero",
    usuario_rol: "ADMINISTRADOR",
    paciente_nombre: "María Fernanda Soto",
    paciente_rut: "18.432.119-4",
    ficha_numero: 104,
    seccion: "Ficha › Recetario",
    ip: "190.162.44.12",
  },
  {
    id: "acc-2",
    fecha: "18-11-2026 14:28",
    usuario_nombre: "Camila Valdés",
    usuario_rol: "RECEPCIONISTA",
    paciente_nombre: "Jorge Luis Muñoz",
    paciente_rut: "14.908.221-K",
    ficha_numero: 87,
    seccion: "Ficha › Resumen",
    ip: "190.162.44.15",
  },
  {
    id: "acc-3",
    fecha: "18-11-2026 13:10",
    usuario_nombre: "Dra. Valentina Rojas",
    usuario_rol: "DENTISTA",
    paciente_nombre: "Andrea Paz Contreras",
    paciente_rut: "19.220.843-1",
    ficha_numero: 215,
    seccion: "Odontograma",
    ip: "190.162.44.18",
  },
  {
    id: "acc-4",
    fecha: "18-11-2026 11:58",
    usuario_nombre: "Camila Valdés",
    usuario_rol: "RECEPCIONISTA",
    paciente_nombre: "Carlos Alberto Pérez",
    paciente_rut: "12.654.987-3",
    ficha_numero: 63,
    seccion: "Pagos",
    ip: "190.162.44.15",
  },
]

const BADGE_ACCION: Record<TipoAccion, { texto: string; clase: string }> = {
  CREAR: { texto: "Creación", clase: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  EDITAR: { texto: "Modificación", clase: "bg-blue-100 text-blue-800 border-blue-200" },
  ANULAR: { texto: "Anulación", clase: "bg-rose-100 text-rose-800 border-rose-200" },
  VER_FICHA: { texto: "Consulta Ficha", clase: "bg-slate-100 text-slate-700 border-slate-200" },
  EXPORTAR_PDF: { texto: "Descarga PDF", clase: "bg-amber-100 text-amber-800 border-amber-200" },
}

export function VistaAuditoriaCliente() {
  const [tab, setTab] = useState<"CAMBIOS" | "ACCESOS">("CAMBIOS")
  const [busqueda, setBusqueda] = useState("")
  const [filtroModulo, setFiltroModulo] = useState("TODOS")
  const [filtroAccion, setFiltroAccion] = useState("TODAS")
  const [eventoDetalle, setEventoDetalle] = useState<EventoAuditoriaMock | null>(null)

  const eventosFiltrados = useMemo(() => {
    return EVENTOS_MOCK.filter((e) => {
      if (filtroModulo !== "TODOS" && e.modulo !== filtroModulo) return false
      if (filtroAccion !== "TODAS" && e.accion !== filtroAccion) return false
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        const coincide =
          e.usuario_nombre.toLowerCase().includes(q) ||
          e.descripcion.toLowerCase().includes(q) ||
          (e.paciente_nombre?.toLowerCase().includes(q) ?? false) ||
          (e.paciente_rut?.toLowerCase().includes(q) ?? false)
        if (!coincide) return false
      }
      return true
    })
  }, [busqueda, filtroModulo, filtroAccion])

  const accesosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return ACCESOS_MOCK
    const q = busqueda.toLowerCase()
    return ACCESOS_MOCK.filter(
      (a) =>
        a.usuario_nombre.toLowerCase().includes(q) ||
        a.paciente_nombre.toLowerCase().includes(q) ||
        a.paciente_rut.toLowerCase().includes(q) ||
        a.seccion.toLowerCase().includes(q)
    )
  }, [busqueda])

  return (
    <div className="space-y-6">
      {/* Banner informativo de vista previa */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-900">
        <div className="flex items-center gap-2.5">
          <span className="text-base">ℹ️</span>
          <p className="font-medium">
            <strong>Vista de diseño del módulo de Auditoría:</strong> Los registros mostrados son referenciales para validar filtros, columnas y trazabilidad de accesos.
          </p>
        </div>
      </div>

      {/* Tarjetas de resumen (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Eventos registrados hoy</p>
          <p className="mt-1 text-2xl font-black text-gray-900">42</p>
          <p className="mt-1 text-xs font-medium text-gray-500">En todos los módulos clínicos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Accesos a fichas</p>
          <p className="mt-1 text-2xl font-black text-blue-600">28</p>
          <p className="mt-1 text-xs font-medium text-gray-500">19 pacientes distintos consultados</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Cambios clínicos y caja</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">11</p>
          <p className="mt-1 text-xs font-medium text-gray-500">Creaciones y ediciones auditadas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Anulaciones / alertas</p>
          <p className="mt-1 text-2xl font-black text-rose-600">3</p>
          <p className="mt-1 text-xs font-medium text-gray-500">Citas, recetas o pagos anulados</p>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("CAMBIOS")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
              tab === "CAMBIOS" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            📋 Bitácora de cambios
          </button>
          <button
            type="button"
            onClick={() => setTab("ACCESOS")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors ${
              tab === "ACCESOS" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            👁️ Accesos a fichas de pacientes
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.alert("Exportación CSV lista para conectar con el backend.")}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
        >
          ⬇️ Exportar registro (CSV)
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className={tab === "CAMBIOS" ? "md:col-span-2" : "md:col-span-3"}>
          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Buscar</label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Usuario, paciente, RUT o descripción del evento..."
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {tab === "CAMBIOS" && (
          <>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Módulo</label>
              <select
                value={filtroModulo}
                onChange={(e) => setFiltroModulo(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold bg-white"
              >
                <option value="TODOS">Todos los módulos</option>
                <option value="PACIENTES">Pacientes</option>
                <option value="AGENDA">Agenda</option>
                <option value="TRATAMIENTOS">Tratamientos</option>
                <option value="CAJA">Caja</option>
                <option value="RECETARIO">Recetario</option>
                <option value="CONFIGURACION">Configuración</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Tipo de acción</label>
              <select
                value={filtroAccion}
                onChange={(e) => setFiltroAccion(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold bg-white"
              >
                <option value="TODAS">Todas las acciones</option>
                <option value="CREAR">Creación</option>
                <option value="EDITAR">Modificación</option>
                <option value="ANULAR">Anulación</option>
              </select>
            </div>
          </>
        )}

        {tab === "ACCESOS" && (
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Fecha</label>
            <input
              type="date"
              defaultValue="2026-11-18"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold bg-white"
            />
          </div>
        )}
      </div>

      {/* Tabla 1: Bitácora de Cambios */}
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
                  eventosFiltrados.map((ev) => {
                    const badge = BADGE_ACCION[ev.accion]
                    return (
                      <tr key={ev.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {ev.fecha}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{ev.usuario_nombre}</div>
                          <div className="text-[10px] font-semibold text-gray-400">{ev.usuario_rol}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-extrabold text-gray-700">
                            {ev.modulo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${badge.clase}`}>
                            {badge.texto}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-md">{ev.descripcion}</td>
                        <td className="px-4 py-3">
                          {ev.paciente_nombre ? (
                            <>
                              <div className="font-bold text-gray-900">{ev.paciente_nombre}</div>
                              <div className="text-[10px] font-mono text-gray-400">{ev.paciente_rut}</div>
                            </>
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
        /* Tabla 2: Accesos a Fichas de Pacientes */
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
                  accesosFiltrados.map((acc) => (
                    <tr key={acc.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                        {acc.fecha}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{acc.usuario_nombre}</div>
                        <div className="text-[10px] font-semibold text-gray-400">{acc.usuario_rol}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{acc.paciente_nombre}</div>
                        <div className="text-[10px] font-mono text-gray-400">{acc.paciente_rut}</div>
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

      {/* Modal de Inspección de Cambio */}
      {eventoDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">🔍 Detalle del Registro Auditado</h3>
              <button
                type="button"
                onClick={() => setEventoDetalle(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
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
                <dd className="font-bold text-gray-900">{eventoDetalle.modulo}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase text-gray-400">IP Origen</dt>
                <dd className="font-mono text-gray-700">{eventoDetalle.ip}</dd>
              </div>
            </dl>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-gray-800">{eventoDetalle.descripcion}</p>

              {eventoDetalle.detalle_antes && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                  <p className="text-[10px] font-black uppercase text-rose-700 mb-0.5">Valor anterior</p>
                  <p className="font-mono text-rose-900">{eventoDetalle.detalle_antes}</p>
                </div>
              )}

              {eventoDetalle.detalle_despues && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <p className="text-[10px] font-black uppercase text-emerald-700 mb-0.5">Valor registrado</p>
                  <p className="font-mono text-emerald-900">{eventoDetalle.detalle_despues}</p>
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
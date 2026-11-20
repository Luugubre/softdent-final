"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Modal } from "@/components/odontograma/Modales"
import {
  aprobarPresupuesto,
  rechazarPresupuesto,
  registrarContactoPresupuesto,
} from "@/app/presupuestos-pendientes/actions"
import {
  MOTIVOS_RECHAZO,
  MOTIVO_RECHAZO_ETIQUETA,
  type MotivoRechazo,
  type PresupuestoSinAprobar,
} from "@/types/presupuesto"

type FiltroAntiguedad = "TODOS" | "0_30" | "31_90" | "MAS_90"
type FiltroMonto = "TODOS" | "MENOR_200" | "200_500" | "MAS_500"

function formatoPesos(valor: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor)
}

function limpiarTelefonoWhatsApp(tel: string | null): string | null {
  if (!tel) return null
  const digitos = tel.replace(/\D/g, "")
  if (!digitos) return null
  if (digitos.startsWith("56")) return digitos
  if (digitos.length === 9 && digitos.startsWith("9")) return `56${digitos}`
  if (digitos.length === 8) return `569${digitos}`
  return digitos
}

function formatoFechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function BandejaPresupuestos({
  presupuestos,
  doctores,
  esDentistaSoloPropio,
}: {
  presupuestos: PresupuestoSinAprobar[]
  doctores: { id: string; nombre_completo: string }[]
  esDentistaSoloPropio: boolean
}) {
  const [busqueda, setBusqueda] = useState("")
  const [antiguedad, setAntiguedad] = useState<FiltroAntiguedad>("TODOS")
  const [doctorId, setDoctorId] = useState<string>("TODOS")
  const [filtroMonto, setFiltroMonto] = useState<FiltroMonto>("TODOS")

  // Modales de acción
  const [modalContacto, setModalContacto] = useState<{
    presupuesto: PresupuestoSinAprobar
    canal: "WHATSAPP" | "LLAMADA" | "NOTA"
  } | null>(null)
  const [notaContacto, setNotaContacto] = useState("")

  const [modalRechazo, setModalRechazo] = useState<PresupuestoSinAprobar | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState<MotivoRechazo>("PRECIO")
  const [detalleRechazo, setDetalleRechazo] = useState("")

  const [mensajeToast, setMensajeToast] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return presupuestos.filter((p) => {
      if (q) {
        const coincide =
          p.paciente_nombre.toLowerCase().includes(q) ||
          (p.paciente_rut ?? "").toLowerCase().includes(q) ||
          p.nombre.toLowerCase().includes(q) ||
          String(p.numero ?? "").includes(q)
        if (!coincide) return false
      }

      if (antiguedad === "0_30" && p.antiguedad_dias > 30) return false
      if (antiguedad === "31_90" && (p.antiguedad_dias < 31 || p.antiguedad_dias > 90)) return false
      if (antiguedad === "MAS_90" && p.antiguedad_dias <= 90) return false

      if (doctorId !== "TODOS" && p.profesional_id !== doctorId) return false

      if (filtroMonto === "MENOR_200" && p.monto_total >= 200_000) return false
      if (filtroMonto === "200_500" && (p.monto_total < 200_000 || p.monto_total > 500_000)) return false
      if (filtroMonto === "MAS_500" && p.monto_total <= 500_000) return false

      return true
    })
  }, [presupuestos, busqueda, antiguedad, doctorId, filtroMonto])

  const totalPesosPorCerrar = useMemo(
    () => filtrados.reduce((acc, p) => acc + p.monto_total, 0),
    [filtrados]
  )

  function abrirWhatsApp(p: PresupuestoSinAprobar) {
    const wa = limpiarTelefonoWhatsApp(p.paciente_telefono)
    if (wa) {
      const texto = encodeURIComponent(
        `Hola ${p.paciente_nombre.split(" ")[0]}, te saludamos de la clínica dental respecto a tu presupuesto ${p.numero ? `#${p.numero} ` : ""}(${formatoPesos(p.monto_total)}). ¿Te gustaría agendar una hora para resolver dudas o iniciar tu tratamiento?`
      )
      window.open(`https://wa.me/${wa}?text=${texto}`, "_blank", "noopener,noreferrer")
    }
    setNotaContacto("")
    setModalContacto({ presupuesto: p, canal: "WHATSAPP" })
  }

  function abrirLlamada(p: PresupuestoSinAprobar) {
    if (p.paciente_telefono) {
      window.location.href = `tel:${p.paciente_telefono}`
    }
    setNotaContacto("")
    setModalContacto({ presupuesto: p, canal: "LLAMADA" })
  }

  function guardarContacto() {
    if (!modalContacto) return
    startTransition(async () => {
      const res = await registrarContactoPresupuesto(
        modalContacto.presupuesto.id,
        modalContacto.canal,
        notaContacto
      )
      setMensajeToast({ ok: res.ok, texto: res.mensaje })
      if (res.ok) {
        setModalContacto(null)
        setNotaContacto("")
      }
    })
  }

  function confirmarRechazo() {
    if (!modalRechazo) return
    startTransition(async () => {
      const res = await rechazarPresupuesto(modalRechazo.id, motivoRechazo, detalleRechazo)
      setMensajeToast({ ok: res.ok, texto: res.mensaje })
      if (res.ok) {
        setModalRechazo(null)
        setDetalleRechazo("")
      }
    })
  }

  function confirmarAprobacion(p: PresupuestoSinAprobar) {
    if (!window.confirm(`¿Marcar el presupuesto ${p.numero ? `#${p.numero}` : p.nombre} de ${p.paciente_nombre} como APROBADO?`)) {
      return
    }
    startTransition(async () => {
      const res = await aprobarPresupuesto(p.id)
      setMensajeToast({ ok: res.ok, texto: res.mensaje })
    })
  }

  return (
    <div className="space-y-5">
      {/* KPIs superiores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-blue-100">Total en pesos por cerrar</p>
          <p className="mt-1 text-3xl font-black">{formatoPesos(totalPesosPorCerrar)}</p>
          <p className="mt-1 text-xs font-semibold text-blue-100">
            Suma de {filtrados.length} presupuesto{filtrados.length === 1 ? "" : "s"} filtrado{filtrados.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-gray-500">Presupuestos sin aprobar</p>
          <p className="mt-1 text-3xl font-black text-gray-900">{filtrados.length}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            De un total de {presupuestos.length} activo{presupuestos.length === 1 ? "" : "s"} pendiente{presupuestos.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-black uppercase tracking-wider text-amber-800">Con más de 30 días</p>
          <p className="mt-1 text-3xl font-black text-amber-900">
            {filtrados.filter((p) => p.antiguedad_dias > 30).length}
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-700">
            Prioritarios para seguimiento comercial
          </p>
        </div>
      </div>

      {mensajeToast && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${
            mensajeToast.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span>{mensajeToast.texto}</span>
          <button onClick={() => setMensajeToast(null)} className="text-xs font-black opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Barra de filtros */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar paciente, RUT o presupuesto…"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={antiguedad}
            onChange={(e) => setAntiguedad(e.target.value as FiltroAntiguedad)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Antigüedad: Todas</option>
            <option value="0_30">0 a 30 días</option>
            <option value="31_90">31 a 90 días</option>
            <option value="MAS_90">Más de 90 días</option>
          </select>

          {!esDentistaSoloPropio ? (
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Doctor: Todos</option>
              {doctores.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre_completo}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-600">
              Mis presupuestos
            </div>
          )}

          <select
            value={filtroMonto}
            onChange={(e) => setFiltroMonto(e.target.value as FiltroMonto)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Monto: Todos</option>
            <option value="MENOR_200">Menos de $200.000</option>
            <option value="200_500">$200.000 a $500.000</option>
            <option value="MAS_500">Más de $500.000</option>
          </select>
        </div>
      </div>

      {/* Listado */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-base font-black text-gray-700">No hay presupuestos sin aprobar con estos filtros</p>
          <p className="mt-1 text-sm text-gray-500">Prueba ampliando el rango de antigüedad, monto o doctor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => {
            const badgeAntiguedad =
              p.antiguedad_dias > 90
                ? "bg-rose-100 text-rose-800 border-rose-200"
                : p.antiguedad_dias > 30
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-emerald-100 text-emerald-800 border-emerald-200"

            return (
              <div
                key={p.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 transition space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/pacientes/${p.paciente_id}`}
                        className="text-lg font-black text-gray-900 uppercase hover:text-blue-600"
                      >
                        {p.paciente_nombre}
                      </Link>
                      {p.paciente_rut && (
                        <span className="text-xs font-bold text-gray-400">RUT {p.paciente_rut}</span>
                      )}
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${badgeAntiguedad}`}>
                        Hace {p.antiguedad_dias} día{p.antiguedad_dias === 1 ? "" : "s"}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-gray-700">
                      {p.numero ? `Presupuesto #${p.numero} · ` : ""}
                      {p.nombre}
                      <span className="text-gray-400 font-semibold">
                        {" "}
                        ({p.items_count} prestación{p.items_count === 1 ? "" : "es"})
                      </span>
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-gray-500">
                      <span>👨‍⚕️ {p.profesional_nombre}</span>
                      {p.paciente_telefono && <span>📞 {p.paciente_telefono}</span>}
                      {p.proxima_cita ? (
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-blue-800 font-bold">
                          📅 Próxima hora: {formatoFechaCorta(p.proxima_cita.inicio)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600 font-bold">
                          Sin próxima hora agendada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-400">Monto total</p>
                    <p className="text-2xl font-black text-gray-900">{formatoPesos(p.monto_total)}</p>
                  </div>
                </div>

                {/* Último contacto */}
                <div className="rounded-xl bg-gray-50 border border-gray-200/80 px-3.5 py-2.5 text-xs">
                  {p.ultimo_contacto_at ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-gray-700">
                        💬 Último contacto ({formatoFechaCorta(p.ultimo_contacto_at)}):{" "}
                        <span className="font-normal text-gray-600">{p.ultimo_contacto_nota}</span>
                      </span>
                    </div>
                  ) : (
                    <span className="font-semibold text-gray-400">Sin contactos registrados aún.</span>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => abrirWhatsApp(p)}
                      disabled={!p.paciente_telefono}
                      title={p.paciente_telefono ? "Enviar WhatsApp y registrar resultado" : "Paciente sin teléfono"}
                      className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      💬 WhatsApp
                    </button>

                    <button
                      onClick={() => abrirLlamada(p)}
                      disabled={!p.paciente_telefono}
                      className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-black text-gray-800 hover:bg-gray-100 disabled:opacity-40"
                    >
                      📞 Llamar
                    </button>

                    <Link
                      href={`/agenda?paciente=${p.paciente_id}`}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                    >
                      📅 Agendar
                    </Link>

                    <button
                      onClick={() => {
                        setNotaContacto("")
                        setModalContacto({ presupuesto: p, canal: "NOTA" })
                      }}
                      className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-black text-gray-700 hover:bg-gray-100"
                    >
                      📝 Anotar resultado
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => confirmarAprobacion(p)}
                      disabled={pendiente}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                    >
                      ✓ Aprobar
                    </button>

                    <button
                      onClick={() => {
                        setMotivoRechazo("PRECIO")
                        setDetalleRechazo("")
                        setModalRechazo(p)
                      }}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
                    >
                      ✕ Rechazado
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Anotar resultado de contacto */}
      {modalContacto && (
        <Modal
          titulo={`📝 Registrar contacto · ${modalContacto.presupuesto.paciente_nombre}`}
          onClose={() => setModalContacto(null)}
        >
          <p className="text-xs font-semibold text-gray-500">
            Canal:{" "}
            <strong className="text-gray-800">
              {modalContacto.canal === "WHATSAPP"
                ? "WhatsApp"
                : modalContacto.canal === "LLAMADA"
                ? "Llamada telefónica"
                : "Nota de seguimiento"}
            </strong>
          </p>

          <label className="block">
            <span className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">
              Resultado del contacto
            </span>
            <textarea
              rows={3}
              value={notaContacto}
              onChange={(e) => setNotaContacto(e.target.value)}
              placeholder="Ej: Pidió volver a llamar el lunes, está cotizando opciones o confirmó que agendará la próxima semana…"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setModalContacto(null)}
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={guardarContacto}
              disabled={pendiente || notaContacto.trim().length < 2}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {pendiente ? "Guardando…" : "Guardar seguimiento"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Marcar como rechazado */}
      {modalRechazo && (
        <Modal
          titulo={`✕ Rechazar presupuesto · ${modalRechazo.paciente_nombre}`}
          onClose={() => setModalRechazo(null)}
        >
          <p className="text-xs font-semibold text-gray-600">
            Selecciona el motivo principal por el cual el paciente no realizará el tratamiento (alimenta el reporte de desempeño).
          </p>

          <div className="space-y-2">
            {MOTIVOS_RECHAZO.map((m) => (
              <label
                key={m}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  motivoRechazo === m
                    ? "border-rose-500 bg-rose-50 text-rose-900"
                    : "border-gray-200 hover:bg-gray-50 text-gray-800"
                }`}
              >
                <input
                  type="radio"
                  name="motivoRechazo"
                  checked={motivoRechazo === m}
                  onChange={() => setMotivoRechazo(m)}
                />
                <span className="text-sm font-bold">{MOTIVO_RECHAZO_ETIQUETA[m]}</span>
              </label>
            ))}
          </div>

          <label className="block">
            <span className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">
              Observación adicional (opcional)
            </span>
            <input
              value={detalleRechazo}
              onChange={(e) => setDetalleRechazo(e.target.value)}
              placeholder="Ej: Comentó que retomará en marzo…"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setModalRechazo(null)}
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarRechazo}
              disabled={pendiente}
              className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {pendiente ? "Guardando…" : "Confirmar rechazo"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
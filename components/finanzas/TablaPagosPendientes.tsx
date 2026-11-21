"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { SaldoPaciente } from "@/lib/pagos-pendientes"

type FiltroAntiguedad = "TODOS" | "0_30" | "31_60" | "MAS_60"

function formatoPesos(valor: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor)
}

function formatoFecha(iso: string | null) {
  if (!iso) return "Sin abonos aún"
  return new Date(iso).toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
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

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function TablaPagosPendientes({
  saldos,
  doctores,
  soloMiCartera,
}: {
  saldos: SaldoPaciente[]
  doctores: { id: string; nombre_completo: string }[]
  soloMiCartera: boolean
}) {
  const [busqueda, setBusqueda] = useState("")
  const [doctorId, setDoctorId] = useState("TODOS")
  const [antiguedad, setAntiguedad] = useState<FiltroAntiguedad>("TODOS")

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return saldos.filter((s) => {
      if (q) {
        const match =
          s.paciente_nombre.toLowerCase().includes(q) ||
          (s.rut ?? "").toLowerCase().includes(q) ||
          s.doctor_nombre.toLowerCase().includes(q)
        if (!match) return false
      }
      if (doctorId !== "TODOS" && s.doctor_id !== doctorId) return false
      if (antiguedad === "0_30" && s.antiguedad_dias > 30) return false
      if (antiguedad === "31_60" && (s.antiguedad_dias < 31 || s.antiguedad_dias > 60)) return false
      if (antiguedad === "MAS_60" && s.antiguedad_dias <= 60) return false
      return true
    })
  }, [saldos, busqueda, doctorId, antiguedad])

  const totalPorCobrar = useMemo(
    () => filtrados.reduce((acc, s) => acc + s.saldo, 0),
    [filtrados]
  )

  function enviarWhatsAppCobro(s: SaldoPaciente) {
    const wa = limpiarTelefonoWhatsApp(s.telefono)
    if (!wa) return
    const primerNombre = s.nombres?.split(" ")[0] || "Paciente"
    const mensaje = encodeURIComponent(
      `Hola ${primerNombre}, te saludamos cordialmente desde la clínica dental. Queríamos recordarte que mantienes un saldo pendiente de ${formatoPesos(s.saldo)} correspondiente a tus prestaciones realizadas. Si necesitas coordinar tu abono o tienes alguna duda, estamos a tu disposición. ¡Muchas gracias!`
    )
    window.open(`https://wa.me/${wa}?text=${mensaje}`, "_blank", "noopener,noreferrer")
  }

  function exportarExcel() {
    const fechaArchivo = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" })

    const filasHtml = filtrados
      .map(
        (s) => `
        <tr>
          <td>${escaparHtml(s.paciente_nombre)}</td>
          <td>${escaparHtml(s.rut ?? "")}</td>
          <td>${escaparHtml(s.telefono ?? "")}</td>
          <td>${escaparHtml(s.doctor_nombre)}</td>
          <td>${s.total_habilitado}</td>
          <td>${s.total_abonado}</td>
          <td>${s.saldo}</td>
          <td>${s.antiguedad_dias}</td>
          <td>${escaparHtml(formatoFecha(s.ultimo_pago_at))}</td>
        </tr>`
      )
      .join("")

    const tablaExcel = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table border="1">
          <thead>
            <tr style="background-color:#1e3a8a;color:#ffffff;font-weight:bold;">
              <th>Paciente</th>
              <th>RUT</th>
              <th>Teléfono</th>
              <th>Doctor</th>
              <th>Total Habilitado (CLP)</th>
              <th>Total Abonado (CLP)</th>
              <th>Saldo Pendiente (CLP)</th>
              <th>Antigüedad (días)</th>
              <th>Último Pago</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
            <tr style="font-weight:bold;background-color:#f3f4f6;">
              <td colspan="6">TOTAL POR COBRAR</td>
              <td>${totalPorCobrar}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>`

    const blob = new Blob(["\uFEFF", tablaExcel], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `pagos-pendientes-${fechaArchivo}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* KPI superior + Exportar Excel */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-600 to-rose-700 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-rose-100">
            Total por cobrar de la clínica
          </p>
          <p className="mt-1 text-3xl font-black">{formatoPesos(totalPorCobrar)}</p>
          <p className="mt-1 text-xs font-semibold text-rose-100">
            En {filtrados.length} paciente{filtrados.length === 1 ? "" : "s"} con saldo habilitado pendiente
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-gray-500">
            Deuda con más de 30 días
          </p>
          <p className="mt-1 text-3xl font-black text-amber-700">
            {formatoPesos(
              filtrados
                .filter((s) => s.antiguedad_dias > 30)
                .reduce((acc, s) => acc + s.saldo, 0)
            )}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {filtrados.filter((s) => s.antiguedad_dias > 30).length} paciente(s) requieren gestión de cobro
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Reporte de cobranza</p>
            <p className="mt-1 text-xs font-semibold text-gray-600">
              Descarga el listado filtrado con saldos, antigüedad y teléfonos.
            </p>
          </div>
          <button
            onClick={exportarExcel}
            disabled={filtrados.length === 0}
            className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-40 transition"
          >
            📊 Exportar a Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar paciente, RUT o doctor…"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={antiguedad}
            onChange={(e) => setAntiguedad(e.target.value as FiltroAntiguedad)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TODOS">Antigüedad: Todas</option>
            <option value="0_30">0 a 30 días</option>
            <option value="31_60">31 a 60 días</option>
            <option value="MAS_60">Más de 60 días</option>
          </select>

          {!soloMiCartera ? (
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
              Mis pacientes con saldo
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-base font-black text-gray-700">No hay saldos pendientes por cobrar</p>
          <p className="mt-1 text-sm text-gray-500">Todos los tratamientos habilitados están al día o no coinciden con el filtro.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3.5">Paciente</th>
                  <th className="px-4 py-3.5 text-right">Saldo</th>
                  <th className="px-4 py-3.5">Antigüedad</th>
                  <th className="px-4 py-3.5">Último pago</th>
                  <th className="px-4 py-3.5">Doctor</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filtrados.map((s) => {
                  const badgeAntiguedad =
                    s.antiguedad_dias > 60
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : s.antiguedad_dias > 30
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-gray-100 text-gray-700 border-gray-200"

                  return (
                    <tr key={s.paciente_id} className="hover:bg-blue-50/40 transition">
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/pacientes/${s.paciente_id}`}
                          className="font-black text-gray-900 uppercase hover:text-blue-600 block"
                        >
                          {s.paciente_nombre}
                        </Link>
                        <div className="text-xs font-semibold text-gray-400">
                          {s.rut ? `RUT ${s.rut}` : ""}
                          {s.rut && s.telefono ? " · " : ""}
                          {s.telefono ? `📞 ${s.telefono}` : ""}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span className="text-base font-black text-rose-700">
                          {formatoPesos(s.saldo)}
                        </span>
                        <span className="block text-[11px] font-semibold text-gray-400">
                          Hab. {formatoPesos(s.total_habilitado)} · Abon. {formatoPesos(s.total_abonado)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-black ${badgeAntiguedad}`}>
                          {s.antiguedad_dias} día{s.antiguedad_dias === 1 ? "" : "s"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-gray-700">
                        {formatoFecha(s.ultimo_pago_at)}
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-gray-700">
                        {s.doctor_nombre}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => enviarWhatsAppCobro(s)}
                            disabled={!s.telefono}
                            title={s.telefono ? "Enviar recordatorio amable por WhatsApp" : "Paciente sin teléfono"}
                            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-40"
                          >
                            💬 Cobrar
                          </button>

                          <Link
                            href={`/pacientes/${s.paciente_id}?tab=pagos`}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 hover:bg-blue-100"
                          >
                            💳 Ir a pagos
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
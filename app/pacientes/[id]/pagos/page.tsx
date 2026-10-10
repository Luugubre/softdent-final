import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerItems, obtenerTratamientos } from "@/lib/tratamientos"
import { cuentaCorriente, obtenerPagos, resumenDeuda } from "@/lib/pagos"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { RegistrarPago, type ItemCobrable } from "@/components/pagos/RegistrarPago"
import { HistorialPagos } from "@/components/pagos/HistorialPagos"
import type { ResumenTratamiento } from "@/types/tratamiento"

function Tarjeta({ titulo, valor, nota, estilo }: { titulo: string; valor: number; nota: string; estilo?: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${estilo ?? "bg-white border-gray-200"}`}>
      <p className="text-[11px] font-black uppercase tracking-wider opacity-70">{titulo}</p>
      <p className="text-2xl font-black">{formatearPesos(valor)}</p>
      <p className="text-[11px] font-medium opacity-70">{nota}</p>
    </div>
  )
}

/** Estado de la deuda de un tratamiento */
function estadoDeuda(t: ResumenTratamiento) {
  if (t.habilitado === 0 && t.abonado === 0) return { etiqueta: "Sin cargos", estilo: "bg-gray-100 text-gray-500" }
  if (t.abonado >= t.total) return { etiqueta: "Pagada", estilo: "bg-emerald-100 text-emerald-800" }
  if (t.abonado >= t.habilitado) return { etiqueta: "Al día", estilo: "bg-teal-100 text-teal-800" }
  if (t.abonado > 0) return { etiqueta: "Parcialmente pagada", estilo: "bg-amber-100 text-amber-800" }
  return { etiqueta: "Pendiente", estilo: "bg-orange-100 text-orange-800" }
}

export default async function PagosPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("pagos.ver")
  const { id } = await params

  const [{ items, avances }, tratamientos, pagos] = await Promise.all([
    obtenerItems(id),
    obtenerTratamientos(id),
    obtenerPagos(id),
  ])

  const resumen = resumenDeuda(items)
  const movimientos = cuentaCorriente(resumen.vigentes, avances, pagos)
  const conCargos = tratamientos.filter((t) => t.estado !== "ANULADO" && t.total > 0)

  const cobrables: ItemCobrable[] = resumen.vigentes
    .filter((i) => i.precio - i.abonado > 0)
    .map((i) => ({
      id: i.id,
      tratamiento: i.presupuesto ? `Tratamiento N° ${i.presupuesto.numero} · ${i.presupuesto.nombre}` : "Sin tratamiento",
      nombre: i.prestacion?.nombre ?? "Prestación",
      pieza: i.pieza,
      progreso: i.progreso,
      precio: i.precio,
      habilitado: i.monto_habilitado,
      abonado: i.abonado,
    }))

  return (
    <div className="space-y-6">
      {/* RESUMEN DE DEUDA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta
          titulo="Deuda actual"
          valor={resumen.deudaActual}
          nota="Realizado y aún no pagado"
          estilo={resumen.deudaActual > 0 ? "bg-orange-50 border-orange-300 text-orange-800" : "bg-emerald-50 border-emerald-300 text-emerald-800"}
        />
        <Tarjeta titulo="Saldo de tratamientos" valor={resumen.saldoTratamientos} nota="Lo que falta pagar del total" estilo="bg-white border-gray-200 text-gray-900" />
        <Tarjeta titulo="Total abonado" valor={resumen.totalAbonado} nota="Pagos vigentes" estilo="bg-white border-gray-200 text-gray-900" />
        <Tarjeta titulo="Abono anticipado" valor={resumen.anticipos} nota="Pagado antes de realizarse" estilo="bg-white border-gray-200 text-gray-900" />
      </div>

      {puede(usuario.rol, "pagos.registrar") && <RegistrarPago pacienteId={id} items={cobrables} />}

      {/* DEUDA POR TRATAMIENTO */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-gray-900">Deuda por tratamiento</h2>
        {conCargos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm font-semibold text-gray-400">
            El paciente no tiene tratamientos con prestaciones.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Tratamiento</th>
                  <th className="text-right px-4 py-2">Total</th>
                  <th className="text-right px-4 py-2">Realizado</th>
                  <th className="text-right px-4 py-2">Abonado</th>
                  <th className="text-right px-4 py-2">Por pagar</th>
                  <th className="text-right px-4 py-2">Saldo</th>
                  <th className="text-left px-4 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {conCargos.map((t) => {
                  const estado = estadoDeuda(t)
                  const porPagar = Math.max(t.habilitado - t.abonado, 0)
                  return (
                    <tr key={t.id} className="border-t border-gray-100">
                      <td className="px-4 py-2.5">
                        <Link href={`/pacientes/${id}/tratamientos/${t.id}`} className="font-bold text-blue-700 hover:underline">
                          N° {t.numero} · {t.nombre}
                        </Link>
                        <p className="text-xs text-gray-500">{t.avance}% realizado</p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatearPesos(t.total)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatearPesos(t.habilitado)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatearPesos(t.abonado)}</td>
                      <td className={`px-4 py-2.5 text-right font-black ${porPagar > 0 ? "text-orange-700" : "text-gray-400"}`}>
                        {formatearPesos(porPagar)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatearPesos(t.total - t.abonado)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${estado.estilo}`}>{estado.etiqueta}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <HistorialPagos pacienteId={id} pagos={pagos} puedeAnular={puede(usuario.rol, "pagos.anular")} />

      {/* CUENTA CORRIENTE */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Cuenta corriente</h2>
          <p className="text-xs font-medium text-gray-500">
            Cargos (cada avance de una prestación) y abonos (pagos) en orden cronológico. Las anulaciones se registran como
            movimiento inverso.
          </p>
        </div>
        {movimientos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm font-semibold text-gray-400">
            Sin movimientos.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Fecha</th>
                  <th className="text-left px-4 py-2">Detalle</th>
                  <th className="text-right px-4 py-2">Cargo</th>
                  <th className="text-right px-4 py-2">Abono</th>
                  <th className="text-right px-4 py-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m, n) => (
                  <tr key={n} className="border-t border-gray-100">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">{formatearFechaHora(m.fecha)}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{m.descripcion}</td>
                    <td className="px-4 py-2 text-right font-semibold text-orange-700">{m.cargo ? formatearPesos(m.cargo) : ""}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-700">{m.abono ? formatearPesos(m.abono) : ""}</td>
                    <td className={`px-4 py-2 text-right font-black ${m.saldo > 0 ? "text-orange-700" : m.saldo < 0 ? "text-blue-700" : "text-gray-900"}`}>
                      {formatearPesos(m.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-[11px] font-medium text-gray-500 border-t border-gray-100">
              Saldo positivo = el paciente debe · saldo negativo = tiene abono anticipado a su favor.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

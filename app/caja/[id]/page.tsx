import Link from "next/link"
import { notFound } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { obtenerCaja, obtenerMovimientos, totalesPorMetodo } from "@/lib/caja"
import { obtenerMetodosPago, obtenerParametro } from "@/lib/catalogos"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { BotonImprimir } from "@/components/pagos/BotonImprimir"
import { TablaMovimientos } from "@/components/caja/GestionCaja"

export default async function DetalleCajaPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirPermiso("caja.gestionar")
  const { id } = await params
  const caja = await obtenerCaja(id)
  if (!caja) notFound()

  const [movimientos, metodos, clinica] = await Promise.all([obtenerMovimientos(id), obtenerMetodosPago(false), obtenerParametro("clinica.nombre", "Clínica SoftDent")])
  const totales = totalesPorMetodo(movimientos)
  const nombre = (c: string) => metodos.find((m) => m.codigo === c)?.nombre ?? c

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-5">
      <style>{`@media print { body * { visibility: hidden; } #cierre, #cierre * { visibility: visible; } #cierre { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <div className="flex items-center justify-between">
        <Link href="/caja" className="text-sm font-bold text-blue-600 hover:underline">
          ← Volver a caja
        </Link>
        <BotonImprimir />
      </div>

      <div id="cierre" className="space-y-5">
        <header className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">{clinica}</p>
            <h1 className="text-2xl font-black text-gray-900">
              Caja N° {caja.numero} · {caja.estado === "ABIERTA" ? "Abierta" : "Cerrada"}
            </h1>
            <p className="text-sm text-gray-500">
              Abierta {formatearFechaHora(caja.abierta_en)} por {caja.abridor?.nombre_completo}
              {caja.cerrada_en && ` · Cerrada ${formatearFechaHora(caja.cerrada_en)} por ${caja.cerrador?.nombre_completo}`}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-gray-500">Monto inicial</dt>
            <dd className="text-right font-bold">{formatearPesos(caja.monto_inicial)}</dd>
            <dt className="text-gray-500">Efectivo esperado</dt>
            <dd className="text-right font-bold">{formatearPesos(caja.monto_esperado)}</dd>
            <dt className="text-gray-500">Efectivo contado</dt>
            <dd className="text-right font-bold">{formatearPesos(caja.monto_contado)}</dd>
            <dt className="text-gray-500">Diferencia</dt>
            <dd className={`text-right font-black ${caja.diferencia ? "text-rose-700" : "text-emerald-700"}`}>{formatearPesos(caja.diferencia)}</dd>
          </dl>
          {caja.justificacion && <p className="w-full text-sm font-semibold text-rose-700">Justificación: {caja.justificacion}</p>}
        </header>

        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Totales por método</h2>
          <table className="w-full text-sm">
            <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="text-left py-2">Método</th>
                <th className="text-right py-2">Ingresos</th>
                <th className="text-right py-2">Egresos</th>
              </tr>
            </thead>
            <tbody>
              {[...totales.entries()].map(([m, t]) => (
                <tr key={m} className="border-b border-gray-100">
                  <td className="py-2 font-semibold">{nombre(m)}</td>
                  <td className="py-2 text-right text-emerald-700 font-bold">{formatearPesos(t.ingresos)}</td>
                  <td className="py-2 text-right text-rose-700 font-bold">{formatearPesos(t.egresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <TablaMovimientos movimientos={movimientos} metodos={metodos.map((m) => ({ codigo: m.codigo, nombre: m.nombre }))} />
      </div>
    </div>
  )
}

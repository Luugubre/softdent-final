import Link from "next/link"
import { notFound } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { obtenerPago } from "@/lib/pagos"
import { obtenerPaciente } from "@/lib/paciente"
import { formatearRut } from "@/lib/validaciones"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { infoMetodo } from "@/types/pago"
import { BotonImprimir } from "@/components/pagos/BotonImprimir"
import { obtenerParametro } from "@/lib/catalogos"

export default async function ComprobantePage({ params }: { params: Promise<{ id: string; pagoId: string }> }) {
  await requerirPermiso("pagos.ver")
  const { id, pagoId } = await params

  const [pago, paciente] = await Promise.all([obtenerPago(pagoId), obtenerPaciente(id)])
  if (!pago || !paciente || pago.paciente_id !== id) notFound()

  const anulado = pago.estado === "ANULADO"
  const clinica = await obtenerParametro("clinica.nombre", "Clínica SoftDent")

  return (
    <div className="space-y-4">
      <style>{`@media print {
        body * { visibility: hidden; }
        #comprobante, #comprobante * { visibility: visible; }
        #comprobante { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
      }`}</style>

      <div className="flex items-center justify-between">
        <Link href={`/pacientes/${id}/pagos`} className="text-sm font-bold text-blue-600 hover:underline">
          ← Volver a pagos
        </Link>
        <BotonImprimir />
      </div>

      <article id="comprobante" className="relative max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
        {anulado && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-7xl font-black text-rose-500/20 -rotate-12">ANULADO</span>
          </div>
        )}

        <header className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <p className="text-2xl font-black text-blue-700">{clinica}</p>
            <p className="text-xs font-semibold text-gray-500">Comprobante de pago</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-gray-900">N° {String(pago.numero).padStart(6, "0")}</p>
            <p className="text-xs font-semibold text-gray-500">{formatearFechaHora(pago.fecha)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Paciente</p>
            <p className="font-bold text-gray-900">
              {paciente.nombres} {paciente.apellidos}
            </p>
            <p className="text-gray-600">
              {paciente.extranjero ? "Documento" : "RUT"} {paciente.extranjero ? paciente.rut : formatearRut(paciente.rut)} · Ficha #
              {paciente.numero_ficha}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Método</p>
            <p className="font-bold text-gray-900">{infoMetodo(pago.metodo).etiqueta}</p>
            {pago.referencia && <p className="text-gray-600">Ref. {pago.referencia}</p>}
            {pago.numero_boleta && <p className="text-gray-600">Boleta {pago.numero_boleta}</p>}
          </div>
        </section>

        <table className="w-full text-sm">
          <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
            <tr>
              <th className="text-left py-2">Prestación</th>
              <th className="text-left py-2">Tratamiento</th>
              <th className="text-right py-2">Monto</th>
            </tr>
          </thead>
          <tbody>
            {pago.detalle.map((d) => (
              <tr key={d.id} className="border-b border-gray-100">
                <td className="py-2 font-semibold text-gray-800">
                  {d.item?.prestacion?.nombre ?? "Prestación"}
                  {d.item?.pieza ? <span className="text-gray-500"> · pieza {d.item.pieza}</span> : null}
                </td>
                <td className="py-2 text-gray-600">{d.item?.presupuesto ? `N° ${d.item.presupuesto.numero} · ${d.item.presupuesto.nombre}` : "—"}</td>
                <td className="py-2 text-right font-bold">{formatearPesos(d.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-3 text-right font-black text-gray-900">
                TOTAL PAGADO
              </td>
              <td className="pt-3 text-right text-xl font-black text-gray-900">{formatearPesos(pago.monto)}</td>
            </tr>
          </tfoot>
        </table>

        {pago.nota && <p className="text-sm text-gray-600">Nota: {pago.nota}</p>}

        <footer className="text-xs text-gray-500 border-t border-gray-200 pt-3 space-y-1">
          <p>Registrado por: {pago.registrador?.nombre_completo ?? "—"}</p>
          {anulado && (
            <p className="font-bold text-rose-700">
              Pago anulado el {formatearFechaHora(pago.fecha_anulacion)}
              {pago.anulador && ` por ${pago.anulador.nombre_completo}`}. Motivo: {pago.motivo_anulacion}
            </p>
          )}
          <p>Este comprobante es interno y no reemplaza a la boleta o factura.</p>
        </footer>
      </article>
    </div>
  )
}

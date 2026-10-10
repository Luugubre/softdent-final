import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { formatearRut } from "@/lib/validaciones"
import { formatearFecha, formatearFechaHora, formatearPesos } from "@/lib/formato"
import { fechaChile, obtenerLiquidacion } from "@/lib/liquidaciones"
import { ESTADO_LIQUIDACION, METODO_LIQUIDACION } from "@/types/liquidacion"
import { AccionesLiquidacion } from "@/components/liquidaciones/AccionesLiquidacion"
import { BotonImprimir } from "@/components/pagos/BotonImprimir"

export default async function LiquidacionPage({ params }: { params: Promise<{ liquidacionId: string }> }) {
  const usuario = await requerirPermiso("liquidaciones.ver")
  const gestionar = puede(usuario.rol, "liquidaciones.gestionar")
  const { liquidacionId } = await params

  const datos = await obtenerLiquidacion(liquidacionId)
  if (!datos) notFound()
  const { liquidacion: l, detalle } = datos
  if (!gestionar && l.profesional_id !== usuario.id) redirect("/sin-permiso")

  const estado = ESTADO_LIQUIDACION[l.estado]

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-4">
      <style>{`@media print {
        body * { visibility: hidden; }
        #liquidacion, #liquidacion * { visibility: visible; }
        #liquidacion { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
      }`}</style>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/liquidaciones/profesional/${l.profesional_id}`} className="text-sm font-bold text-blue-600 hover:underline">
          ← Volver al profesional
        </Link>
        <BotonImprimir />
      </div>

      {gestionar && l.estado === "EMITIDA" && <AccionesLiquidacion liquidacionId={l.id} />}

      <article id="liquidacion" className="relative max-w-4xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
        {l.estado === "ANULADA" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-8xl font-black text-rose-500/20 -rotate-12">ANULADA</span>
          </div>
        )}

        <header className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <p className="text-2xl font-black text-blue-700">SoftDent</p>
            <p className="text-xs font-semibold text-gray-500">Liquidación de honorarios profesionales</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-lg font-black text-gray-900">N° {String(l.numero).padStart(6, "0")}</p>
            <p className="text-xs font-semibold text-gray-500">Emitida {formatearFechaHora(l.created_at)}</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-black ${estado.estilo}`}>{estado.etiqueta}</span>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="col-span-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Profesional</p>
            <p className="font-bold text-gray-900">{l.profesional?.nombre_completo}</p>
            <p className="text-gray-600">
              {l.profesional?.rut ? `RUT ${formatearRut(l.profesional.rut)}` : ""}
              {l.profesional?.registro_profesional ? ` · Reg. ${l.profesional.registro_profesional}` : ""}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Liquidado hasta</p>
            <p className="font-bold text-gray-900">{formatearFecha(l.fecha_corte)}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Porcentaje</p>
            <p className="font-bold text-gray-900">{l.porcentaje}%</p>
          </div>
        </section>

        <table className="w-full text-sm">
          <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
            <tr>
              <th className="text-left py-2">Paciente</th>
              <th className="text-left py-2">Prestación</th>
              <th className="text-left py-2">Terminada</th>
              <th className="text-left py-2">Pagada</th>
              <th className="text-right py-2">Valor</th>
              <th className="text-right py-2">{l.porcentaje}%</th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((d) => (
              <tr key={d.id} className="border-b border-gray-100">
                <td className="py-2 font-semibold text-gray-800">{d.paciente_nombre}</td>
                <td className="py-2 text-gray-700">
                  {d.prestacion_nombre}
                  {d.pieza ? ` · pieza ${d.pieza}` : ""}
                  <span className="text-gray-400"> · {d.tramo}</span>
                </td>
                <td className="py-2 whitespace-nowrap text-gray-600">{formatearFecha(fechaChile(d.fecha_realizado))}</td>
                <td className="py-2 whitespace-nowrap text-gray-600">{formatearFecha(fechaChile(d.fecha_pagado))}</td>
                <td className="py-2 text-right">{formatearPesos(d.monto_base)}</td>
                <td className="py-2 text-right font-bold">{formatearPesos(d.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right font-bold text-gray-600">
                Producción ({l.cantidad} prestaciones)
              </td>
              <td className="pt-3 text-right font-bold">{formatearPesos(l.total_base)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5} className="pt-1 text-right font-black text-gray-900">
                TOTAL A PAGAR AL PROFESIONAL
              </td>
              <td className="pt-1 text-right text-xl font-black text-gray-900">{formatearPesos(l.total)}</td>
            </tr>
          </tfoot>
        </table>

        {l.nota && <p className="text-sm text-gray-600">Nota: {l.nota}</p>}

        <footer className="text-xs text-gray-500 border-t border-gray-200 pt-3 space-y-1">
          <p>Generada por: {l.creador?.nombre_completo ?? "—"}</p>
          {l.estado === "PAGADA" && (
            <p className="font-bold text-emerald-700">
              Pagada el {formatearFechaHora(l.fecha_pago)} por {l.pagador?.nombre_completo ?? "—"} ·{" "}
              {l.metodo_pago ? METODO_LIQUIDACION[l.metodo_pago] : ""}
              {l.referencia_pago ? ` · N° ${l.referencia_pago}` : ""}
            </p>
          )}
          {l.estado === "ANULADA" && (
            <p className="font-bold text-rose-700">
              Anulada el {formatearFechaHora(l.fecha_anulacion)} por {l.anulador?.nombre_completo ?? "—"}. Motivo: {l.motivo_anulacion}
            </p>
          )}
          {l.estado !== "ANULADA" && (
            <div className="grid grid-cols-2 gap-10 pt-12">
              <p className="border-t border-gray-400 pt-1 text-center">Firma clínica</p>
              <p className="border-t border-gray-400 pt-1 text-center">Firma profesional</p>
            </div>
          )}
        </footer>
      </article>
    </div>
  )
}

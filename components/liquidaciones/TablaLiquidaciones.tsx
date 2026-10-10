import Link from "next/link"
import { formatearFecha, formatearFechaHora, formatearPesos } from "@/lib/formato"
import { ESTADO_LIQUIDACION, type Liquidacion } from "@/types/liquidacion"

export function TablaLiquidaciones({ liquidaciones, mostrarProfesional = true }: { liquidaciones: Liquidacion[]; mostrarProfesional?: boolean }) {
  if (liquidaciones.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm font-semibold text-gray-400">
        Aún no hay liquidaciones.
      </p>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
          <tr>
            <th className="text-left px-4 py-2">N°</th>
            {mostrarProfesional && <th className="text-left px-4 py-2">Profesional</th>}
            <th className="text-left px-4 py-2">Emitida</th>
            <th className="text-left px-4 py-2">Hasta</th>
            <th className="text-right px-4 py-2">Prestaciones</th>
            <th className="text-right px-4 py-2">Producción</th>
            <th className="text-right px-4 py-2">%</th>
            <th className="text-right px-4 py-2">A pagar</th>
            <th className="text-left px-4 py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {liquidaciones.map((l) => (
            <tr key={l.id} className={`border-t border-gray-100 ${l.estado === "ANULADA" ? "text-gray-400" : ""}`}>
              <td className="px-4 py-2.5">
                <Link href={`/liquidaciones/${l.id}`} className="font-black text-blue-700 hover:underline">
                  N° {l.numero}
                </Link>
              </td>
              {mostrarProfesional && <td className="px-4 py-2.5 font-semibold">{l.profesional?.nombre_completo}</td>}
              <td className="px-4 py-2.5 whitespace-nowrap">{formatearFechaHora(l.created_at)}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{formatearFecha(l.fecha_corte)}</td>
              <td className="px-4 py-2.5 text-right">{l.cantidad}</td>
              <td className="px-4 py-2.5 text-right">{formatearPesos(l.total_base)}</td>
              <td className="px-4 py-2.5 text-right">{l.porcentaje}%</td>
              <td className="px-4 py-2.5 text-right font-black">{formatearPesos(l.total)}</td>
              <td className="px-4 py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black whitespace-nowrap ${ESTADO_LIQUIDACION[l.estado].estilo}`}>
                  {ESTADO_LIQUIDACION[l.estado].etiqueta}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

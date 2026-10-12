import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { formatearFecha, formatearPesos, hoyChile } from "@/lib/formato"
import {
  fechaChile,
  montoProfesional,
  motivoEspera,
  obtenerLiquidaciones,
  obtenerProduccionPendiente,
  obtenerProfesional,
  resumirProduccion,
} from "@/lib/liquidaciones"
import { GenerarLiquidacion } from "@/components/liquidaciones/GenerarLiquidacion"
import { TablaLiquidaciones } from "@/components/liquidaciones/TablaLiquidaciones"
import type { Produccion } from "@/types/liquidacion"

function Prestacion({ p }: { p: Produccion }) {
  return (
    <>
      <Link href={`/pacientes/${p.paciente_id}/pagos`} className="font-bold text-gray-900 hover:text-blue-700 hover:underline">
        {p.paciente_nombre}
      </Link>
      <p className="text-xs text-gray-500">
        {p.prestacion_nombre}
        {p.pieza ? ` · pieza ${p.pieza}` : ""} · Trat. N° {p.tratamiento_numero} · tramo {p.progreso_anterior}% → {p.progreso_nuevo}%
      </p>
    </>
  )
}

export default async function ProfesionalLiquidacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ profesionalId: string }>
  searchParams: Promise<{ periodo?: string }>
}) {
  const usuario = await requerirPermiso("liquidaciones.ver")
  const gestionar = puede(usuario.rol, "liquidaciones.gestionar")
  const { profesionalId } = await params
  if (!gestionar && profesionalId !== usuario.id) redirect("/sin-permiso")

  const hoy = hoyChile()
  const mesActual = hoy.slice(0, 7)
  const { periodo: p } = await searchParams
  const periodo = p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p) && p <= mesActual ? p : mesActual
  // Fin del mes elegido (o hoy, si es el mes en curso)
  const [anio, mes] = periodo.split("-").map(Number)
  const finMes = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10)
  const hasta = finMes < hoy ? finMes : hoy

  const [profesional, produccion, liquidaciones] = await Promise.all([
    obtenerProfesional(profesionalId),
    obtenerProduccionPendiente(profesionalId),
    obtenerLiquidaciones(profesionalId),
  ])
  if (!profesional) notFound()

  const r = resumirProduccion(produccion, hasta)
  const pct = profesional.porcentaje_liquidacion

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Link href="/liquidaciones" className="text-sm font-bold text-blue-600 hover:underline">
        ← Volver a liquidaciones
      </Link>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{profesional.nombre_completo}</h1>
          <p className="text-sm font-semibold text-gray-500">
            Porcentaje de liquidación: <strong className="text-gray-900">{pct !== null ? `${pct}%` : "sin configurar"}</strong>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-emerald-800">
            <p className="text-[11px] font-black uppercase tracking-wider">A liquidar</p>
            <p className="text-xl font-black">{formatearPesos(r.aPagar)}</p>
          </div>
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800">
            <p className="text-[11px] font-black uppercase tracking-wider">En espera</p>
            <p className="text-xl font-black">{formatearPesos(r.esperaAPagar)}</p>
          </div>
        </div>
      </div>

      {gestionar && (
        <GenerarLiquidacion
          profesionalId={profesionalId}
          periodo={periodo}
          mesActual={mesActual}
          base={r.baseLiquidable}
          aPagar={r.aPagar}
          porcentaje={pct}
          cantidad={r.liquidables.length}
          sinPorcentaje={pct === null}
        />
      )}

      {/* LISTO PARA LIQUIDAR */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">✅ Listo para liquidar (hasta el {formatearFecha(hasta)})</h2>
          <p className="text-xs font-medium text-gray-500">Prestaciones evolucionadas al 100% y pagadas al 100%.</p>
        </div>
        {r.liquidables.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm font-semibold text-gray-400">
            No hay prestaciones terminadas y pagadas pendientes de liquidar.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Paciente / prestación</th>
                  <th className="text-left px-4 py-2">Terminada</th>
                  <th className="text-left px-4 py-2">Pagada</th>
                  <th className="text-right px-4 py-2">Valor del tramo</th>
                  <th className="text-right px-4 py-2">{pct !== null ? `${pct}%` : "%"}</th>
                </tr>
              </thead>
              <tbody>
                {r.liquidables.map((p) => (
                  <tr key={p.avance_id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      <Prestacion p={p} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatearFecha(fechaChile(p.completado_en))}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatearFecha(fechaChile(p.fecha_pagado))}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatearPesos(p.monto_base)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-700">
                      {formatearPesos(montoProfesional(p.monto_base, pct))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-right font-black">TOTAL</td>
                  <td className="px-4 py-2.5 text-right font-black">{formatearPesos(r.baseLiquidable)}</td>
                  <td className="px-4 py-2.5 text-right text-lg font-black text-emerald-700">{formatearPesos(r.aPagar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {r.posteriores.length > 0 && (
          <p className="text-xs font-semibold text-gray-500">
            + {r.posteriores.length} tramo(s) quedaron listos después del {formatearFecha(hasta)} y entrarán en una próxima liquidación.
          </p>
        )}
      </section>

      {/* EN ESPERA */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">⏳ En espera</h2>
          <p className="text-xs font-medium text-gray-500">Lo que evolucionó, pero aún no está al 100% o no está pagado completo.</p>
        </div>
        {r.enEspera.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm font-semibold text-gray-400">
            Nada en espera.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Paciente / prestación</th>
                  <th className="text-left px-4 py-2">Falta</th>
                  <th className="text-right px-4 py-2">Valor del tramo</th>
                  <th className="text-right px-4 py-2">Le corresponderá</th>
                </tr>
              </thead>
              <tbody>
                {r.enEspera.map((p) => (
                  <tr key={p.avance_id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      <Prestacion p={p} />
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold text-amber-700">{motivoEspera(p)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatearPesos(p.monto_base)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-500">{formatearPesos(montoProfesional(p.monto_base, pct))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-gray-900">Liquidaciones anteriores</h2>
        <TablaLiquidaciones liquidaciones={liquidaciones} mostrarProfesional={false} />
      </section>
    </div>
  )
}

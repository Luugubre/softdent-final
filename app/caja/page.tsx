import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { efectivoEsperado, obtenerCajaAbierta, obtenerCajasCerradas, obtenerMovimientos, resumenCaja } from "@/lib/caja"
import { obtenerMetodosPago } from "@/lib/catalogos"
import { fechaValida, hoyEnChile, primeroDelMes } from "@/lib/fechas-agenda"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { GestionCaja } from "@/components/caja/GestionCaja"
import { ComoFunciona, Encabezado, SeConfigura, Termino } from "@/components/ui/Ayuda"
import { puede } from "@/lib/permisos"

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const usuario = await requerirPermiso("caja.gestionar")
  const sp = await searchParams
  const hoy = hoyEnChile()
  const desde = fechaValida(sp.desde) ? sp.desde : primeroDelMes(hoy)
  const hasta = fechaValida(sp.hasta) ? sp.hasta : hoy

  const caja = await obtenerCajaAbierta()
  const [movimientos, esperado, metodos, todosMetodos, cerradas, resumen] = await Promise.all([
    caja ? obtenerMovimientos(caja.id) : Promise.resolve([]),
    caja ? efectivoEsperado(caja.id) : Promise.resolve(0),
    obtenerMetodosPago(true),
    obtenerMetodosPago(false),
    obtenerCajasCerradas(),
    resumenCaja(desde, hasta),
  ])
  const totalIngresos = resumen.reduce((s, r) => s + r.ingresos, 0)
  const totalEgresos = resumen.reduce((s, r) => s + r.egresos, 0)

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-8">
      <div className="space-y-3">
        <Encabezado
          icono="💰"
          titulo="Caja"
          descripcion="El dinero que entra y sale durante el turno: apertura, movimientos, arqueo y cierre."
          migas={[{ etiqueta: "Caja" }]}
        />
        <ComoFunciona
          pasos={[
            <>Al comenzar el turno, <strong>abre la caja</strong> con el sencillo (<Termino t="monto_inicial" />).</>,
            <>Los pagos de pacientes, cuotas de convenio y liquidaciones en efectivo <strong>entran solos</strong> como movimientos.</>,
            <>Gastos menores o retiros se registran en <strong>Registrar movimiento manual</strong>.</>,
            <>Al terminar, cuenta el efectivo (<Termino t="arqueo" />), escribe el monto y <strong>cierra la caja</strong>.</>,
          ]}
          reglas={[
            <>Solo puede haber <strong>una caja abierta</strong> a la vez.</>,
            <>Sin caja abierta no se reciben pagos de métodos que <Termino t="entra_caja">entran a caja</Termino>.</>,
            <>Si el contado no calza con el <Termino t="esperado">esperado</Termino>, la diferencia se justifica.</>,
            <>Una caja cerrada <strong>no se modifica</strong>: los errores se corrigen con un <Termino t="ajuste" /> en la caja abierta.</>,
          ]}
        />
        {puede(usuario.rol, "administracion.gestionar") && (
          <SeConfigura items={[{ que: "Métodos de pago y si entran a caja", etiqueta: "Administración › Métodos de pago", href: "/administracion#metodos-pago" }]} />
        )}
      </div>

      <GestionCaja
        caja={caja}
        movimientos={movimientos}
        esperado={esperado}
        metodos={metodos.filter((m) => m.registra_en_caja)}
        usuario={usuario.nombre_completo}
      />

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <form className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Resumen por período</h2>
            <p className="text-xs font-semibold text-gray-500">Cuánto entró y salió por cada método de pago entre dos fechas (todas las cajas).</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs font-bold text-gray-500">
              Desde
              <input type="date" name="desde" defaultValue={desde} className="block rounded-lg border border-gray-300 px-2 py-1 text-sm font-semibold" />
            </label>
            <label className="text-xs font-bold text-gray-500">
              Hasta
              <input type="date" name="hasta" defaultValue={hasta} className="block rounded-lg border border-gray-300 px-2 py-1 text-sm font-semibold" />
            </label>
            <button className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600">Ver</button>
          </div>
        </form>
        {resumen.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">Sin movimientos en el período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="text-left py-2">Método</th>
                <th className="text-right py-2">Movimientos</th>
                <th className="text-right py-2">Ingresos</th>
                <th className="text-right py-2">Egresos</th>
                <th className="text-right py-2">Neto</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.metodo} className="border-b border-gray-100">
                  <td className="py-2 font-semibold">{r.nombre}</td>
                  <td className="py-2 text-right">{r.cantidad}</td>
                  <td className="py-2 text-right text-emerald-700 font-bold">{formatearPesos(r.ingresos)}</td>
                  <td className="py-2 text-right text-rose-700 font-bold">{formatearPesos(r.egresos)}</td>
                  <td className="py-2 text-right font-black">{formatearPesos(r.ingresos - r.egresos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2 font-black">Total</td>
                <td />
                <td className="pt-2 text-right font-black text-emerald-700">{formatearPesos(totalIngresos)}</td>
                <td className="pt-2 text-right font-black text-rose-700">{formatearPesos(totalEgresos)}</td>
                <td className="pt-2 text-right font-black">{formatearPesos(totalIngresos - totalEgresos)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Cajas cerradas</h2>
          <p className="text-xs font-semibold text-gray-500">Historial de turnos. Haz clic en el N° para ver e imprimir el detalle de una caja.</p>
        </div>
        {cerradas.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">Aún no hay cajas cerradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2">N°</th>
                  <th className="text-left py-2">Apertura</th>
                  <th className="text-left py-2">Cierre</th>
                  <th className="text-right py-2">Esperado</th>
                  <th className="text-right py-2">Contado</th>
                  <th className="text-right py-2">Diferencia</th>
                  <th className="text-left py-2 pl-3">Justificación</th>
                </tr>
              </thead>
              <tbody>
                {cerradas.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2">
                      <Link href={`/caja/${c.id}`} className="font-black text-blue-700 hover:underline">
                        N° {c.numero}
                      </Link>
                    </td>
                    <td className="py-2 text-xs">
                      {formatearFechaHora(c.abierta_en)}
                      <span className="block text-gray-400">{c.abridor?.nombre_completo}</span>
                    </td>
                    <td className="py-2 text-xs">
                      {formatearFechaHora(c.cerrada_en)}
                      <span className="block text-gray-400">{c.cerrador?.nombre_completo}</span>
                    </td>
                    <td className="py-2 text-right">{formatearPesos(c.monto_esperado)}</td>
                    <td className="py-2 text-right">{formatearPesos(c.monto_contado)}</td>
                    <td className={`py-2 text-right font-black ${c.diferencia === 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatearPesos(c.diferencia)}</td>
                    <td className="py-2 pl-3 text-xs text-gray-600">{c.justificacion ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400">Métodos registrados: {todosMetodos.map((m) => m.nombre).join(", ")}</p>
      </section>
    </div>
  )
}

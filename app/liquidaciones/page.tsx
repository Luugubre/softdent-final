import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { formatearPesos } from "@/lib/formato"
import { obtenerLiquidaciones, obtenerProduccionPendiente, obtenerProfesionales, resumirProduccion } from "@/lib/liquidaciones"
import { PorcentajeProfesional } from "@/components/liquidaciones/PorcentajeProfesional"
import { TablaLiquidaciones } from "@/components/liquidaciones/TablaLiquidaciones"
import { ComoFunciona, Encabezado, Termino } from "@/components/ui/Ayuda"
import { BotonExcel } from "@/components/ui/BotonExcel"

export default async function LiquidacionesPage() {
  const usuario = await requerirPermiso("liquidaciones.ver")
  const gestionar = puede(usuario.rol, "liquidaciones.gestionar")
  const soloYo = gestionar ? undefined : usuario.id

  const [profesionales, produccion, liquidaciones] = await Promise.all([
    obtenerProfesionales(),
    obtenerProduccionPendiente(soloYo),
    obtenerLiquidaciones(soloYo),
  ])

  const ids = new Set([...profesionales.map((p) => p.id), ...produccion.map((p) => p.profesional_id)])
  const lista = [...ids]
    .filter((id) => !soloYo || id === soloYo)
    .map((id) => {
      const perfil = profesionales.find((p) => p.id === id)
      const propia = produccion.filter((p) => p.profesional_id === id)
      return {
        id,
        nombre: perfil?.nombre_completo ?? propia[0]?.profesional_nombre ?? "—",
        activo: perfil?.activo ?? true,
        porcentaje: perfil ? perfil.porcentaje_liquidacion : (propia[0]?.porcentaje ?? null),
        ...resumirProduccion(propia),
      }
    })
    .sort((a, b) => b.aPagar - a.aPagar || a.nombre.localeCompare(b.nombre))

  const porPagar = liquidaciones.filter((l) => l.estado === "CALCULADA" || l.estado === "APROBADA").reduce((s, l) => s + l.total, 0)

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="👩‍⚕️"
        titulo={gestionar ? "Liquidaciones" : "Mis liquidaciones"}
        descripcion="Lo que se le paga a cada dentista: su % sobre las prestaciones que terminó (100%) y que el paciente ya pagó (100%)."
        migas={[{ etiqueta: gestionar ? "Liquidaciones" : "Mis liquidaciones" }]}
        acciones={
          <>
            <BotonExcel href="/liquidaciones/excel" />
            {porPagar > 0 && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800">
                <p className="text-[11px] font-black uppercase tracking-wider">Liquidaciones por pagar</p>
                <p className="text-xl font-black">{formatearPesos(porPagar)}</p>
              </div>
            )}
          </>
        }
      />
      <ComoFunciona
        pasos={
          gestionar
            ? [
                <>Define el <Termino t="porcentaje">%</Termino> de cada dentista en la columna “% liquidación” (ej. 40 o 50).</>,
                <>Presiona <strong>Ver / liquidar</strong>, elige el mes y agrega bonificación, ajuste o descuento si corresponde.</>,
                <>Presiona <strong>Calcular liquidación</strong> y revisa el detalle.</>,
                <>Si está bien, <strong>Aprobar</strong>; cuando le pagues al dentista, <strong>Registrar pago</strong>.</>,
              ]
            : [
                <>Aquí ves lo que tienes <strong>listo para liquidar</strong> y lo que está <strong>en espera</strong>.</>,
                <>En el historial están tus liquidaciones y su estado.</>,
              ]
        }
        reglas={[
          <>Solo es <Termino t="liquidable" /> lo evolucionado al <strong>100%</strong> y pagado al <strong>100%</strong>.</>,
          <>Una liquidación por dentista y por mes. Estados: <Termino t="estado_liquidacion">Calculada → Aprobada → Pagada</Termino>.</>,
          <>Si se paga en efectivo, el dinero sale de la caja abierta.</>,
          <>Una liquidación pagada no se modifica: se corrige con un ajuste el mes siguiente.</>,
        ]}
      />

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Profesional</th>
              <th className="text-left px-4 py-3">
                % liquidación
                <span className="block text-[10px] font-semibold normal-case tracking-normal text-gray-400">Lo que gana el dentista</span>
              </th>
              <th className="text-right px-4 py-3">
                Listo para liquidar
                <span className="block text-[10px] font-semibold normal-case tracking-normal text-gray-400">Terminado al 100% y pagado</span>
              </th>
              <th className="text-right px-4 py-3">
                En espera
                <span className="block text-[10px] font-semibold normal-case tracking-normal text-gray-400">Falta terminar o que paguen</span>
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center font-semibold text-gray-400">
                  No hay dentistas registrados.
                </td>
              </tr>
            )}
            {lista.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-3">
                  <p className="font-extrabold text-gray-900">{p.nombre}</p>
                  {!p.activo && <p className="text-xs font-semibold text-gray-400">Usuario desactivado</p>}
                </td>
                <td className="px-4 py-3">
                  {gestionar ? (
                    <PorcentajeProfesional profesionalId={p.id} porcentaje={p.porcentaje} />
                  ) : (
                    <span className="font-black">{p.porcentaje !== null ? `${p.porcentaje}%` : "Sin configurar"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className={`text-lg font-black ${p.aPagar > 0 ? "text-emerald-700" : "text-gray-300"}`}>{formatearPesos(p.aPagar)}</p>
                  <p className="text-xs text-gray-500">
                    {p.liquidables.length} tramo(s) · producción {formatearPesos(p.baseLiquidable)}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-bold text-amber-700">{formatearPesos(p.esperaAPagar)}</p>
                  <p className="text-xs text-gray-500">{p.enEspera.length} sin terminar o sin pagar</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/liquidaciones/profesional/${p.id}`}
                    className="inline-block px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 whitespace-nowrap"
                  >
                    {gestionar ? "Ver / liquidar →" : "Ver detalle →"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Historial de liquidaciones</h2>
          <p className="text-xs font-semibold text-gray-500">Haz clic en el N° para ver el detalle, aprobar, pagar o imprimir.</p>
        </div>
        <TablaLiquidaciones liquidaciones={liquidaciones} mostrarProfesional={gestionar} />
      </section>
    </div>
  )
}

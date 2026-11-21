import Link from "next/link"
import { redirect } from "next/navigation"
import { requerirUsuario } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { Encabezado } from "@/components/ui/Ayuda"
import { fechaTitulo, fechaValida, hoyEnChile, primeroDelMes, sumarDias, sumarMeses } from "@/lib/fechas-agenda"
import { formatearPesos } from "@/lib/formato"
import { reporteDesempeno } from "@/lib/reportes"
import { indicadores, sumar, type FilaDesempeno } from "@/lib/reportes-calculo"
import { ExportarDesempeno } from "@/components/reportes/ExportarDesempeno"

const PERIODOS = [
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "mes_anterior", etiqueta: "Mes anterior" },
  { valor: "trimestre", etiqueta: "Últimos 3 meses" },
  { valor: "anio", etiqueta: "Últimos 12 meses" },
] as const

function dias(desde: string, hasta: string) {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1
}

function resolverPeriodo(sp: { periodo?: string; desde?: string; hasta?: string }, hoy: string) {
  if (fechaValida(sp.desde) && fechaValida(sp.hasta)) {
    let [d, h] = sp.desde <= sp.hasta ? [sp.desde, sp.hasta] : [sp.hasta, sp.desde]
    if (h > hoy) h = hoy
    if (d > h) d = h
    if (dias(d, h) > 366) d = sumarDias(h, -365)
    return { periodo: "personalizado", desde: d, hasta: h }
  }
  const inicioMes = primeroDelMes(hoy)
  switch (sp.periodo) {
    case "mes_anterior":
      return { periodo: "mes_anterior", desde: sumarMeses(inicioMes, -1), hasta: sumarDias(inicioMes, -1) }
    case "trimestre":
      return { periodo: "trimestre", desde: sumarMeses(inicioMes, -2), hasta: hoy }
    case "anio":
      return { periodo: "anio", desde: sumarMeses(inicioMes, -11), hasta: hoy }
    default:
      return { periodo: "mes", desde: inicioMes, hasta: hoy }
  }
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("es-CL")}%`)
const horas = (min: number) => `${(Math.round((min / 60) * 10) / 10).toLocaleString("es-CL")} h`

function Variacion({ actual, anterior, invertir = false }: { actual: number | null; anterior: number | null; invertir?: boolean }) {
  if (actual === null || anterior === null || anterior === 0) return null
  const cambio = Math.round(((actual - anterior) / Math.abs(anterior)) * 100)
  if (cambio === 0) return <span className="text-[11px] font-bold text-gray-400">= período anterior</span>
  const bueno = invertir ? cambio < 0 : cambio > 0
  return (
    <span className={`text-[11px] font-bold ${bueno ? "text-emerald-600" : "text-rose-600"}`}>
      {cambio > 0 ? "▲" : "▼"} {Math.abs(cambio)}% vs período anterior
    </span>
  )
}

function Barra({ valor, color }: { valor: number | null; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(valor ?? 0, 100)}%` }} />
      </div>
      <span className="w-12 text-right text-[11px] font-bold text-gray-700">{pct(valor)}</span>
    </div>
  )
}

export default async function DesempenoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>
}) {
  const usuario = await requerirUsuario()
  const verTodos = puede(usuario.rol, "reportes.ver")
  if (!verTodos && usuario.rol !== "DENTISTA") redirect("/sin-permiso")

  const hoy = hoyEnChile()
  const { periodo, desde, hasta } = resolverPeriodo(await searchParams, hoy)
  const largo = dias(desde, hasta)
  const antHasta = sumarDias(desde, -1)
  const antDesde = sumarDias(antHasta, 1 - largo)

  const propio = (f: FilaDesempeno[]) => (verTodos ? f : f.filter((x) => x.profesional_id === usuario.id))
  const [filas, filasAnt] = await Promise.all([
    reporteDesempeno(desde, hasta).then(propio),
    reporteDesempeno(antDesde, antHasta).then(propio),
  ])
  const t = sumar(filas)
  const ta = sumar(filasAnt)
  const indAct = indicadores(t)
  const indAnt = indicadores(ta)

  const titulo = (f: string) => fechaTitulo(f, { day: "numeric", month: "short", year: "numeric" })
  const tarjeta = "bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-1"
  const k = "text-[11px] font-black uppercase tracking-wider text-gray-400"

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="📊"
        titulo={verTodos ? "Reporte de desempeño" : "Mi desempeño"}
        descripcion={`Del ${titulo(desde)} al ${titulo(hasta)} · comparado con el ${titulo(antDesde)} al ${titulo(antHasta)}.`}
        migas={[{ etiqueta: "Reporte de desempeño" }]}
        acciones={<ExportarDesempeno filas={filas} desde={desde} hasta={hasta} />}
      />

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1">
          {PERIODOS.map((p) => (
            <Link
              key={p.valor}
              href={`/reportes/desempeno?periodo=${p.valor}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold ${
                periodo === p.valor ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-white"
              }`}
            >
              {p.etiqueta}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-2 ml-auto" action="/reportes/desempeno">
          <label className="text-[10px] font-black uppercase text-gray-400">
            Desde
            <input type="date" name="desde" max={hoy} defaultValue={desde} required className="block mt-1 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold" />
          </label>
          <label className="text-[10px] font-black uppercase text-gray-400">
            Hasta
            <input type="date" name="hasta" max={hoy} defaultValue={hasta} required className="block mt-1 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold" />
          </label>
          <button className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-gray-800">Ver</button>
        </form>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={tarjeta}>
          <p className={k}>Citas</p>
          <p className="text-2xl font-black text-gray-900">{t.citas_total}</p>
          <p className="text-xs font-medium text-gray-500">{t.realizadas} atendidas · {t.pacientes_atendidos} pacientes</p>
          <Variacion actual={t.citas_total} anterior={ta.citas_total} />
        </div>
        <div className={tarjeta}>
          <p className={k}>Asistencia</p>
          <p className="text-2xl font-black text-emerald-600">{pct(indAct.asistencia)}</p>
          <p className="text-xs font-medium text-gray-500">{t.no_asistio} inasistencias · {t.canceladas} canceladas</p>
          <Variacion actual={indAct.asistencia} anterior={indAnt.asistencia} />
        </div>
        <div className={tarjeta}>
          <p className={k}>Ocupación de agenda</p>
          <p className="text-2xl font-black text-blue-600">{pct(indAct.ocupacion)}</p>
          <p className="text-xs font-medium text-gray-500">
            {horas(t.minutos_agendados)} de {horas(t.minutos_disponibles)}
          </p>
          <Variacion actual={indAct.ocupacion} anterior={indAnt.ocupacion} />
        </div>
        <div className={tarjeta}>
          <p className={k}>Producción clínica</p>
          <p className="text-2xl font-black text-gray-900">{formatearPesos(t.produccion)}</p>
          <p className="text-xs font-medium text-gray-500">Avances de prestaciones</p>
          <Variacion actual={t.produccion} anterior={ta.produccion} />
        </div>
        <div className={tarjeta}>
          <p className={k}>Aceptación de presupuestos</p>
          <p className="text-2xl font-black text-purple-600">{pct(indAct.aceptacion)}</p>
          <p className="text-xs font-medium text-gray-500">
            {t.presupuestos_aprobados} de {t.presupuestos_creados} aprobados
          </p>
          <Variacion actual={indAct.aceptacion} anterior={indAnt.aceptacion} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
              <tr>
                <th className="px-4 py-3">Dentista</th>
                <th className="px-4 py-3 text-right">Citas</th>
                <th className="px-4 py-3 text-right">Atendidas</th>
                <th className="px-4 py-3 text-right">No asistió</th>
                <th className="px-4 py-3">Asistencia</th>
                <th className="px-4 py-3">Ocupación</th>
                <th className="px-4 py-3 text-right">Producción</th>
                <th className="px-4 py-3 text-right">Presupuestos</th>
                <th className="px-4 py-3 text-right">Recetas</th>
                <th className="px-4 py-3 text-right">Documentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-400 font-medium">
                    No hay dentistas con actividad en el período.
                  </td>
                </tr>
              ) : (
                filas.map((f) => {
                  const i = indicadores(f)
                  return (
                    <tr key={f.profesional_id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{f.profesional_nombre}</td>
                      <td className="px-4 py-3 text-right font-semibold">{f.citas_total}</td>
                      <td className="px-4 py-3 text-right font-semibold">{f.realizadas}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">{f.no_asistio}</td>
                      <td className="px-4 py-3">
                        <Barra valor={i.asistencia} color="bg-emerald-500" />
                      </td>
                      <td className="px-4 py-3">
                        <Barra valor={i.ocupacion} color="bg-blue-500" />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">{formatearPesos(f.produccion)}</td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {f.presupuestos_aprobados}/{f.presupuestos_creados}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{f.recetas}</td>
                      <td className="px-4 py-3 text-right font-semibold">{f.documentos}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 font-medium">
        Asistencia: atendidas ÷ (atendidas + inasistencias). Ocupación: minutos agendados ÷ minutos del horario de atención (incluye
        horarios especiales). Producción: montos de avances de prestaciones registrados en el período.
      </p>
    </div>
  )
}

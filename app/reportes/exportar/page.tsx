import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { Encabezado } from "@/components/ui/Ayuda"
import { fechaValida, hoyEnChile, primeroDelMes } from "@/lib/fechas-agenda"

const REPORTES = [
  { tipo: "citas", icono: "📅", titulo: "Citas de la agenda", detalle: "Paciente, profesional, estado y motivo de cada cita del período.", conFechas: true },
  { tipo: "pagos", icono: "💰", titulo: "Pagos recibidos", detalle: "Pagos vigentes y anulados con método, boleta y quién los registró.", conFechas: true },
  { tipo: "pacientes", icono: "🧑‍⚕️", titulo: "Listado de pacientes", detalle: "Todos los pacientes con contacto, previsión y estado.", conFechas: false },
]

const OTROS = [
  { href: "/liquidaciones/excel", icono: "👩‍⚕️", titulo: "Liquidaciones", detalle: "Liquidaciones emitidas y producción por liquidar." },
  { href: "/reportes/desempeno", icono: "📊", titulo: "Desempeño", detalle: "Botón «Exportar» dentro del reporte de desempeño." },
  { href: "/pagos-pendientes", icono: "💳", titulo: "Pagos pendientes", detalle: "Botón «Excel» dentro de la lista de saldos." },
]

export default async function ExportarExcelPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  await requerirPermiso("reportes.ver")
  const sp = await searchParams
  const hoy = hoyEnChile()
  const desde = fechaValida(sp.desde) ? sp.desde : primeroDelMes(hoy)
  const hasta = fechaValida(sp.hasta) ? sp.hasta : hoy

  return (
    <div className="space-y-6">
      <Encabezado
        icono="📥"
        titulo="Exportar a Excel"
        descripcion="Descarga los datos de la clínica en planillas Excel para revisarlos o respaldarlos."
        migas={[{ etiqueta: "Reportes" }, { etiqueta: "Exportar Excel" }]}
      />

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-bold text-gray-600">
          Desde
          <input type="date" name="desde" defaultValue={desde} max={hoy} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-bold text-gray-600">
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} max={hoy} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700">Aplicar período</button>
        <p className="text-xs text-gray-500">El período se usa en los reportes de citas y pagos.</p>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        {REPORTES.map((r) => (
          <div key={r.tipo} className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-2xl">{r.icono}</p>
              <h2 className="mt-2 font-extrabold text-gray-900">{r.titulo}</h2>
              <p className="text-sm text-gray-500">{r.detalle}</p>
              {r.conFechas && <p className="mt-2 text-xs font-bold text-blue-700">{desde} → {hasta}</p>}
            </div>
            <a
              href={`/reportes/exportar/${r.tipo}${r.conFechas ? `?desde=${desde}&hasta=${hasta}` : ""}`}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-bold text-white hover:bg-emerald-700"
            >
              ⬇ Descargar Excel
            </a>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Otras exportaciones</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {OTROS.map((o) => (
            <Link key={o.href} href={o.href} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300">
              <p className="font-bold text-gray-900">
                {o.icono} {o.titulo}
              </p>
              <p className="text-xs text-gray-500">{o.detalle}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

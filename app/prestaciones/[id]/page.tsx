import Link from "next/link"
import { notFound } from "next/navigation"
import { getSupabase } from "@/lib/supabase"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerCatalogos } from "@/lib/prestaciones"
import { formatearFecha, formatearFechaHora, formatearPesos, hoyChile } from "@/lib/formato"
import { DatosPrestacion } from "@/components/prestaciones/DatosPrestacion"
import { CambiarPrecio } from "@/components/prestaciones/CambiarPrecio"
import { ProfesionalesHabilitados } from "@/components/prestaciones/ProfesionalesHabilitados"
import { BotonEstadoPrestacion } from "@/components/prestaciones/BotonEstadoPrestacion"
import { TIPO_ARANCEL_ETIQUETAS, type PrecioHistorico, type PrecioVigente, type Prestacion } from "@/types/prestacion"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PrestacionPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("prestaciones.ver")
  const gestionar = puede(usuario.rol, "prestaciones.gestionar")
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const supabase = getSupabase()
  const [{ data: prestacion }, catalogos, { data: historial }, { data: vigentes }, { data: dentistas }, { data: habilitados }] =
    await Promise.all([
      supabase.from("prestaciones").select("*").eq("id", id).maybeSingle(),
      obtenerCatalogos(),
      supabase.from("prestacion_precios").select("*").eq("prestacion_id", id).order("vigente_desde", { ascending: false }),
      supabase.from("v_precios_vigentes").select("*").eq("prestacion_id", id),
      supabase.from("perfiles").select("id, nombre_completo, especialidad").eq("rol", "DENTISTA").eq("activo", true).order("nombre_completo"),
      supabase.from("prestacion_profesionales").select("profesional_id").eq("prestacion_id", id),
    ])

  if (!prestacion) notFound()
  const p = prestacion as Prestacion
  const precios = (historial ?? []) as PrecioHistorico[]
  const preciosHoy = new Map(((vigentes ?? []) as PrecioVigente[]).map((v) => [v.arancel_id, v]))
  const hoy = hoyChile()

  const autoresIds = [...new Set(precios.map((x) => x.creado_por).filter(Boolean))] as string[]
  const autores = new Map<string, string>()
  if (autoresIds.length) {
    const { data } = await supabase.from("perfiles").select("id, nombre_completo").in("id", autoresIds)
    data?.forEach((a) => autores.set(a.id, a.nombre_completo))
  }

  const categoria = catalogos.categorias.find((c) => c.id === p.categoria_id)
  const especialidad = catalogos.especialidades.find((x) => x.id === p.especialidad_id)

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 text-xs font-bold text-gray-400">
        <Link href="/" className="hover:text-blue-600">
          Inicio
        </Link>
        <span aria-hidden>›</span>
        <Link href="/prestaciones" className="hover:text-blue-600">
          Prestaciones
        </Link>
        <span aria-hidden>›</span>
        <span className="text-gray-600">{p.nombre}</span>
      </nav>

      <header className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-mono font-bold text-gray-500">
            {p.codigo_interno}
            {p.codigo_fonasa && ` · FONASA ${p.codigo_fonasa}`}
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">{p.nombre}</h1>
          <p className="text-sm font-medium text-gray-600">
            {categoria?.nombre}
            {especialidad && ` · ${especialidad.nombre}`} · {p.duracion_min} min
          </p>
        </div>
        <BotonEstadoPrestacion prestacionId={p.id} activo={p.activo} puedeCambiar={gestionar} />
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <DatosPrestacion
          prestacion={p}
          categoria={categoria?.nombre}
          especialidad={especialidad?.nombre}
          puedeEditar={gestionar}
          aranceles={catalogos.aranceles}
          categorias={catalogos.categorias.filter((c) => c.activo || c.id === p.categoria_id)}
          especialidades={catalogos.especialidades.filter((x) => x.activo || x.id === p.especialidad_id)}
        />

        <ProfesionalesHabilitados
          prestacionId={p.id}
          dentistas={dentistas ?? []}
          seleccionados={(habilitados ?? []).map((h) => h.profesional_id)}
          puedeEditar={gestionar}
        />
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Precios por arancel</h2>
          <p className="text-xs font-semibold text-gray-500">
            El precio de esta prestación en cada lista de precios. Un cambio rige desde la fecha que indiques y no modifica los tratamientos ya creados.
          </p>
        </div>

        <div className="space-y-4">
          {catalogos.aranceles
            .filter((a) => a.activo)
            .map((a) => {
              const hoyPrecio = preciosHoy.get(a.id)
              const historialArancel = precios.filter((x) => x.arancel_id === a.id)
              const futuros = historialArancel.filter((x) => x.vigente_desde > hoy)

              return (
                <div key={a.id} className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-gray-900">
                        {a.nombre}
                        <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                          {TIPO_ARANCEL_ETIQUETAS[a.tipo]}
                          {a.es_base && " · base"}
                        </span>
                      </p>
                      <p className="text-2xl font-black text-gray-900">
                        {hoyPrecio?.precio ? formatearPesos(hoyPrecio.precio) : <span className="text-gray-300">Sin precio</span>}
                      </p>
                      {hoyPrecio?.precio && !hoyPrecio.es_precio_especifico && (
                        <p className="text-xs font-semibold text-gray-500">
                          Calculado: arancel base −{a.porcentaje_descuento}%
                        </p>
                      )}
                      {futuros.map((f) => (
                        <p key={f.id} className="text-xs font-bold text-amber-700">
                          Programado: {formatearPesos(f.precio)} desde el {formatearFecha(f.vigente_desde)}
                        </p>
                      ))}
                    </div>
                    {gestionar && <CambiarPrecio prestacionId={p.id} arancelId={a.id} arancelNombre={a.nombre} />}
                  </div>

                  {historialArancel.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-xs font-bold text-gray-500">
                        Historial de precios ({historialArancel.length})
                      </summary>
                      <table className="mt-2 w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] font-bold uppercase text-gray-400">
                            <th className="py-1 pr-3">Precio</th>
                            <th className="py-1 pr-3">Vigencia</th>
                            <th className="py-1 pr-3">Motivo</th>
                            <th className="py-1">Registrado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {historialArancel.map((h) => (
                            <tr key={h.id}>
                              <td className="py-1.5 pr-3 font-bold text-gray-900">{formatearPesos(h.precio)}</td>
                              <td className="py-1.5 pr-3 font-medium text-gray-700 whitespace-nowrap">
                                {formatearFecha(h.vigente_desde)} → {h.vigente_hasta ? formatearFecha(h.vigente_hasta) : "indefinido"}
                              </td>
                              <td className="py-1.5 pr-3 font-medium text-gray-600">{h.motivo ?? "—"}</td>
                              <td className="py-1.5 text-xs font-medium text-gray-500 whitespace-nowrap">
                                {formatearFechaHora(h.created_at)}
                                {h.creado_por && autores.get(h.creado_por) && ` · ${autores.get(h.creado_por)}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              )
            })}
        </div>
        <p className="text-xs font-medium text-gray-400">
          Los precios no se editan ni se borran: cada cambio crea un nuevo precio con fecha de inicio y el anterior queda en el
          historial. Los pagos ya registrados conservan el precio que tenían al momento del cobro.
        </p>
      </section>
    </div>
  )
}

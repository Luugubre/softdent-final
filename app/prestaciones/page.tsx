import Link from "next/link"
import { getSupabase } from "@/lib/supabase"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerCatalogos } from "@/lib/prestaciones"
import { formatearPesos } from "@/lib/formato"
import { PrestacionForm } from "@/components/prestaciones/PrestacionForm"
import type { PrecioVigente, Prestacion } from "@/types/prestacion"
import { IconoMuestra } from "@/lib/iconos-dentales"
import { iconoPorNombre } from "@/lib/iconos-datos"
import { ComoFunciona, Encabezado, Termino } from "@/components/ui/Ayuda"

type Fila = Prestacion & {
  categoria: { nombre: string } | null
  especialidad: { nombre: string } | null
}

export default async function PrestacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; estado?: string }>
}) {
  const usuario = await requerirPermiso("prestaciones.ver")
  const gestionar = puede(usuario.rol, "prestaciones.gestionar")
  const { q = "", categoria = "", estado = "activas" } = await searchParams

  const { aranceles, categorias, especialidades } = await obtenerCatalogos()
  const arancelesActivos = aranceles.filter((a) => a.activo)
  const supabase = getSupabase()

  let consulta = supabase
    .from("prestaciones")
    .select("*, categoria:categorias_prestaciones(nombre), especialidad:especialidades(nombre)")
    .order("codigo_interno")
    .limit(500)

  const texto = q.trim().replace(/[,()%]/g, " ")
  if (texto) consulta = consulta.or(`nombre.ilike.%${texto}%,codigo_interno.ilike.%${texto}%,codigo_fonasa.ilike.%${texto}%`)
  if (categoria) consulta = consulta.eq("categoria_id", categoria)
  if (estado === "activas") consulta = consulta.eq("activo", true)
  if (estado === "inactivas") consulta = consulta.eq("activo", false)

  const { data, error } = await consulta
  const prestaciones = (data ?? []) as Fila[]

  const precios = new Map<string, PrecioVigente>()
  if (prestaciones.length > 0) {
    const { data: vigentes } = await supabase
      .from("v_precios_vigentes")
      .select("*")
      .in("prestacion_id", prestaciones.map((p) => p.id))
    for (const v of (vigentes ?? []) as PrecioVigente[]) precios.set(`${v.prestacion_id}:${v.arancel_id}`, v)
  }

  const selectClass =
    "px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="🦷"
        titulo="Prestaciones y precios"
        descripcion="Catálogo de procedimientos de la clínica con su código, duración y precio en cada arancel."
        migas={[{ etiqueta: "Prestaciones" }]}
        acciones={
          gestionar ? (
            <Link
              href="/prestaciones/configuracion"
              className="px-4 py-2 rounded-xl text-sm font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100"
            >
              ⚙ Aranceles y categorías
            </Link>
          ) : null
        }
      />
      <ComoFunciona
        pasos={[
          <>Busca una <Termino t="prestacion" /> por nombre o código y haz clic en ella para ver su detalle.</>,
          <>En el detalle puedes editar sus <strong>Datos</strong> (incluido el <Termino t="codigo_fonasa" />) y sus <strong>Precios por arancel</strong>.</>,
          <>Para crear una nueva, abre <strong>➕ Nueva prestación</strong> y escribe sus precios iniciales.</>,
          <>Los <Termino t="arancel">aranceles</Termino> (listas de precios) se crean en <strong>⚙ Aranceles y categorías</strong>.</>,
        ]}
        reglas={[
          <>Un cambio de precio <strong>no afecta</strong> los tratamientos ya creados: rige desde la fecha que indiques.</>,
          <>Una prestación no se borra: se desactiva.</>,
          <>Las columnas de la tabla muestran el precio de hoy en cada arancel.</>,
        ]}
      />

      {gestionar && (
        <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
            <span className="text-base font-extrabold text-gray-900">➕ Nueva prestación</span>
            <span className="text-xs font-bold text-blue-600 group-open:hidden">Abrir formulario ▾</span>
            <span className="hidden text-xs font-bold text-blue-600 group-open:inline">Cerrar ▴</span>
          </summary>
          <div className="border-t border-gray-100 p-2">
            <PrestacionForm
              aranceles={arancelesActivos}
              categorias={categorias.filter((c) => c.activo)}
              especialidades={especialidades.filter((e) => e.activo)}
            />
          </div>
        </details>
      )}

      <form method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o código..."
          className="w-full sm:w-72 px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select name="categoria" defaultValue={categoria} className={selectClass}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <select name="estado" defaultValue={estado} className={selectClass}>
          <option value="activas">Activas</option>
          <option value="inactivas">Inactivas</option>
          <option value="todas">Todas</option>
        </select>
        <button className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700">Filtrar</button>
        {(q || categoria || estado !== "activas") && (
          <Link href="/prestaciones" className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-200 hover:bg-gray-300">
            Limpiar
          </Link>
        )}
      </form>

      {error && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">
          Error al cargar prestaciones: {error.message}
        </p>
      )}

      <div className="w-full bg-white shadow-sm rounded-2xl overflow-x-auto border border-gray-200">
        <table className="w-full divide-y divide-gray-200 text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Código</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Prestación</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Categoría</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Duración</th>
              {arancelesActivos.map((a) => (
                <th key={a.id} className="px-4 py-3 text-xs font-bold text-gray-700 uppercase text-right whitespace-nowrap">
                  {a.nombre}
                  {a.porcentaje_descuento > 0 && <span className="text-gray-400"> (-{a.porcentaje_descuento}%)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {prestaciones.length === 0 ? (
              <tr>
                <td colSpan={4 + arancelesActivos.length} className="px-4 py-8 text-center text-sm font-semibold text-gray-500">
                  {q || categoria ? "No hay prestaciones que coincidan con el filtro." : "Aún no hay prestaciones registradas."}
                </td>
              </tr>
            ) : (
              prestaciones.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${p.activo ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-gray-900 whitespace-nowrap">
                    <Link href={`/prestaciones/${p.id}`} className="hover:text-blue-600">{p.codigo_interno}</Link>
                    {p.codigo_fonasa && <p className="text-[11px] font-semibold text-gray-400">FONASA {p.codigo_fonasa}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                    <IconoMuestra tipo={p.icono || iconoPorNombre(p.nombre)} color="#f59e0b" size={18} />
                    <Link href={`/prestaciones/${p.id}`} className="font-extrabold text-gray-900 hover:text-blue-600">
                      {p.nombre}
                    </Link>
                    </div>
                    {p.especialidad && <p className="text-xs font-medium text-gray-500">{p.especialidad.nombre}</p>}
                    {!p.activo && <p className="text-xs font-bold text-gray-500">Inactiva</p>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">{p.categoria?.nombre}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">{p.duracion_min} min</td>
                  {arancelesActivos.map((a) => {
                    const v = precios.get(`${p.id}:${a.id}`)
                    return (
                      <td key={a.id} className="px-4 py-3 text-sm text-right whitespace-nowrap">
                        {v?.precio ? (
                          <span className={v.es_precio_especifico ? "font-extrabold text-gray-900" : "font-semibold text-gray-500 italic"}>
                            {formatearPesos(v.precio)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs font-medium text-gray-400">
        Precios vigentes hoy. En cursiva: calculado automáticamente con el descuento del convenio sobre el arancel base.
      </p>
    </div>
  )
}

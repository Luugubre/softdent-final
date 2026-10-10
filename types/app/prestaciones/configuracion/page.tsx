import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { obtenerCatalogos } from "@/lib/prestaciones"
import { ArancelForm, BotonEstadoCatalogo, BotonEstadoArancel, NuevoItemCatalogo } from "@/components/prestaciones/Configuracion"
import { TIPO_ARANCEL_ETIQUETAS, type ItemCatalogo } from "@/types/prestacion"

function ListaCatalogo({
  titulo,
  catalogo,
  items,
}: {
  titulo: string
  catalogo: "categoria" | "especialidad"
  items: ItemCatalogo[]
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="text-xl font-extrabold text-gray-900">{titulo}</h2>
      <NuevoItemCatalogo catalogo={catalogo} />
      <ul className="divide-y divide-gray-100">
        {items.map((i) => (
          <li key={i.id} className={`py-2 flex items-center justify-between ${i.activo ? "" : "opacity-50"}`}>
            <span className="text-sm font-bold text-gray-900">{i.nombre}</span>
            <BotonEstadoCatalogo catalogo={catalogo} id={i.id} activo={i.activo} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function ConfiguracionPrestaciones() {
  await requerirPermiso("prestaciones.gestionar")
  const { aranceles, categorias, especialidades } = await obtenerCatalogos()

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Link href="/prestaciones" className="text-sm font-bold text-blue-600 hover:underline">
        ← Volver a prestaciones
      </Link>
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Aranceles y categorías</h1>

      {/* ARANCELES */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Aranceles</h2>
          <p className="text-sm font-medium text-gray-500">
            Cada arancel es una lista de precios. El <strong>arancel base</strong> es el particular de la clínica; los convenios
            pueden tener un descuento automático sobre él.
          </p>
        </div>

        <ArancelForm />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-bold uppercase text-gray-500">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Descuento automático</th>
                <th className="py-2 pr-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {aranceles.map((a) => (
                <tr key={a.id} className={a.activo ? "" : "opacity-50"}>
                  <td className="py-2.5 pr-4">
                    <p className="font-extrabold text-gray-900">
                      {a.nombre} {a.es_base && <span className="text-xs font-black text-blue-600">BASE</span>}
                    </p>
                    {a.descripcion && <p className="text-xs font-medium text-gray-500">{a.descripcion}</p>}
                  </td>
                  <td className="py-2.5 pr-4 font-semibold text-gray-700">{TIPO_ARANCEL_ETIQUETAS[a.tipo]}</td>
                  <td className="py-2.5 pr-4 font-semibold text-gray-700">
                    {a.porcentaje_descuento > 0 ? `${a.porcentaje_descuento}% sobre el base` : "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    {a.es_base ? (
                      <span className="text-xs font-bold text-emerald-700">Activo (base)</span>
                    ) : (
                      <BotonEstadoArancel id={a.id} activo={a.activo} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ListaCatalogo titulo="Categorías de prestaciones" catalogo="categoria" items={categorias} />
        <ListaCatalogo titulo="Especialidades" catalogo="especialidad" items={especialidades} />
      </div>
    </div>
  )
}

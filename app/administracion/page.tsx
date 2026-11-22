import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { obtenerCatalogo, obtenerMetodosPago } from "@/lib/catalogos"
import { GRUPOS_ADMIN, SECCIONES_ADMIN } from "@/lib/admin-secciones"
import { Encabezado } from "@/components/ui/Ayuda"
import { NavAdmin } from "@/components/admin/NavAdmin"

export default async function AdministracionPage() {
  await requerirPermiso("administracion.gestionar")

  const conteos = Object.fromEntries(
    await Promise.all(
      SECCIONES_ADMIN.map(async (s) => {
        if (s.tabla) {
          const items = await obtenerCatalogo(s.tabla)
          return [s.slug, `${items.filter((i) => i.activo).length} activos`] as const
        }
        if (s.slug === "metodos-pago") {
          const metodos = await obtenerMetodosPago(false)
          return [s.slug, `${metodos.filter((m) => m.activo).length} activos`] as const
        }
        return [s.slug, ""] as const
      })
    )
  )

  return (
    <div className="w-full min-h-screen p-6 md:p-10 space-y-6">
      <Encabezado
        icono="⚙️"
        titulo="Administración"
        descripcion="Configuración general de la clínica. Elige una sección: cada una tiene su propia página."
        migas={[{ etiqueta: "Administración" }]}
      >
        <NavAdmin />
      </Encabezado>

      {GRUPOS_ADMIN.map((grupo) => (
        <section key={grupo} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">{grupo}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {SECCIONES_ADMIN.filter((s) => s.grupo === grupo).map((s) => (
              <Link
                key={s.slug}
                href={`/administracion/${s.slug}`}
                className="group flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-xl">
                  {s.icono}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-gray-900 group-hover:text-blue-700">{s.titulo}</span>
                  <span className="block text-sm text-gray-500">{s.descripcion}</span>
                  {conteos[s.slug] && <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{conteos[s.slug]}</span>}
                </span>
              </Link>
            ))}
            {grupo === "Seguridad" && (
              <Link
                href="/administracion/auditoria"
                className="group flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-xl">🛡️</span>
                <span className="min-w-0">
                  <span className="block font-bold text-gray-900 group-hover:text-blue-700">Auditoría y accesos</span>
                  <span className="block text-sm text-gray-500">Bitácora de cambios clínicos, firmas y accesos a fichas.</span>
                </span>
              </Link>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

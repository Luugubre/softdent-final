import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { obtenerParametros } from "@/lib/catalogos"
import { contarCitasWebPorValidar, dentistasAgendaOnline } from "@/lib/agenda-web"
import { Encabezado } from "@/components/ui/Ayuda"
import { NavAdmin } from "@/components/admin/NavAdmin"
import { TablaParametros } from "@/components/admin/TablasAdmin"
import { DentistasAgendaOnline } from "@/components/admin/DentistasAgendaOnline"

export default async function AgendaOnlinePage() {
  await requerirPermiso("administracion.gestionar")
  const [parametros, dentistas, porValidar] = await Promise.all([obtenerParametros(), dentistasAgendaOnline(), contarCitasWebPorValidar()])
  const delGrupo = parametros.filter((p) => p.grupo === "Agenda online")
  const urlPublica = process.env.NEXT_PUBLIC_AGENDA_WEB_URL ?? ""
  const claveLista = (process.env.AGENDA_WEB_API_KEY ?? "").length >= 24

  return (
    <div className="w-full min-h-screen p-6 md:p-10 space-y-6">
      <Encabezado
        icono="🌐"
        titulo="Agenda online"
        descripcion="Página pública donde los pacientes reservan su hora. Es una app aparte que se conecta a SoftDent por la API."
        migas={[{ href: "/administracion", etiqueta: "Administración" }, { etiqueta: "Agenda online" }]}
      >
        <NavAdmin />
      </Encabezado>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Página de reservas</p>
          {urlPublica ? (
            <a href={urlPublica} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all font-semibold text-blue-700 hover:underline">
              {urlPublica.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <p className="mt-2 text-sm text-amber-700">Falta la variable NEXT_PUBLIC_AGENDA_WEB_URL en Vercel.</p>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Conexión con la API</p>
          <p className={`mt-2 flex items-center gap-2 font-semibold ${claveLista ? "text-emerald-700" : "text-rose-700"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${claveLista ? "bg-emerald-500" : "bg-rose-500"}`} aria-hidden />
            {claveLista ? "Clave configurada" : "Falta AGENDA_WEB_API_KEY"}
          </p>
          <p className="mt-1 text-xs text-gray-500">La misma clave debe estar en las dos apps (mínimo 24 caracteres).</p>
        </div>
        <Link href="/agenda/web" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Reservas por validar</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{porValidar}</p>
          <p className="text-xs font-semibold text-blue-700">Ver reservas web →</p>
        </Link>
      </section>

      {delGrupo.length > 0 ? (
        <TablaParametros parametros={delGrupo} />
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Falta ejecutar en Supabase el archivo supabase/25_agenda_online.sql.
        </p>
      )}
      <DentistasAgendaOnline dentistas={dentistas} />
    </div>
  )
}

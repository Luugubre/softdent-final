import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { Encabezado } from "@/components/ui/Ayuda"
import { hoyEnChile, sumarDias } from "@/lib/fechas-agenda"
import { listarInasistencias } from "@/lib/inasistencias"
import { ListaInasistencias } from "@/components/agenda/ListaInasistencias"

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function InasistenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; profesional?: string }>
}) {
  const usuario = await requerirPermiso("agenda.gestionar")
  const verTodos = puede(usuario.rol, "agenda.ver_todas")
  const sp = await searchParams
  const hoy = hoyEnChile()
  let hasta = sp.hasta && FECHA.test(sp.hasta) && sp.hasta <= hoy ? sp.hasta : hoy
  let desde = sp.desde && FECHA.test(sp.desde) ? sp.desde : sumarDias(hasta, -29)
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  if (desde < sumarDias(hasta, -365)) desde = sumarDias(hasta, -365)
  const profesional = verTodos ? (sp.profesional && UUID.test(sp.profesional) ? sp.profesional : "") : usuario.id

  const datos = await listarInasistencias(desde, hasta, profesional || undefined)

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="🚫"
        titulo="Inasistencias"
        descripcion="Pacientes que no asistieron a su cita: seguimiento, contacto y reagendamiento."
        migas={[{ href: "/agenda", etiqueta: "Agenda" }, { etiqueta: "Inasistencias" }]}
      />
      <ListaInasistencias
        key={`${desde}-${hasta}-${profesional}`}
        datos={datos}
        desde={desde}
        hasta={hasta}
        hoy={hoy}
        profesional={profesional}
        verTodos={verTodos}
      />
    </div>
  )
}

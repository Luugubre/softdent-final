import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import {
  obtenerBloqueos,
  obtenerBoxes,
  obtenerCitas,
  obtenerHorarios,
  obtenerProfesionalesAgenda,
} from "@/lib/agenda"
import { fechaValida, partesChile } from "@/lib/fechas-agenda"
import { VistaDiariaDoctor } from "@/components/agenda/VistaDiariaDoctor"

const UUID = /^[0-9a-f-]{36}$/i

export default async function AgendaDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; agrupar?: string; profesional?: string }>
}) {
  const usuario = await requerirPermiso("agenda.ver")
  const sp = await searchParams

  const ahora = partesChile(new Date().toISOString())
  const hoy = ahora.fecha
  const fecha = fechaValida(sp.fecha) ? sp.fecha : hoy
  const verTodas = puede(usuario.rol, "agenda.ver_todas")
  const agruparPor: "doctor" | "box" = verTodas && sp.agrupar === "box" ? "box" : "doctor"

  const profesionalFiltro = !verTodas
    ? usuario.id
    : sp.profesional && UUID.test(sp.profesional)
      ? sp.profesional
      : undefined

  const [citas, bloqueos, horarios, profesionales, boxes] = await Promise.all([
    obtenerCitas(fecha, fecha, { profesional: profesionalFiltro }),
    obtenerBloqueos(fecha, fecha),
    obtenerHorarios(),
    obtenerProfesionalesAgenda(),
    obtenerBoxes(),
  ])

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4 md:p-6">
      <VistaDiariaDoctor
        fecha={fecha}
        hoy={hoy}
        ahoraMinInicial={ahora.minutos}
        citas={citas}
        bloqueos={bloqueos}
        horarios={horarios}
        profesionales={profesionales}
        boxes={boxes}
        agruparPor={agruparPor}
        profesionalFiltro={profesionalFiltro}
        usuarioId={usuario.id}
        permisos={{
          verTodas,
          gestionar: puede(usuario.rol, "agenda.gestionar"),
          clinico: puede(usuario.rol, "clinico.ver"),
        }}
      />
    </div>
  )
}
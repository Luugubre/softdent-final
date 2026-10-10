import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import {
  obtenerBloqueos,
  obtenerBoxes,
  obtenerCitas,
  obtenerHorarios,
  obtenerProfesionalesAgenda,
} from "@/lib/agenda"
import { fechaValida, lunesDeLaSemana, partesChile, primeroDelMes, sumarDias, sumarMeses } from "@/lib/fechas-agenda"
import { AgendaVista, type Vista } from "@/components/agenda/AgendaVista"
import { ESTADOS_CITA, type EstadoCita } from "@/types/cita"

const UUID = /^[0-9a-f-]{36}$/i

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string; profesional?: string; box?: string; estado?: string }>
}) {
  const usuario = await requerirPermiso("agenda.ver")
  const sp = await searchParams

  const ahora = partesChile(new Date().toISOString())
  const hoy = ahora.fecha
  const vista: Vista = sp.vista === "semana" || sp.vista === "mes" ? sp.vista : "dia"
  const fecha = fechaValida(sp.fecha) ? sp.fecha : hoy
  const filtros = {
    // El dentista solo ve su propia agenda
    profesional: !puede(usuario.rol, "agenda.ver_todas") ? usuario.id : sp.profesional && UUID.test(sp.profesional) ? sp.profesional : undefined,
    box: sp.box && UUID.test(sp.box) ? sp.box : undefined,
    estado: ESTADOS_CITA.includes(sp.estado as EstadoCita) ? (sp.estado as EstadoCita) : undefined,
  }

  // Días que se muestran
  let dias: string[]
  if (vista === "dia") dias = [fecha]
  else if (vista === "semana") {
    const lunes = lunesDeLaSemana(fecha)
    dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  } else {
    const desde = lunesDeLaSemana(primeroDelMes(fecha))
    const ultimo = sumarDias(sumarMeses(fecha, 1), -1)
    dias = []
    for (let d = desde; d <= ultimo || dias.length % 7 !== 0; d = sumarDias(d, 1)) dias.push(d)
  }
  const desde = dias[0]
  const hasta = dias[dias.length - 1]

  const gestionar = puede(usuario.rol, "agenda.gestionar")

  const [citas, bloqueos, horarios, profesionales, boxes] = await Promise.all([
    obtenerCitas(desde, hasta, filtros),
    obtenerBloqueos(desde, hasta),
    obtenerHorarios(),
    obtenerProfesionalesAgenda(),
    obtenerBoxes(),
  ])

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4 md:p-6">
      <AgendaVista
        // Al cambiar de vista o fecha se reinicia el estado (modales abiertos, avisos)
        key={`${vista}-${fecha}`}
        vista={vista}
        fecha={fecha}
        hoy={hoy}
        ahoraMin={ahora.minutos}
        dias={dias}
        citas={citas}
        bloqueos={bloqueos}
        horarios={horarios}
        profesionales={profesionales}
        boxes={boxes}
        filtros={filtros}
        permisos={{
          gestionar,
          sobrecupo: puede(usuario.rol, "agenda.sobrecupo"),
          configurar: puede(usuario.rol, "agenda.configurar"),
          clinico: puede(usuario.rol, "clinico.ver"),
          verTodos: puede(usuario.rol, "agenda.ver_todas"),
        }}
        usuarioId={usuario.id}
      />
    </div>
  )
}

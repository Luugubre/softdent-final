import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"
import { obtenerBoxes, obtenerCitas, obtenerInfoPacientes, obtenerProfesionalesAgenda } from "@/lib/agenda"
import { fechaValida, hoyEnChile, lunesDeLaSemana, sumarDias } from "@/lib/fechas-agenda"
import { AgendaClinica } from "@/components/agenda/AgendaClinica"
import { obtenerTiposAtencion } from "@/lib/catalogos"
import type { PacienteBusqueda } from "@/types/cita"

const UUID = /^[0-9a-f-]{36}$/i

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string; profesional?: string; agendar?: string }>
}) {
  const usuario = await requerirPermiso("agenda.ver")
  const sp = await searchParams

  const hoy = hoyEnChile()
  const vista = sp.vista === "semana" ? "semana" : "dia"
  const fecha = fechaValida(sp.fecha) ? sp.fecha : hoy
  const verTodos = puede(usuario.rol, "agenda.ver_todas")
  const gestionar = puede(usuario.rol, "agenda.gestionar")
  const finanzas = puede(usuario.rol, "pagos.ver")

  const profesional = verTodos ? (sp.profesional && UUID.test(sp.profesional) ? sp.profesional : undefined) : usuario.id

  const lunes = lunesDeLaSemana(fecha)
  const desde = vista === "dia" ? fecha : lunes
  const hasta = vista === "dia" ? fecha : sumarDias(lunes, 6)

  const [citas, profesionales, boxes, pacienteInicial, tiposAtencion] = await Promise.all([
    obtenerCitas(desde, hasta, { profesional }),
    obtenerProfesionalesAgenda(),
    obtenerBoxes(),
    gestionar && sp.agendar && UUID.test(sp.agendar)
      ? getSupabase()
          .from("pacientes")
          .select("id, nombres, apellidos, rut, telefono")
          .eq("id", sp.agendar)
          .eq("activo", true)
          .maybeSingle()
          .then((r) => (r.data as PacienteBusqueda | null) ?? null)
      : Promise.resolve(null),
    obtenerTiposAtencion(),
  ])

  const vigentes = citas.filter((c) => c.estado !== "CANCELADA" && c.estado !== "REAGENDADA")
  const info = await obtenerInfoPacientes(
    vigentes.map((c) => c.paciente_id),
    finanzas
  )

  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const dias = vista === "dia" ? [fecha] : citas.some((c) => c.fecha === semana[6]) ? semana : semana.slice(0, 6)

  return (
    <AgendaClinica
      key={`${vista}-${fecha}-${profesional ?? ""}`}
      vista={vista}
      fecha={fecha}
      hoy={hoy}
      dias={dias}
      citas={citas}
      info={info}
      profesionales={profesionales}
      boxes={boxes}
      tiposAtencion={tiposAtencion}
      profesional={profesional}
      usuarioId={usuario.id}
      permisos={{
        gestionar,
        sobrecupo: puede(usuario.rol, "agenda.sobrecupo"),
        configurar: puede(usuario.rol, "agenda.configurar"),
        clinico: puede(usuario.rol, "clinico.ver"),
        finanzas,
        verTodos,
      }}
      pacienteInicial={pacienteInicial}
    />
  )
}

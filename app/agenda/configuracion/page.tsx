import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { obtenerBloqueosFuturos, obtenerBoxes, obtenerHorarios, obtenerProfesionalesAgenda } from "@/lib/agenda"
import { ConfigBoxes, ConfigHorarios, ListaBloqueos } from "@/components/agenda/ConfigAgenda"
import { ComoFunciona, Encabezado, Termino } from "@/components/ui/Ayuda"

export default async function ConfiguracionAgendaPage() {
  await requerirPermiso("agenda.configurar")

  const [profesionales, horarios, boxes, bloqueos] = await Promise.all([
    obtenerProfesionalesAgenda(),
    obtenerHorarios(),
    obtenerBoxes(false),
    obtenerBloqueosFuturos(),
  ])

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="🕘"
        titulo="Horarios y boxes"
        descripcion="Cuándo atiende cada dentista, en qué salas, y los bloqueos (vacaciones, reuniones) que ya están cargados."
        migas={[{ href: "/agenda", etiqueta: "Agenda" }, { etiqueta: "Horarios y boxes" }]}
        acciones={
          <Link href="/agenda" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100">
            ← Volver a la agenda
          </Link>
        }
      />
      <ComoFunciona
        pasos={[
          <>Elige un dentista, marca los días y el tramo de horas y presiona <strong>Agregar</strong>.</>,
          <>Para jornada partida (mañana y tarde) agrega <strong>dos tramos</strong> el mismo día.</>,
          <>Crea los <Termino t="box">boxes</Termino> (salas o sillones) donde se atiende.</>,
          <>Las vacaciones o días libres se cargan desde la Agenda con el botón <strong>🔒 Bloquear</strong>.</>,
        ]}
        reglas={[
          <>Fuera del <Termino t="horario">horario</Termino> solo se puede agendar como <Termino t="sobrecupo" />.</>,
          <>Dos citas no pueden usar el mismo box a la misma hora.</>,
          <>Un box que ya se usó no se borra: se desactiva.</>,
          <>Los dentistas se crean en <strong>Usuarios y roles</strong> con el rol Dentista.</>,
        ]}
      />

      {profesionales.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm font-semibold text-gray-500">
          No hay dentistas activos. Créalos en Usuarios con el rol Dentista.
        </p>
      ) : (
        <ConfigHorarios profesionales={profesionales} horarios={horarios} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigBoxes boxes={boxes} />
        <ListaBloqueos bloqueos={bloqueos} puedeEliminar />
      </div>
    </div>
  )
}

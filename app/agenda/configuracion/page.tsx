import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { obtenerBloqueosFuturos, obtenerBoxes, obtenerHorarios, obtenerProfesionalesAgenda } from "@/lib/agenda"
import { ConfigBoxes, ConfigHorarios, ListaBloqueos } from "@/components/agenda/ConfigAgenda"

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
      <Link href="/agenda" className="text-sm font-bold text-blue-600 hover:underline">
        ← Volver a la agenda
      </Link>
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configuración de la agenda</h1>

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

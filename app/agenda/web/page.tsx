import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { listarCitasWeb } from "@/lib/agenda-web"
import { obtenerParametro } from "@/lib/catalogos"
import { ComoFunciona, Encabezado } from "@/components/ui/Ayuda"
import { ListaCitasWeb } from "@/components/agenda/ListaCitasWeb"

export default async function CitasWebPage() {
  const usuario = await requerirPermiso("agenda.gestionar")
  const soloPropias = !puede(usuario.rol, "agenda.ver_todas")
  const [citas, clinica] = await Promise.all([
    listarCitasWeb(soloPropias ? usuario.id : undefined),
    obtenerParametro("clinica.nombre", "la clínica"),
  ])

  return (
    <div className="w-full min-h-screen p-6 md:p-10 space-y-6">
      <Encabezado
        icono="🌐"
        titulo="Reservas web"
        descripcion="Horas que los pacientes reservaron por internet. Valídalas para confirmarlas en la agenda."
        migas={[{ href: "/agenda", etiqueta: "Agenda" }, { etiqueta: "Reservas web" }]}
      />
      <ComoFunciona
        pasos={[
          <>La reserva entra a la agenda al instante, así nadie más puede tomar esa hora.</>,
          <>Revisa los datos y, si quieres, escribe al paciente por <strong>WhatsApp</strong>.</>,
          <>Presiona <strong>Validar</strong>: la cita queda confirmada. Si no corresponde, usa <strong>Anular</strong> con el motivo.</>,
        ]}
        reglas={[
          <>Un mismo paciente puede tener un número limitado de reservas web pendientes (se configura en Administración › Agenda online).</>,
          <>Los pacientes nuevos se registran con sus datos básicos; complétalos en su ficha cuando llegue.</>,
        ]}
      />
      <ListaCitasWeb citas={citas} clinica={clinica} />
    </div>
  )
}

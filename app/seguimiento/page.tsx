import Link from "next/link"
import { requerirUsuario } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"
import { Encabezado } from "@/components/ui/Ayuda"
import { hoyEnChile, sumarDias } from "@/lib/fechas-agenda"
import { contarCitasWebPorValidar } from "@/lib/agenda-web"

async function contar(consulta: PromiseLike<{ count: number | null }>) {
  const { count } = await consulta
  return count ?? 0
}

export default async function SeguimientoPage() {
  const usuario = await requerirUsuario()
  const p = (permiso: Parameters<typeof puede>[1]) => puede(usuario.rol, permiso)
  const soloPropios = usuario.rol === "DENTISTA"
  const db = getSupabase()
  const hace30 = `${sumarDias(hoyEnChile(), -30)}T00:00:00-03:00`

  let inasistencias = db.from("citas").select("id", { count: "exact", head: true }).eq("estado", "NO_ASISTIO").gte("inicio", hace30)
  let presupuestos = db.from("presupuestos").select("id", { count: "exact", head: true }).eq("estado", "ACTIVO").eq("aprobacion", "PENDIENTE")
  let consentimientos = db.from("consentimientos_paciente").select("id", { count: "exact", head: true }).eq("estado", "PENDIENTE_FIRMA")
  if (soloPropios) {
    inasistencias = inasistencias.eq("profesional_id", usuario.id)
    presupuestos = presupuestos.eq("profesional_id", usuario.id)
    consentimientos = consentimientos.eq("doctor_id", usuario.id)
  }

  const [nInasistencias, nPresupuestos, nConsentimientos, nWeb] = await Promise.all([
    contar(inasistencias),
    contar(presupuestos),
    contar(consentimientos),
    contarCitasWebPorValidar(soloPropios ? usuario.id : undefined),
  ])

  const tarjetas = [
    {
      href: "/agenda/web",
      icono: "🌐",
      titulo: "Reservas web",
      detalle: "Horas reservadas por internet que falta validar.",
      cifra: `${nWeb} por validar`,
      visible: p("agenda.gestionar"),
    },
    {
      href: "/agenda/inasistencias",
      icono: "🚫",
      titulo: "Inasistencias",
      detalle: "Pacientes que faltaron: llamar y reagendar.",
      cifra: `${nInasistencias} en los últimos 30 días`,
      visible: p("agenda.gestionar"),
    },
    {
      href: "/presupuestos-pendientes",
      icono: "📋",
      titulo: "Presupuestos sin aprobar",
      detalle: "Planes entregados que el paciente aún no acepta.",
      cifra: `${nPresupuestos} pendientes`,
      visible: p("presupuestos.gestionar") || p("agenda.gestionar"),
    },
    {
      href: "/pagos-pendientes",
      icono: "💳",
      titulo: "Pagos pendientes",
      detalle: "Saldos por cobrar y recordatorio por WhatsApp.",
      cifra: "Ver saldos",
      visible: p("pagos.registrar") || p("caja.gestionar") || usuario.rol === "DENTISTA",
    },
    {
      href: "/citas-consentimiento",
      icono: "✍️",
      titulo: "Consentimientos por firmar",
      detalle: "Enlaces enviados que el paciente aún no firma.",
      cifra: `${nConsentimientos} pendientes`,
      visible: p("consentimientos.gestionar"),
    },
  ].filter((t) => t.visible)

  return (
    <div className="space-y-6">
      <Encabezado
        icono="🔎"
        titulo="Seguimiento de pacientes"
        descripcion={soloPropios ? "Tus pacientes que necesitan un contacto o una acción." : "Pacientes que necesitan un contacto o una acción de la clínica."}
        migas={[{ etiqueta: "Seguimiento" }]}
      />
      {tarjetas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm font-semibold text-gray-500">
          Tu rol no tiene listas de seguimiento.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {tarjetas.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow">
              <p className="text-3xl">{t.icono}</p>
              <h2 className="mt-2 text-lg font-extrabold text-gray-900">{t.titulo}</h2>
              <p className="text-sm text-gray-500">{t.detalle}</p>
              <p className="mt-3 text-sm font-black text-blue-700">{t.cifra} →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

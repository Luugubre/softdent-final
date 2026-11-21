import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { Encabezado } from "@/components/ui/Ayuda"
import { VistaAuditoriaCliente } from "@/components/auditoria/VistaAuditoriaCliente"
import { listarAccesos, listarEventos } from "@/lib/auditoria"
import { hoyEnChile, sumarDias } from "@/lib/fechas-agenda"

const FECHA = /^\d{4}-\d{2}-\d{2}$/

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  await requerirPermiso("auditoria.ver")
  const sp = await searchParams
  const hoy = hoyEnChile()
  let hasta = sp.hasta && FECHA.test(sp.hasta) && sp.hasta <= hoy ? sp.hasta : hoy
  let desde = sp.desde && FECHA.test(sp.desde) ? sp.desde : sumarDias(hasta, -6)
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  if (desde < sumarDias(hasta, -365)) desde = sumarDias(hasta, -365)

  const [{ eventos, truncado: t1 }, { accesos, truncado: t2 }] = await Promise.all([
    listarEventos(desde, hasta),
    listarAccesos(desde, hasta),
  ])

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="🛡️"
        titulo="Auditoría y registro de accesos"
        descripcion="Trazabilidad de modificaciones clínicas, movimientos financieros y visualización de fichas de pacientes."
        migas={[
          { href: "/administracion", etiqueta: "Administración" },
          { etiqueta: "Auditoría y accesos" },
        ]}
        acciones={
          <Link
            href="/administracion"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
          >
            ← Volver a administración
          </Link>
        }
      />

      <VistaAuditoriaCliente
        key={`${desde}-${hasta}`}
        eventos={eventos}
        accesos={accesos}
        desde={desde}
        hasta={hasta}
        hoy={hoy}
        truncado={t1 || t2}
      />
    </div>
  )
}
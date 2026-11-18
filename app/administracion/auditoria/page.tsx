import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { Encabezado } from "@/components/ui/Ayuda"
import { VistaAuditoriaCliente } from "@/components/auditoria/VistaAuditoriaCliente"

export default async function AuditoriaPage() {
  await requerirPermiso("administracion.gestionar")

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

      <VistaAuditoriaCliente />
    </div>
  )
}
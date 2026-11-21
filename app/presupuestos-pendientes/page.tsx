import { requerirUsuario } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { redirect } from "next/navigation"
import { obtenerPresupuestosSinAprobar } from "@/lib/presupuestos"
import { BandejaPresupuestos } from "@/components/presupuestos/BandejaPresupuestos"
import { Encabezado } from "@/components/ui/Ayuda"

export default async function PresupuestosPendientesPage() {
  const usuario = await requerirUsuario()

  const tieneAcceso =
    puede(usuario.rol, "presupuestos.gestionar") || puede(usuario.rol, "agenda.gestionar")
  if (!tieneAcceso) redirect("/sin-permiso")

  // Si es dentista, ve solo sus presupuestos; admin/recepción ven todos
  const esDentistaSoloPropio = usuario.rol === "DENTISTA"
  const { presupuestos, doctores } = await obtenerPresupuestosSinAprobar(
    esDentistaSoloPropio ? usuario.id : undefined
  )

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="📋"
        titulo="Presupuestos sin aprobar"
        descripcion="Seguimiento comercial de planes de tratamiento activos pendientes de aprobación."
        migas={[{ etiqueta: "Presupuestos sin aprobar" }]}
      />

      <BandejaPresupuestos
        presupuestos={presupuestos}
        doctores={doctores}
        esDentistaSoloPropio={esDentistaSoloPropio}
      />
    </div>
  )
}
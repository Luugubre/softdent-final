import { redirect } from "next/navigation"
import { requerirUsuario } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerSaldosPacientes } from "@/lib/pagos-pendientes"
import { TablaPagosPendientes } from "@/components/finanzas/TablaPagosPendientes"
import { Encabezado } from "@/components/ui/Ayuda"

export default async function PagosPendientesPage() {
  const usuario = await requerirUsuario()

  const tieneAcceso =
    puede(usuario.rol, "pagos.registrar") ||
    puede(usuario.rol, "caja.gestionar") ||
    usuario.rol === "DENTISTA"

  if (!tieneAcceso) redirect("/sin-permiso")

  const soloMiCartera = usuario.rol === "DENTISTA"
  const { saldos, doctores } = await obtenerSaldosPacientes(
    soloMiCartera ? usuario.id : undefined
  )

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="💳"
        titulo="Pagos pendientes"
        descripcion="Pacientes con prestaciones habilitadas pendientes de abono y seguimiento de cobranza."
        migas={[{ etiqueta: "Pagos pendientes" }]}
      />

      <TablaPagosPendientes
        saldos={saldos}
        doctores={doctores}
        soloMiCartera={soloMiCartera}
      />
    </div>
  )
}
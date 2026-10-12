import { obtenerUsuarioActual } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerLiquidacion } from "@/lib/liquidaciones"
import { obtenerParametro } from "@/lib/catalogos"
import { libroLiquidacion } from "@/lib/liquidaciones-excel"
import { respuestaExcel } from "@/lib/excel"

export async function GET(_request: Request, { params }: { params: Promise<{ liquidacionId: string }> }) {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return new Response("Debes iniciar sesión.", { status: 401 })
  if (!puede(usuario.rol, "liquidaciones.ver")) return new Response("No tienes permiso para ver liquidaciones.", { status: 403 })

  const { liquidacionId } = await params
  const datos = await obtenerLiquidacion(liquidacionId)
  if (!datos) return new Response("Liquidación no encontrada.", { status: 404 })

  const { liquidacion, detalle } = datos
  if (!puede(usuario.rol, "liquidaciones.gestionar") && liquidacion.profesional_id !== usuario.id) {
    return new Response("No tienes permiso para ver esta liquidación.", { status: 403 })
  }

  const clinica = await obtenerParametro("clinica.nombre", "Clínica SoftDent")
  const libro = libroLiquidacion(liquidacion, detalle, clinica)
  const nombre = liquidacion.profesional?.nombre_completo ?? "profesional"
  return respuestaExcel(libro, `liquidacion-${String(liquidacion.numero).padStart(6, "0")}-${nombre}.xlsx`)
}

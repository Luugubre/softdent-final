import { obtenerUsuarioActual } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerLiquidaciones, obtenerProduccionPendiente, obtenerProfesional } from "@/lib/liquidaciones"
import { obtenerParametro } from "@/lib/catalogos"
import { libroLiquidaciones } from "@/lib/liquidaciones-excel"
import { respuestaExcel } from "@/lib/excel"
import { formatearFechaHora, hoyChile } from "@/lib/formato"

const UUID = /^[0-9a-f-]{36}$/i

export async function GET(request: Request) {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return new Response("Debes iniciar sesión.", { status: 401 })
  if (!puede(usuario.rol, "liquidaciones.ver")) return new Response("No tienes permiso para ver liquidaciones.", { status: 403 })

  const gestionar = puede(usuario.rol, "liquidaciones.gestionar")
  const pedido = new URL(request.url).searchParams.get("profesional")
  const profesionalId = gestionar ? (pedido && UUID.test(pedido) ? pedido : undefined) : usuario.id

  const [liquidaciones, produccion, clinica, profesional] = await Promise.all([
    obtenerLiquidaciones(profesionalId),
    obtenerProduccionPendiente(profesionalId),
    obtenerParametro("clinica.nombre", "SoftDent"),
    profesionalId ? obtenerProfesional(profesionalId) : Promise.resolve(null),
  ])

  const ahora = formatearFechaHora(new Date().toISOString())
  const subtitulo = profesional
    ? `Profesional: ${profesional.nombre_completo} · Descargado el ${ahora} por ${usuario.nombre_completo}`
    : `Todos los profesionales · Descargado el ${ahora} por ${usuario.nombre_completo}`

  const libro = libroLiquidaciones(liquidaciones, produccion, clinica, subtitulo)
  const archivo = profesional ? `liquidaciones-${profesional.nombre_completo}-${hoyChile()}.xlsx` : `liquidaciones-${hoyChile()}.xlsx`
  return respuestaExcel(libro, archivo)
}

import { timingSafeEqual } from "node:crypto"
import { getSupabase } from "@/lib/supabase"
import { normalizarRut, validarRut } from "@/lib/validaciones"

// API usada por la app de agendamiento online. Solo responde a quien presenta la clave compartida
// (variable AGENDA_WEB_API_KEY), que vive en el servidor de ambas apps y nunca llega al navegador.

const SIN_CACHE = { "Cache-Control": "no-store" }

export function respuesta(datos: unknown, status = 200) {
  return Response.json(datos, { status, headers: SIN_CACHE })
}

export function error(mensaje: string, status = 400) {
  return respuesta({ error: mensaje }, status)
}

export function claveValida(request: Request): boolean {
  const esperada = process.env.AGENDA_WEB_API_KEY ?? ""
  const recibida = request.headers.get("x-api-key") ?? ""
  if (esperada.length < 24 || recibida.length !== esperada.length) return false
  return timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada))
}

export function rechazar() {
  return error("No autorizado.", 401)
}

// Los mensajes de RAISE EXCEPTION (código P0001) están escritos para el paciente; el resto se oculta.
export async function llamar<T>(funcion: string, argumentos: Record<string, unknown> = {}): Promise<{ datos?: T; error?: Response }> {
  const { data, error: e } = await getSupabase().rpc(funcion, argumentos)
  if (e) {
    if (e.code === "P0001" && e.message) return { error: error(e.message, 409) }
    console.error(`API pública: ${funcion} falló:`, e.message)
    return { error: error("No pudimos completar la solicitud. Inténtalo nuevamente.", 500) }
  }
  return { datos: data as T }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const FECHA = /^\d{4}-\d{2}-\d{2}$/

// RUT chileno validado y con formato 12345678-9; otros documentos solo en mayúsculas y sin puntos
export function documentoNormalizado(rut: string, extranjero: boolean): string | null {
  if (extranjero) return /^[A-Za-z0-9.-]{5,20}$/.test(rut) ? rut.toUpperCase().replace(/[.\s]/g, "") : null
  return validarRut(rut) ? normalizarRut(rut) : null
}

import { FECHA, UUID, claveValida, error, llamar, rechazar, respuesta } from "@/lib/api-publica"

export async function GET(request: Request) {
  if (!claveValida(request)) return rechazar()
  const params = new URL(request.url).searchParams
  const profesional = params.get("profesional") ?? ""
  const desde = params.get("desde") ?? ""
  const dias = Number(params.get("dias") ?? 7)
  if (!UUID.test(profesional)) return error("Profesional no válido.")
  if (!FECHA.test(desde)) return error("Fecha no válida.")
  if (!Number.isInteger(dias) || dias < 1 || dias > 14) return error("Rango de días no válido.")

  const r = await llamar("agenda_web_disponibilidad", { p_profesional: profesional, p_desde: desde, p_dias: dias })
  return r.error ?? respuesta(r.datos)
}

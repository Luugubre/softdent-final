import { claveValida, llamar, rechazar, respuesta } from "@/lib/api-publica"

export async function GET(request: Request) {
  if (!claveValida(request)) return rechazar()
  const r = await llamar("agenda_web_profesionales")
  return r.error ?? respuesta(r.datos)
}

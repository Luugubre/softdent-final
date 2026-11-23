import { z } from "zod"
import { claveValida, documentoNormalizado, error, llamar, rechazar, respuesta } from "@/lib/api-publica"

const esquema = z.object({
  rut: z.string().trim().min(3).max(20),
  extranjero: z.boolean().default(false),
})

export async function POST(request: Request) {
  if (!claveValida(request)) return rechazar()
  const datos = esquema.safeParse(await request.json().catch(() => null))
  if (!datos.success) return error("Datos no válidos.")
  const documento = documentoNormalizado(datos.data.rut, datos.data.extranjero)
  if (!documento) return error(datos.data.extranjero ? "Documento no válido." : "El RUT no es válido. Revisa el dígito verificador.")

  const r = await llamar<{ existe: boolean; nombre?: string; activo?: boolean }>("agenda_web_paciente", { p_rut: documento })
  if (r.error) return r.error
  return respuesta({ existe: r.datos?.existe ?? false, nombre: r.datos?.activo ? r.datos?.nombre : undefined, documento })
}

import { z } from "zod"
import { FECHA, UUID, claveValida, documentoNormalizado, error, llamar, rechazar, respuesta } from "@/lib/api-publica"
import { correoValido } from "@/lib/texto"

const opcional = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined))

const esquema = z.object({
  rut: z.string().trim().min(3).max(20),
  extranjero: z.boolean().default(false),
  profesional: z.string().regex(UUID, "Profesional no válido."),
  fecha: z.string().regex(FECHA, "Fecha no válida."),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida."),
  nombres: opcional(80),
  apellidos: opcional(80),
  fechaNacimiento: z.string().regex(FECHA, "Fecha de nacimiento no válida.").optional(),
  telefono: opcional(20),
  email: opcional(120).refine((v) => !v || correoValido(v), "Correo no válido."),
  comentario: opcional(150),
})

export async function POST(request: Request) {
  if (!claveValida(request)) return rechazar()
  const datos = esquema.safeParse(await request.json().catch(() => null))
  if (!datos.success) return error(datos.error.issues[0]?.message ?? "Datos no válidos.")
  const d = datos.data
  const documento = documentoNormalizado(d.rut, d.extranjero)
  if (!documento) return error(d.extranjero ? "Documento no válido." : "El RUT no es válido. Revisa el dígito verificador.")

  const r = await llamar("agenda_web_agendar", {
    p_rut: documento,
    p_extranjero: d.extranjero,
    p_nombres: d.nombres ?? null,
    p_apellidos: d.apellidos ?? null,
    p_fecha_nacimiento: d.fechaNacimiento ?? null,
    p_telefono: d.telefono ?? null,
    p_email: d.email ?? null,
    p_profesional: d.profesional,
    p_fecha: d.fecha,
    p_hora: d.hora,
    p_comentario: d.comentario ?? null,
  })
  return r.error ?? respuesta(r.datos, 201)
}

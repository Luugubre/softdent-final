import { z } from "zod"

export function limpiarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase()
}

export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut)
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false

  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)

  let suma = 0
  let multiplo = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo
    multiplo = multiplo === 7 ? 2 : multiplo + 1
  }
  const resto = 11 - (suma % 11)
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto)
  return dv === esperado
}

export function normalizarRut(rut: string): string {
  const limpio = limpiarRut(rut)
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`
}

export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return rut
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${cuerpo}-${limpio.slice(-1)}`
}

export function calcularEdad(fecha: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!m) return null
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const hoy = new Date()
  let edad = hoy.getFullYear() - anio
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad--
  return edad
}

function telefonoValido(tel: string): boolean {
  const digitos = tel.replace(/\D/g, "")
  return digitos.length >= 8 && digitos.length <= 12
}

export const SEXOS = ["FEMENINO", "MASCULINO", "INTERSEXUAL", "NO_INFORMA"] as const

export const SEXO_ETIQUETAS: Record<(typeof SEXOS)[number], string> = {
  FEMENINO: "Femenino",
  MASCULINO: "Masculino",
  INTERSEXUAL: "Intersexual",
  NO_INFORMA: "Prefiere no informar",
}

export const PREVISIONES = [
  "Particular",
  "FONASA A",
  "FONASA B",
  "FONASA C",
  "FONASA D",
  "Isapre Banmédica",
  "Isapre Colmena",
  "Isapre Consalud",
  "Isapre Cruz Blanca",
  "Isapre Esencial",
  "Isapre Nueva Masvida",
  "Isapre Vida Tres",
  "Capredena",
  "Dipreca",
  "Otra",
] as const

export const REFERENCIAS = [
  "Instagram",
  "Facebook",
  "Google",
  "Recomendación de paciente",
  "Convenio",
  "Pasaba por fuera",
  "Otro",
] as const

const textoOpcional = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).optional()

const telefonoOpcional = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || telefonoValido(v), "Teléfono inválido (ej: +56 9 1234 5678)")

export const pacienteSchema = z
  .object({
    extranjero: z.boolean(),
    rut: z.string().trim().min(1, "Ingresa el RUT o documento"),
    nombres: z.string().trim().min(2, "Ingresa los nombres").max(80),
    apellidos: z.string().trim().min(2, "Ingresa los apellidos").max(80),
    nombre_social: textoOpcional(80),
    fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresa la fecha de nacimiento"),
    sexo: z.enum(SEXOS).optional(),
    genero: textoOpcional(50),

    telefono: telefonoOpcional,
    telefono_fijo: telefonoOpcional,
    email: z.string().trim().toLowerCase().email("Correo inválido").optional(),
    direccion: textoOpcional(150),
    comuna: textoOpcional(80),
    ciudad: textoOpcional(80),

    prevision: z.string().trim().min(1, "Selecciona la previsión"),
    actividad_profesion: textoOpcional(100),
    empleador: textoOpcional(100),
    referencia: textoOpcional(100),
    observaciones: textoOpcional(1000),

    apoderado_nombre: textoOpcional(120),
    apoderado_rut: z.string().trim().optional(),
    apoderado_telefono: telefonoOpcional,
  })
  .superRefine((d, ctx) => {
    if (!d.extranjero && !validarRut(d.rut)) {
      ctx.addIssue({ code: "custom", path: ["rut"], message: "RUT inválido. Revisa el dígito verificador." })
    }

    const edad = calcularEdad(d.fecha_nacimiento)
    if (edad === null) return
    if (edad < 0) {
      ctx.addIssue({ code: "custom", path: ["fecha_nacimiento"], message: "La fecha no puede ser futura" })
      return
    }
    if (edad > 120) {
      ctx.addIssue({ code: "custom", path: ["fecha_nacimiento"], message: "Revisa la fecha de nacimiento" })
      return
    }

    if (edad < 18) {
      if (!d.apoderado_nombre) {
        ctx.addIssue({ code: "custom", path: ["apoderado_nombre"], message: "Obligatorio para menores de 18 años" })
      }
      if (!d.apoderado_rut) {
        ctx.addIssue({ code: "custom", path: ["apoderado_rut"], message: "Obligatorio para menores de 18 años" })
      } else if (!validarRut(d.apoderado_rut)) {
        ctx.addIssue({ code: "custom", path: ["apoderado_rut"], message: "RUT del apoderado inválido" })
      }
    }
  })

export type PacienteFormData = z.infer<typeof pacienteSchema>

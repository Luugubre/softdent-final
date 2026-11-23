import type { TablaCatalogo } from "@/types/admin"

export type SeccionAdmin = {
  slug: string
  titulo: string
  icono: string
  descripcion: string
  grupo: "Clínica" | "Agenda y atención" | "Prestaciones" | "Finanzas" | "Seguridad"
  tabla?: TablaCatalogo
}

export const SECCIONES_ADMIN: SeccionAdmin[] = [
  { slug: "parametros", titulo: "Datos de la clínica", icono: "🏢", grupo: "Clínica", descripcion: "Nombre, RUT, dirección, teléfono y parámetros del sistema." },
  { slug: "especialidades", titulo: "Especialidades", icono: "🎓", grupo: "Clínica", tabla: "especialidades", descripcion: "Áreas de la odontología de cada dentista y prestación." },
  { slug: "previsiones", titulo: "Previsiones", icono: "🩺", grupo: "Clínica", tabla: "previsiones", descripcion: "FONASA, Isapres y otros sistemas de salud del paciente." },
  { slug: "tipos-atencion", titulo: "Tipos de atención", icono: "🏷️", grupo: "Agenda y atención", tabla: "tipos_atencion", descripcion: "Clasificación de cada cita y su duración sugerida." },
  { slug: "agenda-online", titulo: "Agenda online", icono: "🌐", grupo: "Agenda y atención", descripcion: "Reservas por internet: dentistas visibles, duración y días." },
  { slug: "boxes", titulo: "Boxes", icono: "🚪", grupo: "Agenda y atención", tabla: "boxes", descripcion: "Salas o sillones donde se atiende." },
  { slug: "categorias", titulo: "Carpetas de prestaciones", icono: "🗂️", grupo: "Prestaciones", tabla: "categorias_prestaciones", descripcion: "Categorías y su pago: 100% doctor, 100% clínica o x% doctor." },
  { slug: "laboratorios", titulo: "Laboratorios", icono: "🧪", grupo: "Prestaciones", tabla: "laboratorios", descripcion: "Laboratorios dentales externos y su contacto." },
  { slug: "metodos-pago", titulo: "Métodos de pago", icono: "💳", grupo: "Finanzas", descripcion: "Formas de pago aceptadas y si entran a caja." },
  { slug: "bancos", titulo: "Bancos", icono: "🏦", grupo: "Finanzas", tabla: "bancos", descripcion: "Bancos para transferencias, depósitos y cheques." },
  { slug: "registro-cambios", titulo: "Registro de cambios", icono: "🕵️", grupo: "Seguridad", descripcion: "Quién cambió cada configuración y cuándo." },
]

export const GRUPOS_ADMIN = ["Clínica", "Agenda y atención", "Prestaciones", "Finanzas", "Seguridad"] as const

export function seccionAdmin(slug: string) {
  return SECCIONES_ADMIN.find((s) => s.slug === slug)
}

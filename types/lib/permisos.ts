// =====================================================================
// Roles y permisos del sistema.
// Este archivo NO toca la base de datos, así que se puede usar tanto en
// el servidor como en componentes "use client" (para ocultar botones).
// La validación real siempre se hace de nuevo en el servidor.
// =====================================================================

export const ROLES = ["ADMINISTRADOR", "DENTISTA", "ASISTENTE", "RECEPCIONISTA"] as const
export type Rol = (typeof ROLES)[number]

export const ROL_ETIQUETAS: Record<Rol, string> = {
  ADMINISTRADOR: "Administrador",
  DENTISTA: "Dentista",
  ASISTENTE: "Asistente dental",
  RECEPCIONISTA: "Recepcionista",
}

export const ROL_DESCRIPCION: Record<Rol, string> = {
  ADMINISTRADOR: "Acceso total: usuarios, configuración, finanzas y toda la ficha clínica.",
  DENTISTA: "Atención clínica: ficha, antecedentes, evoluciones, RX. Ve su agenda.",
  ASISTENTE: "Apoyo clínico: ve la ficha, registra antecedentes y sube RX. No firma evoluciones.",
  RECEPCIONISTA: "Admisión y caja: registra pacientes, agenda y pagos. Sin acceso a información clínica.",
}

export const ROL_COLOR: Record<Rol, string> = {
  ADMINISTRADOR: "bg-purple-100 text-purple-800 border-purple-300",
  DENTISTA: "bg-blue-100 text-blue-800 border-blue-300",
  ASISTENTE: "bg-teal-100 text-teal-800 border-teal-300",
  RECEPCIONISTA: "bg-amber-100 text-amber-800 border-amber-300",
}

const TODOS: readonly Rol[] = ROLES

/** Matriz de permisos: qué roles pueden hacer cada acción */
const PERMISOS = {
  // Pacientes
  "pacientes.ver": TODOS,
  "pacientes.editar": ["ADMINISTRADOR", "DENTISTA", "RECEPCIONISTA"],
  "pacientes.deshabilitar": ["ADMINISTRADOR", "RECEPCIONISTA"],

  // Información clínica (antecedentes, evoluciones, RX, historial clínico)
  "clinico.ver": ["ADMINISTRADOR", "DENTISTA", "ASISTENTE"],
  "antecedentes.registrar": ["ADMINISTRADOR", "DENTISTA", "ASISTENTE"],
  "evoluciones.crear": ["ADMINISTRADOR", "DENTISTA"],
  "archivos.subir": ["ADMINISTRADOR", "DENTISTA", "ASISTENTE"],

  // Odontograma y plan de tratamiento
  "odontograma.editar": ["ADMINISTRADOR", "DENTISTA"],
  "tratamientos.evolucionar": ["ADMINISTRADOR", "DENTISTA"],

  // Prestaciones y aranceles
  "prestaciones.ver": TODOS,
  "prestaciones.gestionar": ["ADMINISTRADOR"],

  // Próximos módulos (ya definidos para usarlos cuando se construyan)
  "agenda.ver": TODOS,
  "agenda.gestionar": ["ADMINISTRADOR", "RECEPCIONISTA"],
  "presupuestos.gestionar": ["ADMINISTRADOR", "DENTISTA"],
  "pagos.registrar": ["ADMINISTRADOR", "RECEPCIONISTA"],
  "caja.gestionar": ["ADMINISTRADOR", "RECEPCIONISTA"],
  "liquidaciones.ver": ["ADMINISTRADOR"],
  "reportes.ver": ["ADMINISTRADOR"],

  // Administración
  "usuarios.gestionar": ["ADMINISTRADOR"],
} satisfies Record<string, readonly Rol[]>

export type Permiso = keyof typeof PERMISOS

export const PERMISO_ETIQUETAS: Record<Permiso, string> = {
  "pacientes.ver": "Ver pacientes",
  "pacientes.editar": "Registrar / editar pacientes",
  "pacientes.deshabilitar": "Habilitar / deshabilitar pacientes",
  "clinico.ver": "Ver información clínica",
  "antecedentes.registrar": "Registrar antecedentes médicos",
  "evoluciones.crear": "Registrar evoluciones",
  "archivos.subir": "Subir RX y archivos",
  "odontograma.editar": "Registrar en el odontograma",
  "tratamientos.evolucionar": "Evolucionar prestaciones (25-100%)",
  "prestaciones.ver": "Ver prestaciones y precios",
  "prestaciones.gestionar": "Gestionar prestaciones y aranceles",
  "agenda.ver": "Ver agenda",
  "agenda.gestionar": "Agendar / modificar citas",
  "presupuestos.gestionar": "Agregar / anular prestaciones del plan",
  "pagos.registrar": "Registrar pagos",
  "caja.gestionar": "Abrir / cerrar caja",
  "liquidaciones.ver": "Liquidaciones",
  "reportes.ver": "Reportes",
  "usuarios.gestionar": "Gestionar usuarios y roles",
}

export const LISTA_PERMISOS = Object.keys(PERMISOS) as Permiso[]

/** ¿El rol tiene este permiso? */
export function puede(rol: Rol | null | undefined, permiso: Permiso): boolean {
  if (!rol) return false
  return (PERMISOS[permiso] as readonly Rol[]).includes(rol)
}

export const MENSAJE_SIN_PERMISO = "No tienes permiso para realizar esta acción."

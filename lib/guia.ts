import type { Permiso } from "@/lib/permisos"

export type EntradaGuia = {
  que: string
  donde: string
  href: string
  permiso: Permiso
  area: "Clínica" | "Agenda" | "Precios" | "Finanzas" | "Sistema"
}

export const GUIA: EntradaGuia[] = [
  { area: "Clínica", que: "Nombre, RUT, dirección y teléfono de la clínica (salen en impresos)", donde: "Administración › Parámetros › Clínica", href: "/administracion#parametros", permiso: "administracion.gestionar" },
  { area: "Clínica", que: "Datos de un paciente (teléfono, previsión, correo…)", donde: "Pacientes › paciente › Perfil", href: "/pacientes", permiso: "pacientes.editar" },
  { area: "Clínica", que: "Opciones de previsión (FONASA, Isapres…)", donde: "Administración › Previsiones", href: "/administracion#previsiones", permiso: "administracion.gestionar" },
  { area: "Clínica", que: "Especialidades de los dentistas", donde: "Administración › Especialidades", href: "/administracion#especialidades", permiso: "administracion.gestionar" },

  { area: "Agenda", que: "Horario de atención de cada dentista", donde: "Agenda › Configuración › Horarios", href: "/agenda/configuracion", permiso: "agenda.configurar" },
  { area: "Agenda", que: "Boxes (salas / sillones)", donde: "Agenda › Configuración › Boxes", href: "/agenda/configuracion", permiso: "agenda.configurar" },
  { area: "Agenda", que: "Vacaciones o días sin atención", donde: "Agenda › botón Bloquear", href: "/agenda", permiso: "agenda.gestionar" },
  { area: "Agenda", que: "Tipos de atención y su duración", donde: "Administración › Tipos de atención", href: "/administracion#tipos_atencion", permiso: "administracion.gestionar" },

  { area: "Clínica", que: "Fases de un presupuesto", donde: "Pacientes › paciente › Tratamientos › tratamiento", href: "/pacientes", permiso: "presupuestos.gestionar" },
  { area: "Clínica", que: "Imprimir un presupuesto", donde: "Tratamiento › botón Imprimir presupuesto", href: "/pacientes", permiso: "pacientes.ver" },
  { area: "Precios", que: "Crear o editar una prestación", donde: "Prestaciones", href: "/prestaciones", permiso: "prestaciones.gestionar" },
  { area: "Precios", que: "Precio de una prestación en cada arancel", donde: "Prestaciones › prestación › Precios por arancel", href: "/prestaciones", permiso: "prestaciones.gestionar" },
  { area: "Precios", que: "Código FONASA de una prestación", donde: "Prestaciones › prestación › Datos", href: "/prestaciones", permiso: "prestaciones.gestionar" },
  { area: "Precios", que: "Aranceles y categorías", donde: "Prestaciones › Aranceles y categorías", href: "/prestaciones/configuracion", permiso: "prestaciones.gestionar" },
  { area: "Precios", que: "Descuento de un convenio", donde: "FONASA y convenios › Convenios", href: "/fonasa-convenios?tab=convenios", permiso: "convenios.configurar" },

  { area: "Finanzas", que: "Métodos de pago (agregar cheque, desactivar uno…)", donde: "Administración › Métodos de pago", href: "/administracion#metodos-pago", permiso: "administracion.gestionar" },
  { area: "Finanzas", que: "Si un método exige caja abierta", donde: "Administración › Métodos de pago › “Entra a caja”", href: "/administracion#metodos-pago", permiso: "administracion.gestionar" },
  { area: "Finanzas", que: "Porcentaje que gana cada dentista", donde: "Liquidaciones › columna %", href: "/liquidaciones", permiso: "liquidaciones.gestionar" },

  { area: "Sistema", que: "Crear usuarios y cambiar su rol", donde: "Usuarios y roles", href: "/usuarios", permiso: "usuarios.gestionar" },
  { area: "Sistema", que: "Restablecer la contraseña de alguien", donde: "Usuarios y roles › botón Contraseña", href: "/usuarios", permiso: "usuarios.gestionar" },
  { area: "Sistema", que: "Qué puede hacer cada rol", donde: "Usuarios y roles › Matriz de permisos", href: "/usuarios", permiso: "usuarios.gestionar" },
  { area: "Sistema", que: "Ver quién cambió una configuración", donde: "Administración › Registro de cambios", href: "/administracion#auditoria", permiso: "administracion.gestionar" },
]

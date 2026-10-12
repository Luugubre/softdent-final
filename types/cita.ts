export const ESTADOS_CITA = [
  "AGENDADA",
  "CONFIRMADA",
  "EN_ESPERA",
  "EN_ATENCION",
  "REALIZADA",
  "NO_ASISTIO",
  "CANCELADA",
  "REAGENDADA",
] as const
export type EstadoCita = (typeof ESTADOS_CITA)[number]

type Estilo = {
  etiqueta: string
  icono: string
  pill: string
  texto: string
  tarjeta: string
  chip: string
}

export const ESTADO_CITA: Record<EstadoCita, Estilo> = {
  AGENDADA: {
    etiqueta: "No confirmada",
    icono: "🕒",
    pill: "bg-slate-100 border-slate-300 text-slate-700",
    texto: "text-slate-500",
    tarjeta: "bg-slate-50 border-slate-400 text-slate-900",
    chip: "bg-slate-100 text-slate-700",
  },
  CONFIRMADA: {
    etiqueta: "Confirmada",
    icono: "📞",
    pill: "bg-blue-500 border-blue-600 text-white",
    texto: "text-blue-600",
    tarjeta: "bg-blue-50 border-blue-500 text-blue-900",
    chip: "bg-blue-100 text-blue-800",
  },
  EN_ESPERA: {
    etiqueta: "En espera",
    icono: "⏳",
    pill: "bg-amber-400 border-amber-500 text-amber-950",
    texto: "text-amber-600",
    tarjeta: "bg-amber-50 border-amber-500 text-amber-900",
    chip: "bg-amber-100 text-amber-800",
  },
  EN_ATENCION: {
    etiqueta: "En box",
    icono: "🦷",
    pill: "bg-fuchsia-500 border-fuchsia-600 text-white",
    texto: "text-fuchsia-600",
    tarjeta: "bg-fuchsia-50 border-fuchsia-500 text-fuchsia-900 ring-2 ring-fuchsia-300",
    chip: "bg-fuchsia-100 text-fuchsia-800",
  },
  REALIZADA: {
    etiqueta: "Atendido",
    icono: "✅",
    pill: "bg-emerald-400 border-emerald-500 text-emerald-950",
    texto: "text-emerald-600",
    tarjeta: "bg-emerald-50 border-emerald-500 text-emerald-900",
    chip: "bg-emerald-100 text-emerald-800",
  },
  NO_ASISTIO: {
    etiqueta: "No asistió",
    icono: "🚫",
    pill: "bg-rose-500 border-rose-600 text-white",
    texto: "text-rose-600",
    tarjeta: "bg-rose-50 border-rose-400 text-rose-800 opacity-80",
    chip: "bg-rose-100 text-rose-800",
  },
  CANCELADA: {
    etiqueta: "Anulada",
    icono: "🗑",
    pill: "bg-neutral-300 border-neutral-400 text-neutral-700",
    texto: "text-neutral-500",
    tarjeta: "bg-neutral-100 border-neutral-300 text-neutral-600 opacity-60 line-through",
    chip: "bg-neutral-200 text-neutral-700",
  },
  REAGENDADA: {
    etiqueta: "Reprogramada",
    icono: "🔁",
    pill: "bg-violet-500 border-violet-600 text-white",
    texto: "text-violet-600",
    tarjeta: "bg-violet-50 border-violet-300 text-violet-700 opacity-60",
    chip: "bg-violet-100 text-violet-800",
  },
}

const TRANSICIONES: Record<EstadoCita, EstadoCita[]> = {
  AGENDADA: ["CONFIRMADA", "EN_ESPERA", "EN_ATENCION", "REAGENDADA", "CANCELADA", "NO_ASISTIO"],
  CONFIRMADA: ["EN_ESPERA", "EN_ATENCION", "REAGENDADA", "CANCELADA", "NO_ASISTIO"],
  EN_ESPERA: ["EN_ATENCION", "REALIZADA", "NO_ASISTIO"],
  EN_ATENCION: ["REALIZADA"],
  REALIZADA: [],
  NO_ASISTIO: [],
  CANCELADA: [],
  REAGENDADA: [],
}

export function puedePasarA(actual: EstadoCita, nuevo: EstadoCita) {
  return TRANSICIONES[actual].includes(nuevo)
}

export function siguientesEstados(actual: EstadoCita): EstadoCita[] {
  return TRANSICIONES[actual].filter((e) => e !== "REAGENDADA")
}

export const ESTADOS_VIGENTES: EstadoCita[] = ["AGENDADA", "CONFIRMADA", "EN_ESPERA", "EN_ATENCION"]

export const TIPOS_BLOQUEO = ["VACACIONES", "REUNION", "MANTENCION", "OTRO"] as const
export type TipoBloqueo = (typeof TIPOS_BLOQUEO)[number]
export const TIPO_BLOQUEO: Record<TipoBloqueo, string> = {
  VACACIONES: "Vacaciones",
  REUNION: "Reunión",
  MANTENCION: "Mantención",
  OTRO: "Otro",
}

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const

export type CitaAgenda = {
  id: string
  numero: number
  paciente_id: string
  profesional_id: string
  box_id: string | null
  prestacion_id: string | null
  presupuesto_id: string | null
  inicio: string
  fin: string
  duracion_min: number
  estado: EstadoCita
  motivo: string | null
  sobrecupo: boolean
  motivo_sobrecupo: string | null
  motivo_cancelacion: string | null
  cita_original_id: string | null
  hora_llegada: string | null
  hora_inicio_atencion: string | null
  hora_fin_atencion: string | null
  recordatorio_enviado_en: string | null
  created_at: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  minuto_inicio: number
  paciente_nombre: string
  paciente_nombres: string
  paciente_apellidos: string
  paciente_rut: string
  paciente_telefono: string | null
  profesional_nombre: string
  box_nombre: string | null
  prestacion_nombre: string | null
  tratamiento_numero: number | null
  tratamiento_nombre: string | null
  creado_por_nombre: string | null
  tipo_atencion_id: string | null
  tipo_atencion_nombre: string | null
}

export type TipoAtencion = { id: string; nombre: string; duracion_min: number }

export type InfoPaciente = {
  porCobrar: number
  deuda: number
  totalTratamientos: number
  inasistencias: number
}

export type BloqueoAgenda = {
  id: string
  tipo: TipoBloqueo
  motivo: string
  inicio: string
  fin: string
  profesional_id: string | null
  box_id: string | null
  profesional: { nombre_completo: string } | null
  box: { nombre: string } | null
}

export type HorarioAtencion = {
  id: string
  profesional_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export type Box = { id: string; nombre: string; activo: boolean }
export type ProfesionalAgenda = { id: string; nombre_completo: string; especialidad: string | null }
export type PrestacionAgenda = { id: string; codigo_interno: string; nombre: string; duracion_min: number }
export type PacienteBusqueda = { id: string; nombres: string; apellidos: string; rut: string; telefono: string | null }

export type BloqueElegido = { fecha: string; hora: string; duracion: number; sobrecupo?: boolean }

export type DisponibilidadSemana = {
  tramos: Record<string, [number, number][]>
  ocupadas: Record<string, [number, number][]>
  bloqueadas: Record<string, [number, number][]>
}

export type HoraLibre = { fecha: string; hora: string; profesional_id: string; profesional_nombre: string }

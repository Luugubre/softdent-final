export type TipoEvento =
  | "PACIENTE"
  | "ANTECEDENTE"
  | "EVOLUCION"
  | "ARCHIVO"
  | "CITA"
  | "PRESUPUESTO"
  | "PAGO"
  | "ODONTOGRAMA"
  | "RECETA"
  | "DOCUMENTO"
  | "CONSENTIMIENTO"

export type EventoHistorial = {
  id: string
  paciente_id: string
  tipo: TipoEvento
  accion: string
  titulo: string
  detalle: string | null
  profesional: string | null
  referencia_tabla: string | null
  referencia_id: string | null
  datos: Record<string, string | null> | null
  fecha: string
}

/** Cómo se ve cada tipo de evento en la línea de tiempo y a qué sección lleva */
export const ESTILO_EVENTO: Record<TipoEvento, { etiqueta: string; icono: string; color: string; seccion: string }> = {
  PACIENTE: { etiqueta: "Datos", icono: "👤", color: "bg-slate-100 text-slate-700 border-slate-300", seccion: "datos" },
  ANTECEDENTE: { etiqueta: "Antecedente", icono: "🩺", color: "bg-amber-50 text-amber-800 border-amber-300", seccion: "antecedentes" },
  EVOLUCION: { etiqueta: "Evolución", icono: "📝", color: "bg-blue-50 text-blue-800 border-blue-300", seccion: "evoluciones" },
  ARCHIVO: { etiqueta: "RX / archivo", icono: "🩻", color: "bg-violet-50 text-violet-800 border-violet-300", seccion: "rx-documentos" },
  CITA: { etiqueta: "Cita", icono: "📅", color: "bg-emerald-50 text-emerald-800 border-emerald-300", seccion: "" },
  PRESUPUESTO: { etiqueta: "Tratamiento", icono: "📋", color: "bg-cyan-50 text-cyan-800 border-cyan-300", seccion: "tratamientos" },
  PAGO: { etiqueta: "Pago", icono: "💳", color: "bg-green-50 text-green-800 border-green-300", seccion: "" },
  ODONTOGRAMA: { etiqueta: "Odontograma", icono: "🦷", color: "bg-sky-50 text-sky-800 border-sky-300", seccion: "odontograma" },
  RECETA: { etiqueta: "Receta", icono: "💊", color: "bg-pink-50 text-pink-800 border-pink-300", seccion: "" },
  DOCUMENTO: { etiqueta: "Documento", icono: "📄", color: "bg-gray-50 text-gray-700 border-gray-300", seccion: "" },
  CONSENTIMIENTO: { etiqueta: "Consentimiento", icono: "✍️", color: "bg-orange-50 text-orange-800 border-orange-300", seccion: "" },
}

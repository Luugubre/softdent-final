const ZONA = "America/Santiago"

/** "2001-05-09" → "09-05-2001" (sin pasar por Date, para que no se corra un día) */
export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  return `${dia}-${mes}-${anio}`
}

/** Timestamp ISO → "09-10-2026 14:35" en hora de Chile */
export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-CL", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Timestamp ISO → "15 sept 2026" (para agrupar la línea de tiempo por día) */
export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Timestamp ISO → "12:42" */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CL", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" })
}

/** 15000 → "$15.000" */
export function formatearPesos(monto: number | null | undefined): string {
  if (monto === null || monto === undefined) return "—"
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(monto)
}

/** Fecha de hoy en Chile como "YYYY-MM-DD" */
export function hoyChile(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA })
}

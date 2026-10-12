const ZONA = "America/Santiago"

export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  return `${dia}-${mes}-${anio}`
}

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

export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CL", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" })
}

export function formatearPesos(monto: number | null | undefined): string {
  if (monto === null || monto === undefined) return "—"
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(monto)
}

export function hoyChile(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA })
}

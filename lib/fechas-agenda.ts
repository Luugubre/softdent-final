// Utilidades de fecha para la agenda. Sin dependencias de servidor:
// se usan tanto en páginas como en componentes "use client".
// Las fechas se manejan como texto "YYYY-MM-DD" (día en Chile) para no correr días por la zona horaria.

const ZONA = "America/Santiago"

function aDate(fecha: string) {
  return new Date(`${fecha}T12:00:00Z`)
}
function aTexto(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function sumarDias(fecha: string, dias: number) {
  const d = aDate(fecha)
  d.setUTCDate(d.getUTCDate() + dias)
  return aTexto(d)
}

/** 1 = lunes ... 7 = domingo */
export function diaSemana(fecha: string) {
  const d = aDate(fecha).getUTCDay()
  return d === 0 ? 7 : d
}

export function lunesDeLaSemana(fecha: string) {
  return sumarDias(fecha, 1 - diaSemana(fecha))
}

export function primeroDelMes(fecha: string) {
  return `${fecha.slice(0, 7)}-01`
}

export function sumarMeses(fecha: string, meses: number) {
  const d = aDate(primeroDelMes(fecha))
  d.setUTCMonth(d.getUTCMonth() + meses)
  return aTexto(d)
}

export function fechaValida(fecha: string | undefined | null): fecha is string {
  return !!fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(aDate(fecha).getTime())
}

/** "2026-10-12" → "lunes 12 de octubre de 2026" */
export function fechaTitulo(fecha: string, opciones?: Intl.DateTimeFormatOptions) {
  return aDate(fecha).toLocaleDateString("es-CL", {
    timeZone: "UTC",
    ...(opciones ?? { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  })
}

const formatoPartes = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Timestamp ISO → día y minuto del día, en hora de Chile */
export function partesChile(iso: string) {
  const p = Object.fromEntries(formatoPartes.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) }
}

export function hoyEnChile() {
  return partesChile(new Date().toISOString()).fecha
}

/** 545 → "09:05" */
export function minutosAHora(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
}

/** "09:30" o "09:30:00" → 570 */
export function horaAMinutos(hora: string) {
  const [h, m] = hora.split(":").map(Number)
  return h * 60 + m
}

/** Parte de un bloqueo (o cualquier rango) que cae en un día, en minutos. null si no lo toca. */
export function rangoEnDia(inicioIso: string, finIso: string, fecha: string): [number, number] | null {
  const a = partesChile(inicioIso)
  const b = partesChile(finIso)
  if (a.fecha > fecha || b.fecha < fecha) return null
  const desde = a.fecha < fecha ? 0 : a.minutos
  const hasta = b.fecha > fecha ? 1440 : b.minutos
  return hasta > desde ? [desde, hasta] : null
}

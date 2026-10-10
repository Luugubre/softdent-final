// Mensajes de WhatsApp de la agenda (texto plano, sin acceso a la BD)
import { DIRECCION_CLINICA, NOMBRE_CLINICA } from "@/lib/clinica"
import { fechaTitulo, hoyEnChile, sumarDias } from "@/lib/fechas-agenda"
import type { BloqueElegido, CitaAgenda } from "@/types/cita"

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fechaLarga = (f: string) => fechaTitulo(f, { weekday: "long", day: "numeric", month: "long" }).replace(",", "")
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? ""
const direccion = () => (DIRECCION_CLINICA ? `📍 Dirección: ${DIRECCION_CLINICA}.\n\n` : "")

function cuando(fecha: string) {
  const hoy = hoyEnChile()
  if (fecha === hoy) return `HOY ${fechaLarga(fecha)}`
  if (fecha === sumarDias(hoy, 1)) return `MAÑANA ${fechaLarga(fecha)}`
  return `el ${capitalizar(fechaLarga(fecha))}`
}

/** Recordatorio: si el paciente tiene varias citas ese día van en un solo mensaje */
export function mensajeRecordatorio(citas: CitaAgenda[]) {
  const c0 = citas[0]
  let m = `Hola ${primerNombre(c0.paciente_nombres)}, te escribimos de ${NOMBRE_CLINICA} para recordar `
  if (citas.length === 1) {
    m += `tu cita con ${c0.profesional_nombre} ${cuando(c0.fecha)} a las ${c0.hora_inicio} hrs.\n\n`
  } else {
    m += `tus citas de ${cuando(c0.fecha)}:\n`
    for (const c of citas) m += `🕒 ${c.hora_inicio} hrs con ${c.profesional_nombre}\n`
    m += "\n"
  }
  m += direccion()
  m += "Por favor responde este mensaje con *SÍ* para confirmar tu asistencia. Si no puedes asistir, avísanos para liberar la hora. ¡Gracias!"
  return m
}

export function mensajeCitaAgendada(paciente: string, profesional: string, bloques: BloqueElegido[]) {
  const ordenados = [...bloques].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
  const [b0, ...resto] = ordenados
  let m = `Hola ${primerNombre(paciente)}, hemos agendado tu cita con ${profesional} para ${cuando(b0.fecha)} a las ${b0.hora} hrs.\n\n`
  if (resto.length) {
    m += "También quedaron agendadas tus siguientes sesiones:\n"
    for (const b of resto) m += `🗓️ ${capitalizar(fechaLarga(b.fecha))} a las ${b.hora} hrs\n`
    m += "\n"
  }
  m += direccion()
  m += `¡Te esperamos en ${NOMBRE_CLINICA}!`
  return m
}

export function mensajeCambioHora(cita: CitaAgenda, fecha: string, hora: string, profesional: string) {
  return (
    `Hola ${primerNombre(cita.paciente_nombres)}, te escribimos de ${NOMBRE_CLINICA} para informarte que tu cita fue cambiada para ` +
    `${cuando(fecha)} a las ${hora} hrs con ${profesional}.\n\n${direccion()}Por favor responde con *SÍ* para confirmar. ¡Gracias!`
  )
}

export function mensajeInasistencia(cita: CitaAgenda) {
  const dia = cita.fecha === hoyEnChile() ? "Hoy" : `El ${fechaLarga(cita.fecha)}`
  return (
    `Hola ${primerNombre(cita.paciente_nombres)}, te escribimos de ${NOMBRE_CLINICA}. ${dia} te esperábamos a las ${cita.hora_inicio} hrs ` +
    `para tu cita con ${cita.profesional_nombre} y no pudiste asistir.\n\nEntendemos que pueden surgir imprevistos 🙂 ` +
    "¿Te gustaría que te busquemos una nueva hora? Respóndenos este mensaje y te ayudamos a reagendar.\n\n¡Saludos! 🦷"
  )
}

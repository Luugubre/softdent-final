"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO, puede } from "@/lib/permisos"
import { obtenerBloqueos, obtenerHistorialCita } from "@/lib/agenda"
import { diaSemana, horaAMinutos, rangoEnDia, sumarDias } from "@/lib/fechas-agenda"
import { calcularEdad, normalizarRut, PREVISIONES, validarRut } from "@/lib/validaciones"
import {
  ESTADOS_CITA,
  ESTADOS_VIGENTES,
  TIPOS_BLOQUEO,
  type BloqueElegido,
  type CitaAgenda,
  type DisponibilidadSemana,
  type EstadoCita,
  type HoraLibre,
  type PacienteBusqueda,
  type PrestacionAgenda,
} from "@/types/cita"

type Resultado = { ok: boolean; mensaje: string; id?: string }

const UUID = /^[0-9a-f-]{36}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/

function mensajeBD(error: { message?: string } | null, porDefecto: string) {
  const m = error?.message ?? ""
  if (m.includes("horarios_sin_solapamiento")) return "Ese horario se cruza con otro tramo del mismo día."
  if (m.includes("boxes_nombre_key")) return "Ya existe un box con ese nombre."
  if (m.includes("pacientes_rut_key")) return "Ya existe un paciente con ese RUT: búscalo en el buscador."
  if (m.includes("Could not find the function") || m.includes("schema cache") || (m.includes("column") && m.includes("does not exist")))
    return "Falta actualizar la base de datos: ejecuta supabase/14_agenda_clinica.sql en el SQL Editor de Supabase."
  return m && !m.includes("violates") && !m.includes("schema cache") ? m : porDefecto
}

function refrescar(pacienteId?: string) {
  revalidatePath("/agenda", "layout")
  if (pacienteId) revalidatePath(`/pacientes/${pacienteId}`, "layout")
}

const uuidONull = (v?: string | null) => (v && UUID.test(v) ? v : null)

// =====================================================================
// AGENDAR (uno o varios bloques)
// =====================================================================
export async function agendarCitas(datos: {
  pacienteId: string
  profesionalId: string
  bloques: BloqueElegido[]
  motivo?: string
  presupuestoId?: string | null
  prestacionId?: string | null
  boxId?: string | null
  motivoSobrecupo?: string
  tipoAtencionId?: string | null
}): Promise<Resultado & { ids?: string[] }> {
  const usuario = await autorizar("agenda.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!UUID.test(datos.pacienteId)) return { ok: false, mensaje: "Selecciona un paciente." }
  if (!UUID.test(datos.profesionalId)) return { ok: false, mensaje: "Selecciona un especialista." }
  const bloques = datos.bloques.filter((b) => FECHA.test(b.fecha) && HORA.test(b.hora) && b.duracion >= 5 && b.duracion <= 480)
  if (bloques.length === 0) return { ok: false, mensaje: "Selecciona al menos un horario." }
  if (bloques.some((b) => b.sobrecupo) && !puede(usuario.rol, "agenda.sobrecupo")) {
    return { ok: false, mensaje: "Tu rol no puede autorizar sobrecupos." }
  }

  const { data, error } = await getSupabase().rpc("agendar_citas", {
    p_paciente: datos.pacienteId,
    p_profesional: datos.profesionalId,
    p_bloques: bloques.map((b) => ({ fecha: b.fecha, hora: b.hora, duracion: b.duracion, sobrecupo: !!b.sobrecupo })),
    p_usuario: usuario.id,
    p_box: uuidONull(datos.boxId),
    p_prestacion: uuidONull(datos.prestacionId),
    p_motivo: datos.motivo?.trim() || "CONSULTA",
    p_presupuesto: uuidONull(datos.presupuestoId),
    p_motivo_sobrecupo: datos.motivoSobrecupo ?? null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo agendar.") }

  const ids = (data ?? []) as string[]
  if (ids.length && uuidONull(datos.tipoAtencionId)) {
    await getSupabase().from("citas").update({ tipo_atencion_id: datos.tipoAtencionId }).in("id", ids)
  }
  refrescar(datos.pacienteId)
  return { ok: true, mensaje: ids.length > 1 ? `${ids.length} citas agendadas.` : "Cita agendada.", ids }
}

export async function reprogramarCita(
  citaId: string,
  datos: { profesionalId: string; bloque: BloqueElegido; motivo?: string; boxId?: string | null; motivoSobrecupo?: string }
): Promise<Resultado> {
  const usuario = await autorizar("agenda.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const b = datos.bloque
  if (!UUID.test(citaId) || !UUID.test(datos.profesionalId) || !FECHA.test(b.fecha) || !HORA.test(b.hora)) {
    return { ok: false, mensaje: "Selecciona el nuevo horario." }
  }
  if (b.sobrecupo && !puede(usuario.rol, "agenda.sobrecupo")) return { ok: false, mensaje: "Tu rol no puede autorizar sobrecupos." }

  const { data, error } = await getSupabase().rpc("reagendar_cita", {
    p_cita: citaId,
    p_fecha: b.fecha,
    p_hora: b.hora,
    p_usuario: usuario.id,
    p_profesional: datos.profesionalId,
    p_box: uuidONull(datos.boxId),
    p_duracion: b.duracion,
    p_motivo: datos.motivo?.trim() || null,
    p_sobrecupo: !!b.sobrecupo,
    p_motivo_sobrecupo: b.sobrecupo ? datos.motivoSobrecupo ?? null : null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo reprogramar la cita.") }

  refrescar()
  return { ok: true, mensaje: "Cita reprogramada.", id: data as string }
}

export async function cambiarEstadoCita(citaId: string, estado: EstadoCita, motivo?: string): Promise<Resultado> {
  const usuario = await autorizar("agenda.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!UUID.test(citaId) || !ESTADOS_CITA.includes(estado)) return { ok: false, mensaje: "Datos no válidos." }

  const { error } = await getSupabase().rpc("cambiar_estado_cita", {
    p_cita: citaId,
    p_estado: estado,
    p_usuario: usuario.id,
    p_motivo: motivo ?? null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo cambiar el estado de la cita.") }

  refrescar()
  return { ok: true, mensaje: "Estado actualizado." }
}

// =====================================================================
// DISPONIBILIDAD DE UNA SEMANA (para elegir bloques)
// =====================================================================
export async function disponibilidadSemana(
  profesionalId: string,
  lunes: string,
  excluirCita?: string | null
): Promise<DisponibilidadSemana | null> {
  if (!(await autorizar("agenda.ver"))) return null
  if (!UUID.test(profesionalId) || !FECHA.test(lunes)) return null
  const supabase = getSupabase()
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const domingo = dias[6]

  const [{ data: horarios }, { data: citas }, bloqueos] = await Promise.all([
    supabase.from("horarios_atencion").select("dia_semana, hora_inicio, hora_fin").eq("profesional_id", profesionalId),
    supabase
      .from("v_agenda")
      .select("id, fecha, minuto_inicio, duracion_min")
      .eq("profesional_id", profesionalId)
      .in("estado", ESTADOS_VIGENTES)
      .gte("fecha", lunes)
      .lte("fecha", domingo),
    obtenerBloqueos(lunes, domingo),
  ])

  const res: DisponibilidadSemana = { tramos: {}, ocupadas: {}, bloqueadas: {} }
  for (const d of dias) {
    const dow = diaSemana(d)
    res.tramos[d] =
      (horarios ?? []).length === 0
        ? dow < 7
          ? [[540, 1140]] // sin horario configurado: 09:00 a 19:00, lunes a sábado
          : []
        : (horarios ?? [])
            .filter((h) => h.dia_semana === dow)
            .map((h) => [horaAMinutos(h.hora_inicio), horaAMinutos(h.hora_fin)] as [number, number])
            .sort((a, b) => a[0] - b[0])
    res.ocupadas[d] = (citas ?? [])
      .filter((c) => c.fecha === d && c.id !== excluirCita)
      .map((c) => [c.minuto_inicio, c.minuto_inicio + c.duracion_min] as [number, number])
    res.bloqueadas[d] = bloqueos
      .filter((b) => (!b.profesional_id && !b.box_id) || b.profesional_id === profesionalId)
      .map((b) => rangoEnDia(b.inicio, b.fin, d))
      .filter((r): r is [number, number] => r !== null)
  }
  return res
}

/** "¿Cuándo hay hora?" */
export async function buscarHorasLibres(filtro: {
  duracion: number
  desde: string
  profesionalId?: string | null
  turno: "cualquiera" | "manana" | "tarde"
  limite: number
}): Promise<HoraLibre[]> {
  if (!(await autorizar("agenda.ver"))) return []
  const { data, error } = await getSupabase().rpc("proximas_horas", {
    p_duracion: Math.max(5, Math.round(filtro.duracion / 5) * 5),
    p_desde: FECHA.test(filtro.desde) ? filtro.desde : null,
    p_profesional: uuidONull(filtro.profesionalId),
    p_turno: filtro.turno,
    p_limite: Math.min(Math.max(filtro.limite, 5), 60),
  })
  if (error) return []
  return ((data ?? []) as HoraLibre[]).sort((a, b) => `${a.fecha}${a.hora}${a.profesional_nombre}`.localeCompare(`${b.fecha}${b.hora}${b.profesional_nombre}`))
}

// =====================================================================
// PACIENTE, TRATAMIENTOS Y PRESTACIONES (para el modal de agendar)
// =====================================================================
export async function buscarPacientes(texto: string): Promise<(PacienteBusqueda & { activo: boolean })[]> {
  if (!(await autorizar("agenda.gestionar"))) return []
  const q = texto.trim().replace(/[,()%*\\"']/g, " ")
  if (q.length < 2) return []
  const partes = q.split(/\s+/).filter(Boolean).slice(0, 4)

  const grupos = partes.map((p) => {
    if (/\d/.test(p)) {
      const limpio = p.replace(/\./g, "")
      const cuerpo = limpio.includes("-") ? limpio.split("-")[0].replace(/\D/g, "") : limpio.replace(/[^0-9kK]/g, "").toUpperCase()
      return `or(rut.ilike.%${cuerpo}%)`
    }
    return `or(nombres.ilike.%${p}%,apellidos.ilike.%${p}%)`
  })
  const filtro = grupos.length === 1 ? grupos[0].slice(3, -1) : `and(${grupos.join(",")})`

  const { data } = await getSupabase()
    .from("pacientes")
    .select("id, nombres, apellidos, rut, telefono, activo")
    .or(filtro)
    .order("activo", { ascending: false })
    .order("apellidos")
    .limit(8)
  return (data ?? []) as (PacienteBusqueda & { activo: boolean })[]
}

/** Registro rápido de paciente desde la agenda */
export async function crearPacienteRapido(d: {
  nombres: string
  apellidos: string
  rut: string
  extranjero: boolean
  fechaNacimiento: string
  telefono: string
  prevision: string
}): Promise<{ ok: boolean; mensaje: string; paciente?: PacienteBusqueda }> {
  if (!(await autorizar("pacientes.editar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const nombres = d.nombres.trim().toUpperCase()
  const apellidos = d.apellidos.trim().toUpperCase()
  if (!nombres || !apellidos) return { ok: false, mensaje: "Nombres y apellidos son obligatorios." }
  if (!d.extranjero && !validarRut(d.rut)) return { ok: false, mensaje: "RUT no válido." }
  if (d.extranjero && d.rut.trim().length < 3) return { ok: false, mensaje: "Ingresa el N° de documento." }
  if (!FECHA.test(d.fechaNacimiento) || calcularEdad(d.fechaNacimiento) === null) return { ok: false, mensaje: "Fecha de nacimiento no válida." }
  const edad = calcularEdad(d.fechaNacimiento) ?? 0
  if (edad < 18) return { ok: false, mensaje: "Es menor de edad: regístralo desde Pacientes para ingresar los datos del apoderado." }
  const digitos = d.telefono.replace(/\D/g, "")
  const telefono = digitos.length === 9 ? `+56${digitos}` : digitos.length === 11 && digitos.startsWith("56") ? `+${digitos}` : d.telefono.trim() || null
  const prevision = (PREVISIONES as readonly string[]).includes(d.prevision) ? d.prevision : PREVISIONES[0]

  const { data, error } = await getSupabase()
    .from("pacientes")
    .insert({
      rut: d.extranjero ? d.rut.trim().toUpperCase() : normalizarRut(d.rut),
      extranjero: d.extranjero,
      nombres,
      apellidos,
      fecha_nacimiento: d.fechaNacimiento,
      telefono,
      prevision,
    })
    .select("id, nombres, apellidos, rut, telefono")
    .single()
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo registrar el paciente.") }

  revalidatePath("/pacientes")
  return { ok: true, mensaje: "Paciente registrado.", paciente: data as PacienteBusqueda }
}

/** Tratamientos activos del paciente, inasistencias y deuda (al elegirlo en el modal) */
export async function resumenPacienteAgenda(pacienteId: string) {
  if (!(await autorizar("agenda.gestionar")) || !UUID.test(pacienteId)) return null
  const supabase = getSupabase()
  const haceUnAnio = new Date()
  haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1)
  const [{ data: tratamientos }, { count }] = await Promise.all([
    supabase.from("presupuestos").select("id, numero, nombre").eq("paciente_id", pacienteId).eq("estado", "ACTIVO").order("numero", { ascending: false }),
    supabase
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("paciente_id", pacienteId)
      .eq("estado", "NO_ASISTIO")
      .gte("inicio", haceUnAnio.toISOString()),
  ])
  return {
    tratamientos: (tratamientos ?? []) as { id: string; numero: number; nombre: string }[],
    inasistencias: count ?? 0,
  }
}

export async function buscarPrestaciones(texto: string): Promise<PrestacionAgenda[]> {
  if (!(await autorizar("agenda.gestionar"))) return []
  const q = texto.trim().replace(/[,()%*\\"']/g, " ")
  if (q.length < 2) return []
  const { data } = await getSupabase()
    .from("prestaciones")
    .select("id, codigo_interno, nombre, duracion_min")
    .eq("activo", true)
    .or(`nombre.ilike.%${q}%,codigo_interno.ilike.%${q}%`)
    .order("nombre")
    .limit(8)
  return (data ?? []) as PrestacionAgenda[]
}

// =====================================================================
// RECORDATORIOS
// =====================================================================
export async function citasParaRecordar(fecha: string, profesionalId?: string | null): Promise<CitaAgenda[]> {
  if (!(await autorizar("agenda.gestionar")) || !FECHA.test(fecha)) return []
  let q = getSupabase().from("v_agenda").select("*").eq("fecha", fecha).in("estado", ["AGENDADA", "CONFIRMADA"])
  if (uuidONull(profesionalId)) q = q.eq("profesional_id", profesionalId as string)
  const { data } = await q.order("inicio")
  return (data ?? []) as CitaAgenda[]
}

export async function marcarRecordatorio(citaIds: string[]): Promise<Resultado> {
  if (!(await autorizar("agenda.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const ids = citaIds.filter((id) => UUID.test(id))
  if (ids.length === 0) return { ok: false, mensaje: "Sin citas." }
  const { error } = await getSupabase().from("citas").update({ recordatorio_enviado_en: new Date().toISOString() }).in("id", ids)
  if (error) return { ok: false, mensaje: "No se pudo registrar el recordatorio." }
  refrescar()
  return { ok: true, mensaje: "Recordatorio registrado." }
}

export async function historialCita(citaId: string) {
  if (!(await autorizar("agenda.ver")) || !UUID.test(citaId)) return []
  return obtenerHistorialCita(citaId)
}

// =====================================================================
// BLOQUEOS
// =====================================================================
export async function crearBloqueo(datos: {
  tipo: string
  motivo: string
  fechaInicio: string
  horaInicio: string
  fechaFin: string
  horaFin: string
  profesionalId?: string | null
  boxId?: string | null
}): Promise<Resultado> {
  const usuario = await autorizar("agenda.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!(TIPOS_BLOQUEO as readonly string[]).includes(datos.tipo)) return { ok: false, mensaje: "Selecciona el tipo de bloqueo." }
  if (!datos.motivo.trim()) return { ok: false, mensaje: "Indica el motivo del bloqueo." }
  if (![datos.fechaInicio, datos.fechaFin].every((f) => FECHA.test(f)) || ![datos.horaInicio, datos.horaFin].every((h) => HORA.test(h))) {
    return { ok: false, mensaje: "Completa las fechas y horas." }
  }

  const supabase = getSupabase()
  const [{ data: inicio }, { data: fin }] = await Promise.all([
    supabase.rpc("hora_chile", { p_fecha: datos.fechaInicio, p_hora: datos.horaInicio }),
    supabase.rpc("hora_chile", { p_fecha: datos.fechaFin, p_hora: datos.horaFin }),
  ])
  if (!inicio || !fin || new Date(String(fin)) <= new Date(String(inicio))) {
    return { ok: false, mensaje: "El término debe ser posterior al inicio." }
  }

  const { error } = await supabase.from("bloqueos_agenda").insert({
    tipo: datos.tipo,
    motivo: datos.motivo.trim(),
    inicio,
    fin,
    profesional_id: uuidONull(datos.profesionalId),
    box_id: uuidONull(datos.boxId),
    creado_por: usuario.id,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo crear el bloqueo.") }

  refrescar()
  return { ok: true, mensaje: "Horario bloqueado. Las citas ya agendadas en ese rango se mantienen: revísalas." }
}

export async function eliminarBloqueo(bloqueoId: string): Promise<Resultado> {
  if (!(await autorizar("agenda.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().from("bloqueos_agenda").delete().eq("id", bloqueoId)
  if (error) return { ok: false, mensaje: "No se pudo quitar el bloqueo." }
  refrescar()
  return { ok: true, mensaje: "Bloqueo eliminado." }
}

// =====================================================================
// CONFIGURACIÓN: boxes y horarios
// =====================================================================
export async function crearBox(nombre: string): Promise<Resultado> {
  if (!(await autorizar("agenda.configurar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!nombre.trim()) return { ok: false, mensaje: "Indica el nombre del box." }
  const { error } = await getSupabase().from("boxes").insert({ nombre: nombre.trim() })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo crear el box.") }
  refrescar()
  return { ok: true, mensaje: "Box creado." }
}

export async function cambiarEstadoBox(boxId: string, activo: boolean): Promise<Resultado> {
  if (!(await autorizar("agenda.configurar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().from("boxes").update({ activo }).eq("id", boxId)
  if (error) return { ok: false, mensaje: "No se pudo actualizar el box." }
  refrescar()
  return { ok: true, mensaje: activo ? "Box activado." : "Box desactivado." }
}

export async function agregarHorario(profesionalId: string, dias: number[], horaInicio: string, horaFin: string): Promise<Resultado> {
  if (!(await autorizar("agenda.configurar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!UUID.test(profesionalId)) return { ok: false, mensaje: "Selecciona el profesional." }
  const validos = dias.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  if (validos.length === 0) return { ok: false, mensaje: "Selecciona al menos un día." }
  if (!HORA.test(horaInicio) || !HORA.test(horaFin) || horaFin <= horaInicio) {
    return { ok: false, mensaje: "La hora de término debe ser posterior a la de inicio." }
  }
  const { error } = await getSupabase()
    .from("horarios_atencion")
    .insert(validos.map((d) => ({ profesional_id: profesionalId, dia_semana: d, hora_inicio: horaInicio, hora_fin: horaFin })))
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo guardar el horario.") }
  refrescar()
  return { ok: true, mensaje: "Horario guardado." }
}

export async function eliminarHorario(horarioId: string): Promise<Resultado> {
  if (!(await autorizar("agenda.configurar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().from("horarios_atencion").delete().eq("id", horarioId)
  if (error) return { ok: false, mensaje: "No se pudo eliminar el horario." }
  refrescar()
  return { ok: true, mensaje: "Horario eliminado." }
}

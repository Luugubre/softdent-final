"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { calcularEdad, normalizarRut, pacienteSchema, type PacienteFormData } from "@/lib/validaciones"

export type EstadoFormulario = {
  ok: boolean
  mensaje?: string
  errores?: Partial<Record<string, string[]>>
  pacienteId?: string
}

/** FormData → objeto, descartando campos vacíos */
function leerFormulario(formData: FormData) {
  const datos: Record<string, unknown> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === "string" && valor.trim() !== "") datos[clave] = valor
  }
  datos.extranjero = formData.get("extranjero") === "on"
  datos.fecha_nacimiento ??= ""
  return datos
}

/**
 * Arma la fila a guardar. Los campos vacíos van como null para que,
 * al editar, borrar un dato realmente lo borre de la BD.
 */
function prepararFila(d: PacienteFormData) {
  const esMenor = (calcularEdad(d.fecha_nacimiento) ?? 99) < 18
  return {
    rut: d.extranjero ? d.rut.toUpperCase() : normalizarRut(d.rut),
    extranjero: d.extranjero,
    nombres: d.nombres,
    apellidos: d.apellidos,
    nombre_social: d.nombre_social ?? null,
    fecha_nacimiento: d.fecha_nacimiento,
    sexo: d.sexo ?? null,
    genero: d.genero ?? null,
    telefono: d.telefono ?? null,
    telefono_fijo: d.telefono_fijo ?? null,
    email: d.email ?? null,
    direccion: d.direccion ?? null,
    comuna: d.comuna ?? null,
    ciudad: d.ciudad ?? null,
    prevision: d.prevision,
    actividad_profesion: d.actividad_profesion ?? null,
    empleador: d.empleador ?? null,
    referencia: d.referencia ?? null,
    observaciones: d.observaciones ?? null,
    // El apoderado solo se guarda si es menor de edad
    apoderado_nombre: esMenor ? d.apoderado_nombre ?? null : null,
    apoderado_rut: esMenor && d.apoderado_rut ? normalizarRut(d.apoderado_rut) : null,
    apoderado_telefono: esMenor ? d.apoderado_telefono ?? null : null,
  }
}

/** Busca si el RUT ya pertenece a otro paciente */
async function rutDuplicado(rut: string, excluirId?: string) {
  let consulta = getSupabase().from("pacientes").select("nombres, apellidos").eq("rut", rut)
  if (excluirId) consulta = consulta.neq("id", excluirId)
  const { data } = await consulta.maybeSingle()
  return data
}

// ---------------------------------------------------------------------
// Crear paciente
// ---------------------------------------------------------------------
export async function crearPaciente(formData: FormData): Promise<EstadoFormulario> {
  const resultado = pacienteSchema.safeParse(leerFormulario(formData))
  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa los campos marcados en rojo.", errores: resultado.error.flatten().fieldErrors }
  }

  const fila = prepararFila(resultado.data)

  const duplicado = await rutDuplicado(fila.rut)
  if (duplicado) {
    return {
      ok: false,
      mensaje: `Ya existe un paciente con ese RUT: ${duplicado.nombres} ${duplicado.apellidos}.`,
      errores: { rut: ["Este RUT ya está registrado"] },
    }
  }

  const { data, error } = await getSupabase().from("pacientes").insert(fila).select("id").single()

  if (error) {
    if (error.code === "23505") {
      return { ok: false, mensaje: "Ya existe un paciente con ese RUT.", errores: { rut: ["Este RUT ya está registrado"] } }
    }
    console.error("Error al crear paciente:", error)
    return { ok: false, mensaje: "No se pudo registrar el paciente. Intenta nuevamente." }
  }

  revalidatePath("/pacientes")
  return { ok: true, mensaje: "Paciente registrado correctamente.", pacienteId: data.id }
}

// ---------------------------------------------------------------------
// Editar paciente
// ---------------------------------------------------------------------
export async function actualizarPaciente(pacienteId: string, formData: FormData): Promise<EstadoFormulario> {
  const resultado = pacienteSchema.safeParse(leerFormulario(formData))
  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa los campos marcados en rojo.", errores: resultado.error.flatten().fieldErrors }
  }

  const fila = prepararFila(resultado.data)

  const duplicado = await rutDuplicado(fila.rut, pacienteId)
  if (duplicado) {
    return {
      ok: false,
      mensaje: `Ese RUT ya pertenece a otro paciente: ${duplicado.nombres} ${duplicado.apellidos}.`,
      errores: { rut: ["Este RUT ya está registrado"] },
    }
  }

  const { error } = await getSupabase().from("pacientes").update(fila).eq("id", pacienteId)

  if (error) {
    if (error.code === "23505") {
      return { ok: false, mensaje: "Ese RUT ya pertenece a otro paciente.", errores: { rut: ["Este RUT ya está registrado"] } }
    }
    console.error("Error al actualizar paciente:", error)
    return { ok: false, mensaje: "No se pudieron guardar los cambios. Intenta nuevamente." }
  }

  revalidatePath("/pacientes")
  revalidatePath(`/pacientes/${pacienteId}`, "layout")
  return { ok: true, mensaje: "Datos actualizados correctamente.", pacienteId }
}

// ---------------------------------------------------------------------
// Activar / desactivar paciente
// ---------------------------------------------------------------------
export async function cambiarEstadoPaciente(pacienteId: string, motivo?: string) {
  const supabase = getSupabase()

  const { data: paciente, error: errorLectura } = await supabase
    .from("pacientes")
    .select("activo")
    .eq("id", pacienteId)
    .single()

  if (errorLectura || !paciente) return { ok: false, mensaje: "Paciente no encontrado." }

  const nuevoEstado = !paciente.activo
  const { error } = await supabase
    .from("pacientes")
    .update({
      activo: nuevoEstado,
      motivo_deshabilitado: nuevoEstado ? null : motivo?.trim() || null,
    })
    .eq("id", pacienteId)

  if (error) {
    console.error("Error al cambiar estado:", error)
    return { ok: false, mensaje: "No se pudo cambiar el estado del paciente." }
  }

  revalidatePath("/pacientes")
  revalidatePath(`/pacientes/${pacienteId}`, "layout")
  return { ok: true, activo: nuevoEstado }
}

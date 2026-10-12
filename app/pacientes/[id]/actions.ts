"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { normalizarRut, validarRut } from "@/lib/validaciones"
import { hoyChile } from "@/lib/formato"
import { CATEGORIAS_ANTECEDENTE, type CategoriaAntecedente } from "@/types/antecedente"
import {
  BUCKET_ARCHIVOS,
  CATEGORIAS_ARCHIVO,
  TAMANO_MAXIMO_BYTES,
  TIPOS_PERMITIDOS,
  type CategoriaArchivo,
} from "@/types/archivo"

type Resultado = { ok: boolean; mensaje: string; errores?: Record<string, string> }

function refrescarFicha(pacienteId: string) {
  revalidatePath(`/pacientes/${pacienteId}`, "layout")
}

function texto(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "").trim()
}

async function pacienteActivo(pacienteId: string): Promise<boolean> {
  const { data } = await getSupabase().from("pacientes").select("activo").eq("id", pacienteId).maybeSingle()
  return !!data?.activo
}

export async function agregarAntecedente(pacienteId: string, formData: FormData): Promise<Resultado> {
  const usuario = await autorizar("antecedentes.registrar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const categoria = texto(formData, "categoria")
  const contenido = texto(formData, "contenido")

  if (!CATEGORIAS_ANTECEDENTE.includes(categoria as CategoriaAntecedente)) {
    return { ok: false, mensaje: "Selecciona una categoría." }
  }
  if (contenido.length < 3) return { ok: false, mensaje: "Describe el antecedente (mínimo 3 caracteres)." }
  if (contenido.length > 1000) return { ok: false, mensaje: "El antecedente admite máximo 1000 caracteres." }

  const { error } = await getSupabase().from("antecedentes").insert({ paciente_id: pacienteId, categoria, contenido, profesional_id: usuario.id })

  if (error) {
    console.error("Error al agregar antecedente:", error)
    return { ok: false, mensaje: "No se pudo registrar el antecedente." }
  }

  refrescarFicha(pacienteId)
  return { ok: true, mensaje: "Antecedente registrado." }
}

export async function darDeBajaAntecedente(antecedenteId: string, pacienteId: string, motivo: string): Promise<Resultado> {
  const usuario = await autorizar("antecedentes.registrar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  if (!motivo.trim()) return { ok: false, mensaje: "Indica el motivo de la baja." }

  const { error } = await getSupabase()
    .from("antecedentes")
    .update({ vigente: false, fecha_baja: new Date().toISOString(), motivo_baja: motivo.trim(), baja_por: usuario.id })
    .eq("id", antecedenteId)
    .eq("paciente_id", pacienteId)
    .eq("vigente", true)

  if (error) {
    console.error("Error al dar de baja antecedente:", error)
    return { ok: false, mensaje: "No se pudo dar de baja el antecedente." }
  }

  refrescarFicha(pacienteId)
  return { ok: true, mensaje: "Antecedente dado de baja." }
}

export async function crearEvolucion(pacienteId: string, formData: FormData): Promise<Resultado> {
  const usuario = await autorizar("evoluciones.crear")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const fila = {
    paciente_id: pacienteId,
    fecha_atencion: texto(formData, "fecha_atencion"),
    profesional_id: usuario.id,
    profesional_nombre: usuario.nombre_completo,
    motivo: texto(formData, "motivo") || null,
    diagnostico: texto(formData, "diagnostico") || null,
    procedimiento: texto(formData, "procedimiento"),
    observaciones: texto(formData, "observaciones") || null,
    indicaciones: texto(formData, "indicaciones") || null,
  }

  const errores: Record<string, string> = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fila.fecha_atencion)) errores.fecha_atencion = "Ingresa la fecha de atención"
  else if (fila.fecha_atencion > hoyChile()) errores.fecha_atencion = "La fecha no puede ser futura"
  if (fila.procedimiento.length < 3) errores.procedimiento = "Describe el procedimiento realizado"
  if (fila.procedimiento.length > 3000) errores.procedimiento = "Máximo 3000 caracteres"

  if (Object.keys(errores).length > 0) {
    return { ok: false, mensaje: "Revisa los campos marcados en rojo.", errores }
  }

  if (!(await pacienteActivo(pacienteId))) {
    return { ok: false, mensaje: "El paciente no existe o está deshabilitado." }
  }

  const { error } = await getSupabase().from("evoluciones").insert(fila)

  if (error) {
    console.error("Error al crear evolución:", error)
    return { ok: false, mensaje: "No se pudo guardar la evolución." }
  }

  refrescarFicha(pacienteId)
  return { ok: true, mensaje: "Evolución registrada." }
}

export async function subirArchivo(pacienteId: string, formData: FormData): Promise<Resultado> {
  const usuario = await autorizar("archivos.subir")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const archivo = formData.get("archivo")
  const categoria = texto(formData, "categoria")
  const titulo = texto(formData, "titulo")
  const descripcion = texto(formData, "descripcion") || null

  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, mensaje: "Selecciona un archivo." }
  if (archivo.size > TAMANO_MAXIMO_BYTES) return { ok: false, mensaje: "El archivo supera los 4 MB." }
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(archivo.type)) {
    return { ok: false, mensaje: "Formato no permitido. Usa JPG, PNG, WEBP o PDF." }
  }
  if (!CATEGORIAS_ARCHIVO.includes(categoria as CategoriaArchivo)) return { ok: false, mensaje: "Selecciona una categoría." }
  if (titulo.length < 2) return { ok: false, mensaje: "Ingresa un título para el archivo." }

  if (!(await pacienteActivo(pacienteId))) {
    return { ok: false, mensaje: "El paciente no existe o está deshabilitado." }
  }

  const supabase = getSupabase()
  const extension = archivo.name.split(".").pop()?.toLowerCase() || "bin"
  const ruta = `${pacienteId}/${crypto.randomUUID()}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_ARCHIVOS)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false })

  if (errorSubida) {
    console.error("Error al subir a Storage:", errorSubida)
    return { ok: false, mensaje: "No se pudo subir el archivo." }
  }

  const { error } = await supabase.from("archivos_paciente").insert({
    paciente_id: pacienteId,
    categoria,
    titulo,
    descripcion,
    ruta_storage: ruta,
    nombre_archivo: archivo.name,
    tipo_mime: archivo.type,
    tamano_bytes: archivo.size,
    subido_por: usuario.nombre_completo,
    subido_por_id: usuario.id,
  })

  if (error) {
    await supabase.storage.from(BUCKET_ARCHIVOS).remove([ruta])
    console.error("Error al registrar archivo:", error)
    return { ok: false, mensaje: "No se pudo registrar el archivo." }
  }

  refrescarFicha(pacienteId)
  return { ok: true, mensaje: "Archivo subido correctamente." }
}

export async function asignarTitular(pacienteId: string, rutTitular: string): Promise<Resultado> {
  const usuario = await autorizar("pacientes.editar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const entrada = rutTitular.trim()
  if (!entrada) return { ok: false, mensaje: "Ingresa el RUT del titular." }

  const rut = validarRut(entrada) ? normalizarRut(entrada) : entrada.toUpperCase()
  const supabase = getSupabase()

  const { data: titular } = await supabase
    .from("pacientes")
    .select("id, nombres, apellidos, titular_id, activo")
    .eq("rut", rut)
    .maybeSingle()

  if (!titular) return { ok: false, mensaje: "No existe un paciente con ese RUT. Regístralo primero." }
  if (titular.id === pacienteId) return { ok: false, mensaje: "Un paciente no puede ser su propio titular." }
  if (titular.titular_id) return { ok: false, mensaje: `${titular.nombres} ${titular.apellidos} ya es carga de otro titular.` }
  if (!titular.activo) return { ok: false, mensaje: "El titular está deshabilitado." }

  const { count } = await supabase
    .from("pacientes")
    .select("id", { count: "exact", head: true })
    .eq("titular_id", pacienteId)

  if ((count ?? 0) > 0) {
    return { ok: false, mensaje: "Este paciente tiene cargas a su nombre, por lo que no puede ser carga de otro." }
  }

  const { error } = await supabase.from("pacientes").update({ titular_id: titular.id, modificado_por: usuario.id }).eq("id", pacienteId)

  if (error) {
    console.error("Error al asignar titular:", error)
    return { ok: false, mensaje: "No se pudo asignar el titular." }
  }

  refrescarFicha(pacienteId)
  refrescarFicha(titular.id)
  return { ok: true, mensaje: `Asignado como carga de ${titular.nombres} ${titular.apellidos}.` }
}

export async function quitarTitular(pacienteId: string, titularId: string): Promise<Resultado> {
  const usuario = await autorizar("pacientes.editar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const { error } = await getSupabase().from("pacientes").update({ titular_id: null, modificado_por: usuario.id }).eq("id", pacienteId)

  if (error) {
    console.error("Error al quitar titular:", error)
    return { ok: false, mensaje: "No se pudo quitar el titular." }
  }

  refrescarFicha(pacienteId)
  refrescarFicha(titularId)
  return { ok: true, mensaje: "Titular desvinculado." }
}

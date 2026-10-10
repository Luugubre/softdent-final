"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { hoyChile } from "@/lib/formato"
import { TIPOS_ARANCEL } from "@/types/prestacion"

export type Resultado = { ok: boolean; mensaje: string; errores?: Record<string, string>; id?: string }

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim()
}

function refrescar(prestacionId?: string) {
  revalidatePath("/prestaciones")
  if (prestacionId) revalidatePath(`/prestaciones/${prestacionId}`)
}

/** Convierte "15.000" o "$15000" en 15000 */
function leerPesos(valor: string): number | null {
  const limpio = valor.replace(/[^\d]/g, "")
  return limpio ? Number(limpio) : null
}

/** Traduce errores de duplicados de la BD a mensajes por campo */
function erroresDuplicado(mensaje: string): Record<string, string> | null {
  if (mensaje.includes("prestaciones_codigo_interno_key")) return { codigo_interno: "Ya existe una prestación con este código" }
  if (mensaje.includes("prestaciones_codigo_fonasa_key")) return { codigo_fonasa: "Este código FONASA ya está asignado a otra prestación" }
  if (mensaje.includes("prestaciones_nombre_especialidad_key"))
    return { nombre: "Ya existe una prestación con este nombre en la misma especialidad" }
  return null
}

// =====================================================================
// PRESTACIONES
// =====================================================================

const prestacionSchema = z.object({
  codigo_interno: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, "Usa 2 a 20 letras, números o guiones (ej: OP-001)"),
  codigo_fonasa: z
    .string()
    .trim()
    .regex(/^\d{7}$/, "El código FONASA tiene 7 dígitos")
    .optional(),
  nombre: z.string().trim().min(3, "Ingresa el nombre").max(120, "Máximo 120 caracteres"),
  categoria_id: z.string().uuid("Selecciona una categoría"),
  especialidad_id: z.string().uuid().optional(),
  duracion_min: z.coerce
    .number({ message: "Ingresa la duración" })
    .int()
    .min(5, "Mínimo 5 minutos")
    .max(480, "Máximo 8 horas")
    .refine((n) => n % 5 === 0, "Usa múltiplos de 5 minutos"),
  descripcion: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
  icono: z.string().regex(/^[a-z_]{2,30}$/, "Ícono inválido").optional(),
})

function leerPrestacion(formData: FormData) {
  const datos: Record<string, string> = {}
  for (const campo of ["codigo_interno", "codigo_fonasa", "nombre", "categoria_id", "especialidad_id", "duracion_min", "descripcion", "icono"]) {
    const valor = texto(formData, campo)
    if (valor) datos[campo] = valor
  }
  return prestacionSchema.safeParse(datos)
}

function erroresZod(error: z.ZodError): Record<string, string> {
  const errores: Record<string, string> = {}
  for (const issue of error.issues) {
    const campo = String(issue.path[0])
    errores[campo] ??= issue.message
  }
  return errores
}

export async function crearPrestacion(formData: FormData): Promise<Resultado> {
  const usuario = await autorizar("prestaciones.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const resultado = leerPrestacion(formData)
  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa los campos marcados.", errores: erroresZod(resultado.error) }
  }

  const supabase = getSupabase()

  // Precios iniciales: el del arancel base es obligatorio
  const { data: aranceles } = await supabase.from("aranceles").select("id, es_base").eq("activo", true)
  const precios: { arancel_id: string; precio: number }[] = []
  const errores: Record<string, string> = {}

  for (const a of aranceles ?? []) {
    const precio = leerPesos(texto(formData, `precio_${a.id}`))
    if (precio === null) {
      if (a.es_base) errores[`precio_${a.id}`] = "El precio del arancel base es obligatorio"
      continue
    }
    if (precio <= 0) errores[`precio_${a.id}`] = "Debe ser mayor a cero"
    else precios.push({ arancel_id: a.id, precio })
  }
  if (Object.keys(errores).length > 0) return { ok: false, mensaje: "Revisa los precios.", errores }

  // 1) Crear la prestación
  const { data, error } = await supabase
    .from("prestaciones")
    .insert({ ...resultado.data, creado_por: usuario.id })
    .select("id")
    .single()

  if (error) {
    const dup = erroresDuplicado(error.message)
    if (dup) return { ok: false, mensaje: "Hay datos duplicados.", errores: dup }
    console.error("Error al crear prestación:", error)
    return { ok: false, mensaje: "No se pudo crear la prestación." }
  }

  // 2) Registrar los precios desde hoy
  for (const p of precios) {
    const { error: errorPrecio } = await supabase.rpc("fijar_precio", {
      p_prestacion_id: data.id,
      p_arancel_id: p.arancel_id,
      p_precio: p.precio,
      p_desde: hoyChile(),
      p_usuario_id: usuario.id,
      p_motivo: "Precio inicial",
    })
    if (errorPrecio) {
      console.error("Error al fijar precio inicial:", errorPrecio)
      return {
        ok: false,
        mensaje: "La prestación se creó, pero no se pudo guardar uno de sus precios. Revísalo en su ficha.",
        id: data.id,
      }
    }
  }

  refrescar()
  return { ok: true, mensaje: "Prestación creada.", id: data.id }
}

export async function actualizarPrestacion(prestacionId: string, formData: FormData): Promise<Resultado> {
  if (!(await autorizar("prestaciones.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const resultado = leerPrestacion(formData)
  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa los campos marcados.", errores: erroresZod(resultado.error) }
  }

  const d = resultado.data
  const { error } = await getSupabase()
    .from("prestaciones")
    .update({
      ...d,
      codigo_fonasa: d.codigo_fonasa ?? null,
      especialidad_id: d.especialidad_id ?? null,
      descripcion: d.descripcion ?? null,
      icono: d.icono ?? null,
    })
    .eq("id", prestacionId)

  if (error) {
    const dup = erroresDuplicado(error.message)
    if (dup) return { ok: false, mensaje: "Hay datos duplicados.", errores: dup }
    console.error("Error al actualizar prestación:", error)
    return { ok: false, mensaje: "No se pudieron guardar los cambios." }
  }

  refrescar(prestacionId)
  return { ok: true, mensaje: "Prestación actualizada." }
}

export async function cambiarEstadoPrestacion(prestacionId: string): Promise<Resultado> {
  if (!(await autorizar("prestaciones.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const supabase = getSupabase()
  const { data } = await supabase.from("prestaciones").select("activo").eq("id", prestacionId).maybeSingle()
  if (!data) return { ok: false, mensaje: "Prestación no encontrada." }

  const { error } = await supabase.from("prestaciones").update({ activo: !data.activo }).eq("id", prestacionId)
  if (error) return { ok: false, mensaje: "No se pudo cambiar el estado." }

  refrescar(prestacionId)
  return { ok: true, mensaje: data.activo ? "Prestación desactivada." : "Prestación activada." }
}

// =====================================================================
// PRECIOS
// =====================================================================

export async function fijarPrecio(prestacionId: string, arancelId: string, formData: FormData): Promise<Resultado> {
  const usuario = await autorizar("prestaciones.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const precio = leerPesos(texto(formData, "precio"))
  const desde = texto(formData, "vigente_desde")
  const motivo = texto(formData, "motivo")

  if (!precio || precio <= 0) return { ok: false, mensaje: "Ingresa un precio mayor a cero." }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return { ok: false, mensaje: "Ingresa la fecha de inicio." }
  if (desde < hoyChile()) return { ok: false, mensaje: "No se permiten cambios de precio retroactivos." }

  const { error } = await getSupabase().rpc("fijar_precio", {
    p_prestacion_id: prestacionId,
    p_arancel_id: arancelId,
    p_precio: precio,
    p_desde: desde,
    p_usuario_id: usuario.id,
    p_motivo: motivo || null,
  })

  if (error) {
    if (error.code === "23P01") return { ok: false, mensaje: "Ese período se solapa con otro precio ya registrado." }
    // Los mensajes de fijar_precio ya vienen en español
    return { ok: false, mensaje: error.message || "No se pudo registrar el precio." }
  }

  refrescar(prestacionId)
  return { ok: true, mensaje: "Precio registrado." }
}

// =====================================================================
// PROFESIONALES HABILITADOS
// =====================================================================

export async function guardarProfesionales(prestacionId: string, profesionalIds: string[]): Promise<Resultado> {
  if (!(await autorizar("prestaciones.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const supabase = getSupabase()

  // Solo se aceptan dentistas activos
  const { data: validos } = await supabase
    .from("perfiles")
    .select("id")
    .in("id", profesionalIds.length ? profesionalIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("rol", "DENTISTA")
    .eq("activo", true)
  const ids = (validos ?? []).map((v) => v.id)

  const { error: errorBorrar } = await supabase.from("prestacion_profesionales").delete().eq("prestacion_id", prestacionId)
  if (errorBorrar) return { ok: false, mensaje: "No se pudieron guardar los profesionales." }

  if (ids.length > 0) {
    const { error } = await supabase
      .from("prestacion_profesionales")
      .insert(ids.map((id) => ({ prestacion_id: prestacionId, profesional_id: id })))
    if (error) return { ok: false, mensaje: "No se pudieron guardar los profesionales." }
  }

  refrescar(prestacionId)
  return { ok: true, mensaje: ids.length ? "Profesionales habilitados actualizados." : "Ahora todos los dentistas pueden realizarla." }
}

// =====================================================================
// CONFIGURACIÓN: aranceles, categorías y especialidades
// =====================================================================

export async function crearArancel(formData: FormData): Promise<Resultado> {
  if (!(await autorizar("prestaciones.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const nombre = texto(formData, "nombre")
  const tipo = texto(formData, "tipo")
  const descripcion = texto(formData, "descripcion") || null
  const porcentaje = Number(texto(formData, "porcentaje_descuento").replace(",", ".") || 0)

  if (nombre.length < 2) return { ok: false, mensaje: "Ingresa el nombre del arancel." }
  if (!TIPOS_ARANCEL.includes(tipo as (typeof TIPOS_ARANCEL)[number])) return { ok: false, mensaje: "Selecciona el tipo." }
  if (Number.isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    return { ok: false, mensaje: "El descuento debe estar entre 0 y 100%." }
  }
  if (tipo !== "CONVENIO" && porcentaje > 0) {
    return { ok: false, mensaje: "Solo los convenios pueden tener descuento automático." }
  }

  const { error } = await getSupabase()
    .from("aranceles")
    .insert({ nombre, tipo, descripcion, porcentaje_descuento: porcentaje })

  if (error) {
    if (error.code === "23505") return { ok: false, mensaje: "Ya existe un arancel con ese nombre." }
    return { ok: false, mensaje: "No se pudo crear el arancel." }
  }

  revalidatePath("/prestaciones", "layout")
  return { ok: true, mensaje: "Arancel creado." }
}

export async function cambiarEstadoArancel(arancelId: string): Promise<Resultado> {
  if (!(await autorizar("prestaciones.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const supabase = getSupabase()
  const { data } = await supabase.from("aranceles").select("activo, es_base").eq("id", arancelId).maybeSingle()
  if (!data) return { ok: false, mensaje: "Arancel no encontrado." }
  if (data.es_base) return { ok: false, mensaje: "El arancel base no se puede desactivar." }

  const { error } = await supabase.from("aranceles").update({ activo: !data.activo }).eq("id", arancelId)
  if (error) return { ok: false, mensaje: "No se pudo cambiar el estado." }

  revalidatePath("/prestaciones", "layout")
  return { ok: true, mensaje: data.activo ? "Arancel desactivado." : "Arancel activado." }
}

const CATALOGOS = {
  categoria: "categorias_prestaciones",
  especialidad: "especialidades",
} as const
type Catalogo = keyof typeof CATALOGOS

export async function crearItemCatalogo(catalogo: Catalogo, nombre: string): Promise<Resultado> {
  if (!(await autorizar("prestaciones.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const tabla = CATALOGOS[catalogo]
  if (!tabla) return { ok: false, mensaje: "Catálogo inválido." }
  if (nombre.trim().length < 2) return { ok: false, mensaje: "Ingresa un nombre." }

  const { error } = await getSupabase().from(tabla).insert({ nombre: nombre.trim() })
  if (error) {
    if (error.code === "23505") return { ok: false, mensaje: "Ya existe con ese nombre." }
    return { ok: false, mensaje: "No se pudo crear." }
  }

  revalidatePath("/prestaciones", "layout")
  return { ok: true, mensaje: "Creado." }
}

export async function cambiarEstadoItemCatalogo(catalogo: Catalogo, id: string): Promise<Resultado> {
  if (!(await autorizar("prestaciones.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const tabla = CATALOGOS[catalogo]
  if (!tabla) return { ok: false, mensaje: "Catálogo inválido." }

  const supabase = getSupabase()
  const { data } = await supabase.from(tabla).select("activo").eq("id", id).maybeSingle()
  if (!data) return { ok: false, mensaje: "No encontrado." }

  const { error } = await supabase.from(tabla).update({ activo: !data.activo }).eq("id", id)
  if (error) return { ok: false, mensaje: "No se pudo cambiar el estado." }

  revalidatePath("/prestaciones", "layout")
  return { ok: true, mensaje: "Actualizado." }
}

"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"

const UUID = /^[0-9a-f-]{36}$/i
const packSchema = z.object({
  id: z.string().regex(UUID).optional(),
  nombre: z.string().trim().min(3, "Ingresa un nombre de al menos 3 caracteres para el pack.").max(120, "Nombre: máximo 120 caracteres."),
  descripcion: z.string().trim().max(500, "Descripción: máximo 500 caracteres.").default(""),
  items: z
    .array(
      z.object({
        prestacion_id: z.string().regex(UUID, "Prestación no válida."),
        cantidad: z.coerce.number().int().min(1).max(32),
        precio_pack: z.coerce.number().int().min(0).max(100_000_000).nullable(),
        nota: z.string().trim().max(200, "Nota: máximo 200 caracteres.").default(""),
      })
    )
    .min(1, "Agrega al menos una prestación al pack.")
    .max(50, "Máximo 50 prestaciones por pack."),
})

export type ItemPackInput = {
  prestacion_id: string
  cantidad: number
  precio_pack: number | null
  nota: string
}

export async function guardarPackPrestaciones(payload: {
  id?: string
  nombre: string
  descripcion: string
  items: ItemPackInput[]
}) {
  const usuario = await autorizar("prestaciones.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const validacion = packSchema.safeParse(payload)
  if (!validacion.success) return { ok: false, mensaje: validacion.error.issues[0].message }
  payload = validacion.data

  const supabase = getSupabase()
  let packId = payload.id

  if (packId) {
    const { error } = await supabase
      .from("plantillas_prestaciones")
      .update({
        nombre: payload.nombre.trim(),
        descripcion: payload.descripcion.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", packId)

    if (error) return { ok: false, mensaje: "No se pudo actualizar el pack." }

    await supabase.from("plantilla_prestacion_items").delete().eq("plantilla_id", packId)
  } else {
    const { data, error } = await supabase
      .from("plantillas_prestaciones")
      .insert({
        nombre: payload.nombre.trim(),
        descripcion: payload.descripcion.trim() || null,
        activo: true,
        creado_por: usuario.id,
      })
      .select("id")
      .single()

    if (error || !data) return { ok: false, mensaje: "No se pudo crear el pack." }
    packId = data.id
  }

  const filasItems = payload.items.map((it, idx) => ({
    plantilla_id: packId,
    prestacion_id: it.prestacion_id,
    cantidad: Math.max(1, Math.min(32, Number(it.cantidad) || 1)),
    precio_pack: it.precio_pack && it.precio_pack > 0 ? Math.round(it.precio_pack) : null,
    nota: it.nota.trim() || null,
    orden: idx + 1,
  }))

  const { error: errItems } = await supabase.from("plantilla_prestacion_items").insert(filasItems)
  if (errItems) return { ok: false, mensaje: "Pack guardado, pero falló el detalle de prestaciones." }

  revalidatePath("/prestaciones/packs")
  return { ok: true, mensaje: payload.id ? "Pack actualizado correctamente." : "Pack creado correctamente." }
}

export async function cambiarEstadoPack(packId: string) {
  const usuario = await autorizar("prestaciones.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!UUID.test(packId ?? "")) return { ok: false, mensaje: "Pack no encontrado." }

  const supabase = getSupabase()
  const { data } = await supabase
    .from("plantillas_prestaciones")
    .select("activo")
    .eq("id", packId)
    .maybeSingle()

  if (!data) return { ok: false, mensaje: "Pack no encontrado." }

  const { error } = await supabase
    .from("plantillas_prestaciones")
    .update({ activo: !data.activo, updated_at: new Date().toISOString() })
    .eq("id", packId)

  if (error) return { ok: false, mensaje: "No se pudo cambiar el estado del pack." }

  revalidatePath("/prestaciones/packs")
  return { ok: true, mensaje: data.activo ? "Pack desactivado." : "Pack activado." }
}
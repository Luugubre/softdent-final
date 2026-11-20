"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"

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

  if (payload.nombre.trim().length < 3) {
    return { ok: false, mensaje: "Ingresa un nombre de al menos 3 caracteres para el pack." }
  }
  if (!payload.items || payload.items.length === 0) {
    return { ok: false, mensaje: "Agrega al menos una prestación al pack." }
  }

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
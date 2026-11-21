"use server"

import { revalidatePath } from "next/cache"
import { autorizar } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { anulacionRecetaSchema, recetaSchema, type RecetaFormData } from "@/lib/validaciones"

type Resultado = { error?: string; recetaId?: string; folio?: number; ok?: boolean }

// Emite la receta con la función SQL emitir_receta (receta, ítems y folio en una transacción).
export async function emitirReceta(payload: RecetaFormData): Promise<Resultado> {
  const usuario = await autorizar("recetas.emitir")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }

  const datos = recetaSchema.safeParse(payload)
  if (!datos.success) return { error: datos.error.issues[0].message }
  const { paciente_id, profesional_id, diagnostico, indicaciones_generales, items } = datos.data

  // El dentista emite a su nombre; el administrador elige el dentista
  const profesional = usuario.rol === "DENTISTA" ? usuario.id : profesional_id
  if (!profesional) return { error: "Selecciona el dentista que emite la receta." }

  const { data, error } = await getSupabase().rpc("emitir_receta", {
    p_paciente: paciente_id,
    p_profesional: profesional,
    p_diagnostico: diagnostico,
    p_indicaciones: indicaciones_generales ?? null,
    p_items: items,
    p_usuario: usuario.id,
  })

  if (error) return { error: error.message }
  const fila = Array.isArray(data) ? data[0] : data
  if (!fila) return { error: "No se pudo emitir la receta." }

  revalidatePath("/recetas")
  revalidatePath(`/pacientes/${paciente_id}/recetas`)
  revalidatePath(`/pacientes/${paciente_id}`)
  return { recetaId: fila.receta_id, folio: fila.folio }
}

// Anula la receta registrando el motivo (la función SQL valida la autoría).
export async function anularReceta(recetaId: string, motivo: string): Promise<Resultado> {
  const usuario = await autorizar("recetas.anular")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }

  const datos = anulacionRecetaSchema.safeParse({ receta_id: recetaId, motivo })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const { error } = await getSupabase().rpc("anular_receta", {
    p_receta: datos.data.receta_id,
    p_usuario: usuario.id,
    p_motivo: datos.data.motivo,
  })
  if (error) return { error: error.message }

  revalidatePath("/recetas")
  revalidatePath("/pacientes/[id]/recetas", "page")
  revalidatePath("/pacientes/[id]", "layout")
  return { ok: true }
}

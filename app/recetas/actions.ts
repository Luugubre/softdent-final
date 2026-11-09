"use server"

import { crearClienteAuth } from "@/lib/supabase-auth"
import { requerirUsuario } from "@/lib/auth"

type ItemRecetaPayload = {
  medicamento: string
  presentacion: string
  dosis: string
  frecuencia: string
  duracion: string
  via: string
  cantidad: string
}

type EmitirRecetaPayload = {
  paciente_id: string
  profesional_id?: string
  diagnostico: string
  indicaciones_generales?: string
  items: ItemRecetaPayload[]
}

// 1. Server Action para emitir una nueva receta
export async function emitirReceta(payload: EmitirRecetaPayload) {
  try {
    const usuario = await requerirUsuario()
    const supabase = await crearClienteAuth()

    const profesionalIdFinal = payload.profesional_id || usuario.id

    if (!profesionalIdFinal) {
      return { error: "Debes especificar el dentista emisor de la receta." }
    }

    // Obtener correlativo para el folio
    const { count } = await supabase
      .from("recetas")
      .select("*", { count: "exact", head: true })

    const nuevoFolio = (count ?? 0) + 1

    // Insertar cabecera de la receta
    const { data: receta, error: errReceta } = await supabase
      .from("recetas")
      .insert({
        folio: nuevoFolio,
        paciente_id: payload.paciente_id,
        profesional_id: profesionalIdFinal,
        diagnostico: payload.diagnostico,
        indicaciones_generales: payload.indicaciones_generales || null,
        estado: "EMITIDA",
      })
      .select("id")
      .single()

    if (errReceta || !receta) {
      console.error("Error insertando receta:", errReceta)
      return { error: "Error al guardar la receta en la base de datos." }
    }

    // Insertar items prescritos
    const itemsAInsertar = payload.items.map((it) => ({
      receta_id: receta.id,
      medicamento: it.medicamento,
      presentacion: it.presentacion,
      dosis: it.dosis,
      frecuencia: it.frecuencia,
      duracion: it.duracion,
      via: it.via,
      cantidad: it.cantidad,
    }))

    const { error: errItems } = await supabase
      .from("receta_items")
      .insert(itemsAInsertar)

    if (errItems) {
      console.error("Error insertando items de receta:", errItems)
      return { error: "Receta creada pero ocurrió un error al asociar los medicamentos." }
    }

    return { recetaId: receta.id, folio: nuevoFolio }
  } catch (e: unknown) {
    console.error("Error en emitirReceta:", e)
    const errMessage = e instanceof Error ? e.message : "Ocurrió un error inesperado al emitir la receta."
    return { error: errMessage }
  }
}

// 2. Server Action para anular una receta existente
export async function anularReceta(recetaId: string) {
  try {
    await requerirUsuario()
    const supabase = await crearClienteAuth()

    const { error } = await supabase
      .from("recetas")
      .update({ estado: "ANULADA" })
      .eq("id", recetaId)

    if (error) {
      console.error("Error al anular receta:", error)
      return { error: "No se pudo anular la receta." }
    }

    return { success: true }
  } catch (e: unknown) {
    console.error("Error en anularReceta:", e)
    const errMessage = e instanceof Error ? e.message : "Ocurrió un error inesperado al anular la receta."
    return { error: errMessage }
  }
}
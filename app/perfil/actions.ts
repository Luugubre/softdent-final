"use server"

import { revalidatePath } from "next/cache"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { perfilUsuarioSchema, cambioPasswordSchema } from "@/lib/validaciones"

export async function actualizarPerfil(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await crearClienteAuth()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Sesión no válida" }

  const rawData = {
    nombres: String(formData.get("nombres") ?? ""),
    apellidos: String(formData.get("apellidos") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    firma_svg: String(formData.get("firma_svg") ?? ""),
    preferencias: {
      notificaciones_email: formData.get("notificaciones_email") === "true",
      tema: String(formData.get("tema") ?? "light"),
    },
  }

  const validacion = perfilUsuarioSchema.safeParse(rawData)
  if (!validacion.success) {
    return { error: validacion.error.issues[0].message }
  }

  const nombreCompleto = `${validacion.data.nombres} ${validacion.data.apellidos}`.trim()

  const { data, error } = await supabase
    .from("perfiles")
    .update({
      nombre_completo: nombreCompleto,
      telefono: validacion.data.telefono,
      firma_svg: validacion.data.firma_svg,
      preferencias: validacion.data.preferencias,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()

  if (error) {
    console.error("Error exacto de Supabase:", error)
    return { error: `Error DB (${error.code}): ${error.message}` }
  }

  if (!data || data.length === 0) {
    return { error: "No se pudo actualizar el registro. Revisa las políticas RLS en Supabase." }
  }

  revalidatePath("/perfil")
  return { ok: true }
}

export async function cambiarPassword(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const rawData = {
    password_actual: String(formData.get("password_actual") ?? ""),
    nueva_password: String(formData.get("nueva_password") ?? ""),
    confirmar_password: String(formData.get("confirmar_password") ?? ""),
  }

  const validacion = cambioPasswordSchema.safeParse(rawData)
  if (!validacion.success) {
    return { error: validacion.error.issues[0].message }
  }

  const supabaseAuth = await crearClienteAuth()
  const { error } = await supabaseAuth.auth.updateUser({
    password: validacion.data.nueva_password,
  })

  if (error) return { error: "No se pudo actualizar la contraseña. Revisa tus credenciales." }

  return { ok: true }
}
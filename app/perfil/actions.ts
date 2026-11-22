"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import { requerirUsuario } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { puede } from "@/lib/permisos"
import { normalizarFirmaSvg } from "@/lib/firma"
import { registrarCambio } from "@/lib/registro-auditoria"
import { perfilUsuarioSchema, cambioPasswordSchema } from "@/lib/validaciones"

export async function actualizarPerfil(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const usuario = await requerirUsuario()

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

  const cambios: Record<string, unknown> = {
    nombre_completo: `${validacion.data.nombres} ${validacion.data.apellidos}`.trim(),
    telefono: validacion.data.telefono || null,
    preferencias: validacion.data.preferencias,
  }

  // Firma normalizada, solo para roles que firman
  if (puede(usuario.rol, "firma.propia")) {
    const firmaEnviada = validacion.data.firma_svg?.trim() ?? ""
    const firma = firmaEnviada ? normalizarFirmaSvg(firmaEnviada) : null
    if (firmaEnviada && !firma) return { error: "La firma no es válida. Límpiala y dibújala de nuevo." }
    if (firma) cambios.firma_svg = firma
  }

  const { data: antes } = await getSupabase()
    .from("perfiles")
    .select("nombre_completo, telefono, firma_svg")
    .eq("id", usuario.id)
    .maybeSingle()

  // Solo columnas editables por el propio usuario
  const { error } = await getSupabase().from("perfiles").update(cambios).eq("id", usuario.id)
  if (error) return { error: "No se pudo guardar el perfil." }

  // Auditoría: datos cambiados; la firma se registra como evento, sin guardar su imagen
  const anterior: Record<string, unknown> = {}
  const nuevo: Record<string, unknown> = {}
  if (antes && antes.nombre_completo !== cambios.nombre_completo) {
    anterior.nombre_completo = antes.nombre_completo
    nuevo.nombre_completo = cambios.nombre_completo
  }
  if (antes && (antes.telefono ?? null) !== (cambios.telefono ?? null)) {
    anterior.telefono = antes.telefono
    nuevo.telefono = cambios.telefono
  }
  if (antes && cambios.firma_svg && antes.firma_svg !== cambios.firma_svg) {
    anterior.firma = antes.firma_svg ? "Firma registrada" : "Sin firma"
    nuevo.firma = "Firma actualizada"
  }
  if (Object.keys(nuevo).length > 0) {
    await registrarCambio({
      tabla: "perfiles",
      registroId: usuario.id,
      accion: "MODIFICADO",
      anterior: { nombre: usuario.nombre_completo, ...anterior },
      nuevo: { nombre: cambios.nombre_completo, ...nuevo },
      usuarioId: usuario.id,
    })
  }

  revalidatePath("/perfil")
  return { ok: true }
}

export async function cambiarPassword(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const usuario = await requerirUsuario()

  const rawData = {
    password_actual: String(formData.get("password_actual") ?? ""),
    nueva_password: String(formData.get("nueva_password") ?? ""),
    confirmar_password: String(formData.get("confirmar_password") ?? ""),
  }

  const validacion = cambioPasswordSchema.safeParse(rawData)
  if (!validacion.success) {
    return { error: validacion.error.issues[0].message }
  }

  // Verifica la contraseña actual sin alterar la sesión
  const verificador = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: errActual } = await verificador.auth.signInWithPassword({
    email: usuario.email,
    password: validacion.data.password_actual,
  })
  if (errActual) return { error: "La contraseña actual no es correcta." }
  await verificador.auth.signOut({ scope: "local" })

  const supabase = await crearClienteAuth()
  const { error } = await supabase.auth.updateUser({ password: validacion.data.nueva_password })
  if (error) return { error: "No se pudo actualizar la contraseña." }

  // Cierra las demás sesiones
  await supabase.auth.signOut({ scope: "others" })

  return { ok: true }
}

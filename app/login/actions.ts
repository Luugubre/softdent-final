"use server"

import { redirect } from "next/navigation"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { getSupabase } from "@/lib/supabase"
import { rutaSegura } from "@/lib/rutas"

// Bloqueo temporal por intentos fallidos
const MAX_INTENTOS = 3
const MINUTOS_BLOQUEO = 1

export async function iniciarSesion(formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "")

  if (!email || !password) return { error: "Ingresa tu correo y contraseña." }

  const db = await getSupabase()

  // Cuenta bloqueada
  const { data: perfilExistente } = await db
    .from("perfiles")
    .select("id, activo, intentos_fallidos, bloqueado_hasta")
    .eq("email", email)
    .maybeSingle()

  if (perfilExistente) {
    if (!perfilExistente.activo) {
      return { error: "Tu usuario no está habilitado en el sistema. Contacta al administrador." }
    }

    if (perfilExistente.bloqueado_hasta && new Date(perfilExistente.bloqueado_hasta) > new Date()) {
      const segundosRestantes = Math.ceil(
        (new Date(perfilExistente.bloqueado_hasta).getTime() - Date.now()) / 1000
      )
      const minutosRestantes = Math.ceil(segundosRestantes / 60)
      return {
        error: `Cuenta bloqueada temporalmente por exceso de intentos. Inténtalo nuevamente en ${minutosRestantes} minuto(s).`,
      }
    }
  }

  // Autenticación
  const supabase = await crearClienteAuth()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  // Credenciales incorrectas: suma un intento
  if (error || !data.user) {
    if (perfilExistente) {
      const nuevosIntentos = (perfilExistente.intentos_fallidos || 0) + 1
      let bloqueadoHasta: string | null = null

      if (nuevosIntentos >= MAX_INTENTOS) {
        bloqueadoHasta = new Date(Date.now() + MINUTOS_BLOQUEO * 60 * 1000).toISOString()
      }

      await db
        .from("perfiles")
        .update({
          intentos_fallidos: nuevosIntentos >= MAX_INTENTOS ? 0 : nuevosIntentos,
          bloqueado_hasta: bloqueadoHasta,
        })
        .eq("id", perfilExistente.id)

      const restantes = MAX_INTENTOS - nuevosIntentos
      if (restantes <= 0) {
        return {
          error: `Has superado el límite de intentos. Tu cuenta ha sido bloqueada temporalmente por ${MINUTOS_BLOQUEO} minuto.`,
        }
      }

      return {
        error: `Correo o contraseña incorrectos. Te quedan ${restantes} intento(s).`,
      }
    }

    return { error: "Correo o contraseña incorrectos." }
  }

  // Perfil activo
  const { data: perfil } = await db
    .from("perfiles")
    .select("activo")
    .eq("id", data.user.id)
    .maybeSingle()

  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut()
    return { error: "Tu usuario no está habilitado en el sistema. Contacta al administrador." }
  }

  // Reinicia el contador de intentos
  await db
    .from("perfiles")
    .update({ intentos_fallidos: 0, bloqueado_hasta: null })
    .eq("id", data.user.id)

  redirect(rutaSegura(next))
}

export async function cerrarSesion() {
  const supabase = await crearClienteAuth()
  await supabase.auth.signOut()
  redirect("/login")
}
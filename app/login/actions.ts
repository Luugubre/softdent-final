"use server"

import { redirect } from "next/navigation"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { getSupabase } from "@/lib/supabase"

export async function iniciarSesion(formData: FormData): Promise<{ error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "")

  if (!email || !password) return { error: "Ingresa tu correo y contraseña." }

  const supabase = await crearClienteAuth()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos." }
  }

  // Debe tener perfil activo en el sistema
  const { data: perfil } = await getSupabase()
    .from("perfiles")
    .select("activo")
    .eq("id", data.user.id)
    .maybeSingle()

  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut()
    return { error: "Tu usuario no está habilitado en el sistema. Contacta al administrador." }
  }

  // Solo se permite volver a rutas internas
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/pacientes")
}

export async function cerrarSesion() {
  const supabase = await crearClienteAuth()
  await supabase.auth.signOut()
  redirect("/login")
}

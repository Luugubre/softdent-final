import { cache } from "react"
import { redirect } from "next/navigation"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { getSupabase } from "@/lib/supabase"
import { puede, type Permiso } from "@/lib/permisos"
import type { Perfil } from "@/types/perfil"

/**
 * Usuario que inició sesión, con su perfil y rol.
 * Devuelve null si no hay sesión, si no tiene perfil o si está desactivado.
 */
export const obtenerUsuarioActual = cache(async (): Promise<Perfil | null> => {
  const supabase = await crearClienteAuth()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await getSupabase().from("perfiles").select("*").eq("id", user.id).maybeSingle()
  if (!data || !data.activo) return null
  return data as Perfil
})

/** Para páginas: exige sesión iniciada con un perfil activo */
export async function requerirUsuario(): Promise<Perfil> {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) {
    // Si hay sesión pero no hay perfil activo, NO se manda a /login
    // (el proxy lo devolvería aquí y quedaría en un bucle)
    const supabase = await crearClienteAuth()
    const { data } = await supabase.auth.getUser()
    redirect(data.user ? "/sin-acceso" : "/login")
  }
  return usuario
}

/** Para páginas: exige un permiso (si no lo tiene, muestra "sin permiso") */
export async function requerirPermiso(permiso: Permiso): Promise<Perfil> {
  const usuario = await requerirUsuario()
  if (!puede(usuario.rol, permiso)) redirect("/sin-permiso")
  return usuario
}

/** Para Server Actions: devuelve el usuario si tiene el permiso, o null */
export async function autorizar(permiso: Permiso): Promise<Perfil | null> {
  const usuario = await obtenerUsuarioActual()
  return usuario && puede(usuario.rol, permiso) ? usuario : null
}

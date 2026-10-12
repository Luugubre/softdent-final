import { cache } from "react"
import { redirect } from "next/navigation"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { getSupabase } from "@/lib/supabase"
import { puede, type Permiso } from "@/lib/permisos"
import type { Perfil } from "@/types/perfil"

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

export async function requerirUsuario(): Promise<Perfil> {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) {
    const supabase = await crearClienteAuth()
    const { data } = await supabase.auth.getUser()
    redirect(data.user ? "/sin-acceso" : "/login")
  }
  return usuario
}

export async function requerirPermiso(permiso: Permiso): Promise<Perfil> {
  const usuario = await requerirUsuario()
  if (!puede(usuario.rol, permiso)) redirect("/sin-permiso")
  return usuario
}

export async function autorizar(permiso: Permiso): Promise<Perfil | null> {
  const usuario = await obtenerUsuarioActual()
  return usuario && puede(usuario.rol, permiso) ? usuario : null
}

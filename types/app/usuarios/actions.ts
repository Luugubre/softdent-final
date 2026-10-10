"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO, ROLES, type Rol } from "@/lib/permisos"
import { normalizarRut, validarRut } from "@/lib/validaciones"

type Resultado = { ok: boolean; mensaje: string; errores?: Record<string, string> }

const BANEO_INDEFINIDO = "876000h" // ~100 años: bloquea el inicio de sesión

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim()
}

/** Evita dejar el sistema sin administradores activos */
async function quedariaSinAdmin(usuarioId: string): Promise<boolean> {
  const { count } = await getSupabase()
    .from("perfiles")
    .select("id", { count: "exact", head: true })
    .eq("rol", "ADMINISTRADOR")
    .eq("activo", true)
    .neq("id", usuarioId)
  return (count ?? 0) === 0
}

// ---------------------------------------------------------------------
// Crear usuario
// ---------------------------------------------------------------------
export async function crearUsuario(formData: FormData): Promise<Resultado> {
  if (!(await autorizar("usuarios.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }

  const nombre = texto(formData, "nombre_completo")
  const email = texto(formData, "email").toLowerCase()
  const password = String(formData.get("password") ?? "")
  const rol = texto(formData, "rol") as Rol
  const rutTexto = texto(formData, "rut")
  const especialidad = texto(formData, "especialidad") || null
  const registro = texto(formData, "registro_profesional") || null

  const errores: Record<string, string> = {}
  if (nombre.length < 3) errores.nombre_completo = "Ingresa el nombre completo"
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errores.email = "Correo inválido"
  if (password.length < 8) errores.password = "Mínimo 8 caracteres"
  if (!ROLES.includes(rol)) errores.rol = "Selecciona un rol"
  if (rutTexto && !validarRut(rutTexto)) errores.rut = "RUT inválido"
  if (Object.keys(errores).length > 0) return { ok: false, mensaje: "Revisa los campos marcados.", errores }

  const supabase = getSupabase()

  // 1) Crear la cuenta en Supabase Auth (ya confirmada, sin correo de verificación)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre, rol },
  })

  if (error || !data.user) {
    const yaExiste = error?.message?.toLowerCase().includes("already")
    return {
      ok: false,
      mensaje: yaExiste ? "Ya existe un usuario con ese correo." : "No se pudo crear la cuenta.",
      errores: yaExiste ? { email: "Correo ya registrado" } : undefined,
    }
  }

  // 2) Crear el perfil con su rol
  const { error: errorPerfil } = await supabase.from("perfiles").insert({
    id: data.user.id,
    nombre_completo: nombre,
    email,
    rol,
    rut: rutTexto ? normalizarRut(rutTexto) : null,
    especialidad,
    registro_profesional: registro,
  })

  if (errorPerfil) {
    await supabase.auth.admin.deleteUser(data.user.id) // deshacer
    const rutDuplicado = errorPerfil.code === "23505" && errorPerfil.message.includes("rut")
    return {
      ok: false,
      mensaje: rutDuplicado ? "Ya existe un usuario con ese RUT." : "No se pudo crear el perfil.",
      errores: rutDuplicado ? { rut: "RUT ya registrado" } : undefined,
    }
  }

  revalidatePath("/usuarios")
  return { ok: true, mensaje: `Usuario ${nombre} creado. Ya puede iniciar sesión con su correo y contraseña.` }
}

// ---------------------------------------------------------------------
// Cambiar rol
// ---------------------------------------------------------------------
export async function cambiarRol(usuarioId: string, rol: Rol): Promise<Resultado> {
  const admin = await autorizar("usuarios.gestionar")
  if (!admin) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!ROLES.includes(rol)) return { ok: false, mensaje: "Rol inválido." }
  if (usuarioId === admin.id) return { ok: false, mensaje: "No puedes cambiar tu propio rol." }
  if (rol !== "ADMINISTRADOR" && (await quedariaSinAdmin(usuarioId))) {
    return { ok: false, mensaje: "Debe quedar al menos un administrador activo." }
  }

  const { error } = await getSupabase().from("perfiles").update({ rol }).eq("id", usuarioId)
  if (error) return { ok: false, mensaje: "No se pudo cambiar el rol." }

  revalidatePath("/usuarios")
  return { ok: true, mensaje: "Rol actualizado." }
}

// ---------------------------------------------------------------------
// Activar / desactivar usuario
// ---------------------------------------------------------------------
export async function cambiarEstadoUsuario(usuarioId: string): Promise<Resultado> {
  const admin = await autorizar("usuarios.gestionar")
  if (!admin) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (usuarioId === admin.id) return { ok: false, mensaje: "No puedes desactivar tu propia cuenta." }

  const supabase = getSupabase()
  const { data: perfil } = await supabase.from("perfiles").select("activo, rol").eq("id", usuarioId).maybeSingle()
  if (!perfil) return { ok: false, mensaje: "Usuario no encontrado." }

  const activar = !perfil.activo
  if (!activar && perfil.rol === "ADMINISTRADOR" && (await quedariaSinAdmin(usuarioId))) {
    return { ok: false, mensaje: "Debe quedar al menos un administrador activo." }
  }

  // Bloquea (o desbloquea) el inicio de sesión en Supabase Auth
  const { error: errorAuth } = await supabase.auth.admin.updateUserById(usuarioId, {
    ban_duration: activar ? "none" : BANEO_INDEFINIDO,
  })
  if (errorAuth) return { ok: false, mensaje: "No se pudo cambiar el acceso del usuario." }

  const { error } = await supabase.from("perfiles").update({ activo: activar }).eq("id", usuarioId)
  if (error) return { ok: false, mensaje: "No se pudo actualizar el usuario." }

  revalidatePath("/usuarios")
  return { ok: true, mensaje: activar ? "Usuario activado." : "Usuario desactivado." }
}

// ---------------------------------------------------------------------
// Restablecer contraseña
// ---------------------------------------------------------------------
export async function restablecerContrasena(usuarioId: string, nueva: string): Promise<Resultado> {
  if (!(await autorizar("usuarios.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (nueva.length < 8) return { ok: false, mensaje: "La contraseña debe tener al menos 8 caracteres." }

  const { error } = await getSupabase().auth.admin.updateUserById(usuarioId, { password: nueva })
  if (error) return { ok: false, mensaje: "No se pudo cambiar la contraseña." }

  return { ok: true, mensaje: "Contraseña actualizada." }
}

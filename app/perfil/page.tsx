import { requerirUsuario } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"
import { puede } from "@/lib/permisos"
import { normalizarFirmaSvg } from "@/lib/firma"
import { FormPerfil } from "./FormPerfil"

export default async function PerfilPage() {
  const usuario = await requerirUsuario()

  const { data: perfil } = await getSupabase()
    .from("perfiles")
    .select("nombre_completo, email, telefono, firma_svg, preferencias")
    .eq("id", usuario.id)
    .single()

  const partes = (perfil?.nombre_completo ?? "").trim().split(" ")
  const nombres = partes[0] ?? ""
  const apellidos = partes.slice(1).join(" ")

  return (
    <FormPerfil
      puedeFirmar={puede(usuario.rol, "firma.propia")}
      rol={usuario.rol}
      perfil={{
        nombres,
        apellidos,
        email: perfil?.email ?? usuario.email,
        telefono: perfil?.telefono ?? "",
        firma_svg: normalizarFirmaSvg(perfil?.firma_svg) ?? "",
        preferencias: perfil?.preferencias ?? { notificaciones_email: true, tema: "light" },
      }}
    />
  )
}

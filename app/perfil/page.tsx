import { redirect } from "next/navigation"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { FormPerfil } from "./FormPerfil"

export default async function PerfilPage() {
  const supabase = await crearClienteAuth()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, email, telefono, firma_svg, preferencias")
    .eq("id", user.id)
    .single()

  const partes = (perfil?.nombre_completo ?? "").trim().split(" ")
  const nombres = partes[0] ?? ""
  const apellidos = partes.slice(1).join(" ")

  return (
    <FormPerfil
      perfil={{
        nombres,
        apellidos,
        email: user.email ?? "",
        telefono: perfil?.telefono ?? "",
        firma_svg: perfil?.firma_svg ?? "",
        preferencias: perfil?.preferencias ?? { notificaciones_email: true, tema: "light" },
      }}
    />
  )
}
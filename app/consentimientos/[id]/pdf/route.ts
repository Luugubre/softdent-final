import { NextRequest, NextResponse } from "next/server"
import { obtenerUsuarioActual } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return new NextResponse("Debes iniciar sesión.", { status: 401 })
  if (!puede(usuario.rol, "clinico.ver")) return new NextResponse("No tienes permiso para ver consentimientos.", { status: 403 })

  const { id } = await params
  if (!UUID.test(id)) return new NextResponse("Consentimiento no encontrado.", { status: 404 })
  const { data } = await getSupabase()
    .from("consentimientos_paciente")
    .select("folio, pdf_base64")
    .eq("id", id)
    .maybeSingle()
  if (!data?.pdf_base64) return new NextResponse("Este consentimiento aún no tiene PDF firmado.", { status: 404 })

  const contenido = data.pdf_base64.replace(/^data:application\/pdf;base64,/, "")
  return new NextResponse(Buffer.from(contenido, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="consentimiento-${data.folio}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}

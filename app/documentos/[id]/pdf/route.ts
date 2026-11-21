import { NextRequest, NextResponse } from "next/server"
import { obtenerUsuarioActual } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"
import { NOMBRE_CLINICA } from "@/lib/clinica"
import { escaparHtml as e, normalizarFirmaSvg } from "@/lib/firma"
import { limpiarHtmlDocumento } from "@/lib/html-seguro"
import { formatearRut } from "@/lib/validaciones"
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/documentos-tipos"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return new NextResponse("Debes iniciar sesión.", { status: 401 })
  if (!puede(usuario.rol, "clinico.ver")) return new NextResponse("No tienes permiso para ver documentos clínicos.", { status: 403 })

  const { id } = await params
  if (!UUID.test(id)) return new NextResponse("Documento no encontrado.", { status: 404 })
  const db = getSupabase()
  const { data: doc } = await db.from("documentos_clinicos").select("*").eq("id", id).maybeSingle()
  if (!doc) return new NextResponse("Documento no encontrado.", { status: 404 })

  const [{ data: paciente }, { data: perfil }] = await Promise.all([
    db.from("pacientes").select("nombres, apellidos, rut, extranjero").eq("id", doc.paciente_id).maybeSingle(),
    db.from("perfiles").select("nombre_completo, registro_profesional, firma_svg").eq("id", doc.profesional_id).maybeSingle(),
  ])

  const firma = normalizarFirmaSvg(perfil?.firma_svg)
  const profesional = perfil?.nombre_completo || "Cirujano Dentista"
  const pacienteNombre = paciente ? `${paciente.nombres} ${paciente.apellidos}` : "Paciente"
  const rut = paciente ? (paciente.extranjero ? paciente.rut : formatearRut(paciente.rut)) : "—"
  const fecha = new Date(doc.created_at).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  })
  const tipo = TIPOS_DOCUMENTO[doc.tipo as TipoDocumento] ?? "Documento"
  const anulado = doc.estado === "ANULADO"

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${e(tipo)} folio ${e(doc.folio)}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.55; margin: 0; padding: 20px; font-size: 13px; }
  .cabecera { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; }
  .clinica { font-size: 20px; font-weight: 800; color: #0369a1; text-transform: uppercase; }
  .folio { font-weight: 700; color: #e11d48; }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 18px; font-size: 12px; }
  .contenido h1, .contenido h2, .contenido h3 { color: #0f172a; }
  .pie { margin-top: 48px; display: flex; justify-content: space-between; align-items: flex-end; }
  .firma { text-align: center; width: 260px; border-top: 1px solid #94a3b8; padding-top: 8px; font-size: 11px; }
  .firma svg { width: 180px; height: 70px; }
  .anulado { position: fixed; top: 42%; left: 12%; transform: rotate(-30deg); font-size: 64px; font-weight: 900; color: rgba(225,29,72,.2); border: 8px solid rgba(225,29,72,.2); padding: 10px 40px; border-radius: 12px; }
</style>
</head>
<body onload="window.print()">
  ${anulado ? `<div class="anulado">ANULADO</div>` : ""}
  <div class="cabecera">
    <div>
      <div class="clinica">${e(NOMBRE_CLINICA)}</div>
      <div style="font-size:11px;color:#64748b">${e(tipo)} clínico</div>
    </div>
    <div style="text-align:right">
      <div class="folio">FOLIO N° ${e(doc.folio)}</div>
      <div style="font-size:11px;color:#64748b">Fecha: ${e(fecha)}</div>
    </div>
  </div>
  <div class="datos">
    <div><strong>PACIENTE:</strong> ${e(pacienteNombre)}<br><strong>RUT:</strong> ${e(rut)}</div>
    <div><strong>PROFESIONAL:</strong> Dr(a). ${e(profesional)}<br><strong>REG. PROFESIONAL:</strong> ${e(perfil?.registro_profesional || "N/A")}</div>
    ${doc.destinatario ? `<div style="grid-column: span 2"><strong>DIRIGIDO A:</strong> ${e(doc.destinatario)}</div>` : ""}
  </div>
  <div class="contenido">${limpiarHtmlDocumento(doc.contenido)}</div>
  <div class="pie">
    <div style="font-size:9px;color:#64748b;max-width:320px">
      Documento emitido por ${e(NOMBRE_CLINICA)}. No modificable.<br>
      ${anulado ? `Anulado: ${e(doc.motivo_anulacion)}<br>` : ""}
      Verificación: ${e(doc.id)}
    </div>
    <div class="firma">
      <div style="height:75px;display:flex;align-items:center;justify-content:center">
        ${firma ?? `<span style="color:#cbd5e1;font-style:italic;font-size:10px">[Sin firma guardada]</span>`}
      </div>
      <strong>Dr(a). ${e(profesional)}</strong><br>Firma y timbre profesional
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'",
      "Cache-Control": "no-store",
    },
  })
}

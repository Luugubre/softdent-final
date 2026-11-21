import { NextRequest, NextResponse } from "next/server"
import { obtenerUsuarioActual } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"
import { NOMBRE_CLINICA } from "@/lib/clinica"
import { escaparHtml as e, normalizarFirmaSvg } from "@/lib/firma"

const UUID = /^[0-9a-f-]{36}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return new NextResponse("Debes iniciar sesión.", { status: 401 })
  if (!puede(usuario.rol, "clinico.ver")) return new NextResponse("No tienes permiso para ver recetas.", { status: 403 })

  const { id: recetaId } = await params
  if (!UUID.test(recetaId)) return new NextResponse("Receta no encontrada.", { status: 404 })
  const db = getSupabase()

  // Receta, paciente y dentista
  const { data: receta, error: errReceta } = await db
    .from("recetas")
    .select("*")
    .eq("id", recetaId)
    .maybeSingle()

  if (errReceta || !receta) {
    return new NextResponse("Receta no encontrada.", { status: 404 })
  }

  const [{ data: paciente }, { data: perfil }, { data: items }] = await Promise.all([
    db.from("pacientes").select("nombres, apellidos, rut").eq("id", receta.paciente_id).maybeSingle(),
    db.from("perfiles").select("nombre_completo, registro_profesional, firma_svg").eq("id", receta.profesional_id).maybeSingle(),
    db.from("receta_items").select("*").eq("receta_id", receta.id),
  ])

  // Firma normalizada
  const firmaSvg = normalizarFirmaSvg(perfil?.firma_svg)
  const profesionalNombre = perfil?.nombre_completo || "Cirujano Dentista"
  const registroProf = perfil?.registro_profesional || "N/A"

  const pacienteNombre = paciente
    ? `${paciente.nombres ?? ""} ${paciente.apellidos ?? ""}`.trim()
    : "Paciente"

  const fecha = new Date(receta.created_at).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  })

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Receta Médica Folio #${e(receta.folio)}</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
        .title { font-size: 20px; font-weight: 800; color: #0369a1; text-transform: uppercase; }
        .folio { font-size: 14px; font-weight: bold; color: #e11d48; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 12px; }
        .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; padding-bottom: 4px; }
        .med-item { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 10px; font-size: 12px; }
        .med-title { font-weight: 800; font-size: 13px; color: #0f172a; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
        .firma-box { text-align: center; width: 260px; border-top: 1px solid #94a3b8; padding-top: 8px; font-size: 11px; }
        .firma-container { height: 75px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
        .firma-svg-wrapper { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .firma-svg-wrapper svg { width: 180px; height: 70px; max-height: 70px; }
        .anulada-watermark { position: fixed; top: 45%; left: 15%; transform: rotate(-30deg); font-size: 70px; font-weight: 900; color: rgba(225, 29, 72, 0.2); border: 8px solid rgba(225, 29, 72, 0.2); padding: 10px 40px; border-radius: 12px; pointer-events: none; }
      </style>
    </head>
    <body onload="window.print()">
      ${receta.estado === "ANULADA" ? `<div class="anulada-watermark">RECETA ANULADA</div>` : ""}

      <div class="header">
        <div>
          <div class="title">${e(NOMBRE_CLINICA)}</div>
          <div style="font-size: 11px; color: #64748b;">Receta Médica Electrónica</div>
        </div>
        <div style="text-align: right;">
          <div class="folio">FOLIO N° ${e(receta.folio)}</div>
          <div style="font-size: 11px; color: #64748b;">Fecha: ${e(fecha)}</div>
        </div>
      </div>

      <div class="grid">
        <div>
          <strong>PACIENTE:</strong> ${e(pacienteNombre)}<br>
          <strong>RUT:</strong> ${e(paciente?.rut || "N/A")}
        </div>
        <div>
          <strong>PROFESIONAL:</strong> Dr(a). ${e(profesionalNombre)}<br>
          <strong>REG. PROFESIONAL:</strong> ${e(registroProf)}
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <div class="section-title">Diagnóstico Clínico</div>
        <div style="font-size: 12px; font-weight: 600;">${e(receta.diagnostico)}</div>
      </div>

      <div style="margin-bottom: 20px;">
        <div class="section-title">Prescripción Médica</div>
        ${(items ?? []).map((it) => `
          <div class="med-item">
            <div class="med-title">${e(it.medicamento)} (${e(it.presentacion)})</div>
            <div><strong>Dosis:</strong> ${e(it.dosis)} | <strong>Frecuencia:</strong> ${e(it.frecuencia)} | <strong>Duración:</strong> ${e(it.duracion)}</div>
            <div style="color: #64748b; font-size: 11px;">Vía: ${e(it.via)} - Cantidad: ${e(it.cantidad)}</div>
          </div>
        `).join("")}
      </div>

      ${receta.indicaciones_generales ? `
        <div style="margin-bottom: 20px;">
          <div class="section-title">Indicaciones Generales</div>
          <div style="font-size: 11px; color: #334155; white-space: pre-line;">${e(receta.indicaciones_generales)}</div>
        </div>
      ` : ""}

      <div class="footer">
        <div style="font-size: 9px; color: #64748b; max-width: 320px; line-height: 1.3;">
          <strong>Receta Médica Electrónica Simple</strong><br>
          Documento emitido por ${e(NOMBRE_CLINICA)} y no modificable.<br>
          Válido exclusivamente para medicamentos de venta directa y receta simple no controlada.<br>
          Verificación de autenticidad ID: ${e(receta.id)}
        </div>
        <div class="firma-box">
          <div class="firma-container">
            ${firmaSvg ? `<div class="firma-svg-wrapper">${firmaSvg}</div>` : `<span style="color: #cbd5e1; font-style: italic; font-size: 10px;">[Sin firma guardada]</span>`}
          </div>
          <strong>Dr(a). ${e(profesionalNombre)}</strong><br>
          Firma y Timbre Profesional
        </div>
      </div>
    </body>
    </html>
  `

  return new NextResponse(htmlContent, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'",
      "Cache-Control": "no-store",
    },
  })
}
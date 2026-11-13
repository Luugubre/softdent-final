'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function obtenerUsuarioAutenticado() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se ignora en Server Components
          }
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return user;
}

function sha256(texto: string): string {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

function limpiarHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// 1. Obtener citas del doctor
export async function obtenerCitasDoctor(doctorId: string) {
  try {
    const { data: citas, error } = await supabaseAdmin
      .from('citas')
      .select(`
        id,
        inicio,
        fin,
        duracion_min,
        motivo,
        estado,
        paciente:pacientes (
          id,
          nombres,
          rut,
          email,
          telefono
        ),
        consentimientos:consentimientos_paciente (
          id,
          estado,
          created_at,
          pdf_base64
        )
      `)
      .eq('profesional_id', doctorId)
      .order('inicio', { ascending: true });

    if (error) {
      console.error('Error al obtener citas:', JSON.stringify(error, null, 2));
      return [];
    }

    return citas || [];
  } catch (err) {
    console.error('Error inesperado en obtenerCitasDoctor:', err);
    return [];
  }
}

// 2. Obtener plantillas activas
export async function obtenerPlantillasActivas() {
  try {
    const { data: plantillas, error } = await supabaseAdmin
      .from('plantillas_consentimiento')
      .select('id, titulo, contenido_template')
      .eq('activa', true);

    if (error) {
      console.error('Error al obtener plantillas:', JSON.stringify(error, null, 2));
      return [];
    }

    return plantillas || [];
  } catch (err) {
    console.error('Error inesperado en obtenerPlantillasActivas:', err);
    return [];
  }
}

// Lógica auxiliar para snapshot y tokens
async function crearConsentimientoYToken(payload: {
  citaId: string;
  pacienteId: string;
  doctorId: string;
  plantillaId: string;
}) {
  const { data: paciente, error: errPaciente } = await supabaseAdmin
    .from('pacientes')
    .select('*')
    .eq('id', payload.pacienteId)
    .single();

  if (errPaciente || !paciente) {
    return { exito: false, mensaje: 'No se encontró información del paciente.' };
  }

  let nombreCompleto = '';
  if (paciente.nombres) {
    nombreCompleto = paciente.apellidos 
      ? `${paciente.nombres} ${paciente.apellidos}` 
      : paciente.nombres;
  } else if (paciente.nombre) {
    nombreCompleto = paciente.nombre;
  } else {
    nombreCompleto = 'Paciente';
  }

  const { data: plantilla, error: errPlantilla } = await supabaseAdmin
    .from('plantillas_consentimiento')
    .select('titulo, contenido_template')
    .eq('id', payload.plantillaId)
    .single();

  if (errPlantilla || !plantilla) {
    return { exito: false, mensaje: 'No se encontró la plantilla seleccionada.' };
  }

  const contenidoSnapshot = plantilla.contenido_template
    .replace(/{{nombre_paciente}}/g, nombreCompleto)
    .replace(/{{nombres_paciente}}/g, nombreCompleto)
    .replace(/{{rut_paciente}}/g, paciente.rut || '');

  const hashContenido = sha256(contenidoSnapshot);

  const { data: consentimiento, error: errConsentimiento } = await supabaseAdmin
    .from('consentimientos_paciente')
    .insert({
      paciente_id: payload.pacienteId,
      doctor_id: payload.doctorId,
      cita_id: payload.citaId,
      plantilla_id: payload.plantillaId,
      titulo: plantilla.titulo,
      contenido_snapshot: contenidoSnapshot,
      hash_contenido_sha256: hashContenido,
      estado: 'PENDIENTE_FIRMA',
    })
    .select('id')
    .single();

  if (errConsentimiento || !consentimiento) {
    return { exito: false, mensaje: 'Error al registrar el consentimiento.' };
  }

  const tokenRaw = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(tokenRaw);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error: errToken } = await supabaseAdmin
    .from('tokens_firma_consentimiento')
    .insert({
      consentimiento_id: consentimiento.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (errToken) {
    return { exito: false, mensaje: 'Error al crear el token de firma.' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const linkFirma = `${appUrl}/firmar/${tokenRaw}`;

  return { 
    exito: true, 
    paciente: { 
      ...paciente, 
      nombreCompleto 
    }, 
    plantilla, 
    linkFirma 
  };
}

// 3. Enviar consentimiento por Correo
export async function enviarConsentimientoCita(payload: {
  citaId: string;
  pacienteId: string;
  doctorId: string;
  plantillaId: string;
  emailPaciente: string;
}) {
  try {
    const resBase = await crearConsentimientoYToken(payload);
    if (!resBase.exito || !resBase.paciente || !resBase.plantilla || !resBase.linkFirma) {
      return { exito: false, mensaje: resBase.mensaje || 'Error al procesar el documento.' };
    }

    const correoDestino = payload.emailPaciente || resBase.paciente.email;
    if (!correoDestino) {
      return { exito: false, mensaje: 'El paciente no tiene un correo asignado.' };
    }

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: [correoDestino],
      subject: `Firma Requerida: ${resBase.plantilla.titulo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #1e40af;">Estimado(a) ${resBase.paciente.nombreCompleto},</h2>
          <p>Para su próxima atención médica, solicitamos revisar y firmar el siguiente documento:</p>
          <p style="font-size: 16px; font-weight: bold; color: #1f2937;">${resBase.plantilla.titulo}</p>
          <div style="margin: 25px 0;">
            <a href="${resBase.linkFirma}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Revisar y Firmar Documento
            </a>
          </div>
          <p style="font-size: 12px; color: #6b7280;">Este enlace expirará en 48 horas y solo puede utilizarse una vez.</p>
        </div>
      `,
    });

    return { exito: true, mensaje: 'Correo enviado al paciente correctamente.' };
  } catch (err) {
    console.error('Error general en enviarConsentimientoCita:', err);
    return { exito: false, mensaje: 'Ocurrió un error inesperado al enviar el correo.' };
  }
}

// 4. Generar Enlace directo de WhatsApp
export async function generarEnlaceWhatsAppConsentimiento(payload: {
  citaId: string;
  pacienteId: string;
  doctorId: string;
  plantillaId: string;
}) {
  try {
    const resBase = await crearConsentimientoYToken(payload);
    if (!resBase.exito || !resBase.paciente || !resBase.plantilla || !resBase.linkFirma) {
      return { exito: false, mensaje: resBase.mensaje || 'Error al procesar el documento.' };
    }

    let telefono = resBase.paciente.telefono ? String(resBase.paciente.telefono).replace(/\D/g, '') : '';

    const mensaje = `Hola *${resBase.paciente.nombreCompleto}*,\n\nPara su próxima atención médica solicitamos revisar y firmar el documento:\n*${resBase.plantilla.titulo}*\n\nPuede completarlo en el siguiente enlace:\n${resBase.linkFirma}\n\n_(Enlace válido por 48 horas)_`;

    const mensajeEncoded = encodeURIComponent(mensaje);
    const linkWhatsApp = telefono 
      ? `https://wa.me/${telefono}?text=${mensajeEncoded}`
      : `https://wa.me/?text=${mensajeEncoded}`;

    return { 
      exito: true, 
      linkWhatsApp, 
      mensaje: 'Enlace de WhatsApp generado correctamente.' 
    };
  } catch (err) {
    console.error('Error en generarEnlaceWhatsAppConsentimiento:', err);
    return { exito: false, mensaje: 'Ocurrió un error inesperado al generar el enlace de WhatsApp.' };
  }
}

// 5. Procesar Firma, Generar PDF Limpio y Guardar en BD
export async function procesarFirmaPaciente(payload: {
  tokenRaw: string;
  firmaBase64Paciente: string;
}) {
  try {
    const tokenHash = sha256(payload.tokenRaw);

    const { data: tokenData, error: errToken } = await supabaseAdmin
      .from('tokens_firma_consentimiento')
      .select('consentimiento_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (errToken || !tokenData) {
      return { exito: false, mensaje: 'Token inválido o expirado.' };
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return { exito: false, mensaje: 'El token ha expirado.' };
    }

    const { data: consentimiento, error: errConsentimiento } = await supabaseAdmin
      .from('consentimientos_paciente')
      .select('*')
      .eq('id', tokenData.consentimiento_id)
      .single();

    if (errConsentimiento || !consentimiento) {
      return { exito: false, mensaje: 'No se encontró el consentimiento.' };
    }

    const { data: paciente } = await supabaseAdmin
      .from('pacientes')
      .select('nombres, rut, email')
      .eq('id', consentimiento.paciente_id)
      .single();

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const { width, height } = page.getSize();
    let y = height - 50;

    page.drawText(`FOLIO: ${consentimiento.id}`, { x: 50, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    y -= 25;

    page.drawText(consentimiento.titulo || 'Consentimiento Informado', { x: 50, y, size: 13, font: fontBold, color: rgb(0.1, 0.2, 0.6) });
    y -= 30;

    const textoLimpio = limpiarHtml(consentimiento.contenido_snapshot || '');
    const lineas = textoLimpio.split('\n');

    for (const linea of lineas) {
      const lineaTrim = linea.trim();
      if (!lineaTrim) continue;

      if (y < 120) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }

      if (lineaTrim.length > 90) {
        const partes = lineaTrim.match(/.{1,85}(\s|$)/g) || [lineaTrim];
        for (const subLinea of partes) {
          page.drawText(subLinea.trim(), { x: 50, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
          y -= 14;
        }
      } else {
        page.drawText(lineaTrim, { x: 50, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        y -= 14;
      }
    }

    if (y < 100) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - 50;
    }

    y -= 20;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 40;

    // Sello HASH SHA-256 de Inmutabilidad
    page.drawRectangle({ x: 50, y: y - 10, width: width - 100, height: 35, color: rgb(0.96, 0.96, 0.96) });
    page.drawText(`HASH SHA-256 (Inmutabilidad Legal):`, { x: 60, y: y + 10, size: 8, font: fontBold });
    page.drawText(consentimiento.hash_contenido_sha256 || '', { x: 60, y: y, size: 7, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    await supabaseAdmin
      .from('consentimientos_paciente')
      .update({
        estado: 'FIRMADO',
        firmado_at: new Date().toISOString(),
        firma_paciente_base64: payload.firmaBase64Paciente,
        pdf_base64: pdfBase64,
      })
      .eq('id', consentimiento.id);

    if (paciente?.email) {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: [paciente.email],
          subject: `Copia Firmada: ${consentimiento.titulo}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #166534;">Documento Firmado Exitosamente</h2>
              <p>Estimado(a) <strong>${paciente.nombres}</strong>,</p>
              <p>Adjunto encontrará una copia oficial en PDF de su consentimiento informado.</p>
            </div>
          `,
          attachments: [
            {
              filename: `${(consentimiento.titulo || 'Consentimiento').replace(/\s+/g, '_')}_Firmado.pdf`,
              content: pdfBase64,
            },
          ],
        });
      } catch (e) {
        console.error('Error enviando correo con PDF:', e);
      }
    }

    return { 
      exito: true, 
      mensaje: 'Documento firmado y PDF generado correctamente.',
      pdfBase64 
    };

  } catch (err) {
    console.error('Error en procesarFirmaPaciente:', err);
    return { exito: false, mensaje: 'Error al procesar la firma.' };
  }
}

// 6. Obtener o Auto-generar PDF para el Doctor
export async function obtenerPdfConsentimiento(consentimientoId: string) {
  try {
    if (!consentimientoId) {
      return { exito: false, mensaje: 'ID de consentimiento no proporcionado.' };
    }

    const { data: consentimiento, error } = await supabaseAdmin
      .from('consentimientos_paciente')
      .select('*')
      .eq('id', consentimientoId)
      .single();

    if (error || !consentimiento) {
      return { exito: false, mensaje: 'No se encontró el consentimiento en la base de datos.' };
    }

    // 1. Si ya se guardó pdf_base64 previamente, lo entrega al instante
    if (consentimiento.pdf_base64) {
      return { 
        exito: true, 
        pdfBase64: consentimiento.pdf_base64, 
        titulo: consentimiento.titulo 
      };
    }

    // 2. Si no existía, compila la versión en PDF directa y limpia
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const { width, height } = page.getSize();
    let y = height - 50;

    page.drawText(`FOLIO: ${consentimiento.id}`, { x: 50, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    y -= 25;

    page.drawText(consentimiento.titulo || 'Consentimiento Informado', { x: 50, y, size: 13, font: fontBold, color: rgb(0.1, 0.2, 0.6) });
    y -= 30;

    const textoLimpio = limpiarHtml(consentimiento.contenido_snapshot || '');
    const lineas = textoLimpio.split('\n');

    for (const linea of lineas) {
      const lineaTrim = linea.trim();
      if (!lineaTrim) continue;

      if (y < 120) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }

      if (lineaTrim.length > 90) {
        const partes = lineaTrim.match(/.{1,85}(\s|$)/g) || [lineaTrim];
        for (const subLinea of partes) {
          page.drawText(subLinea.trim(), { x: 50, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
          y -= 14;
        }
      } else {
        page.drawText(lineaTrim, { x: 50, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        y -= 14;
      }
    }

    if (y < 100) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - 50;
    }

    y -= 20;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 40;

    page.drawRectangle({ x: 50, y: y - 10, width: width - 100, height: 35, color: rgb(0.96, 0.96, 0.96) });
    page.drawText(`HASH SHA-256 (Inmutabilidad Legal):`, { x: 60, y: y + 10, size: 8, font: fontBold });
    page.drawText(consentimiento.hash_contenido_sha256 || '', { x: 60, y: y, size: 7, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    await supabaseAdmin
      .from('consentimientos_paciente')
      .update({ pdf_base64: pdfBase64 })
      .eq('id', consentimiento.id);

    return { exito: true, pdfBase64, titulo: consentimiento.titulo };
  } catch (err) {
    console.error('Error detallado en obtenerPdfConsentimiento:', err);
    return { exito: false, mensaje: 'Error al generar la lectura del PDF.' };
  }
}
'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { Resend } from 'resend';
import { generarPdfConsentimientoBase64 } from '@/lib/pdf-consentimiento';

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

function calcularEdadTexto(fechaNacimiento?: string | null): string {
  if (!fechaNacimiento) return 'No registrada';
  const nac = new Date(fechaNacimiento);
  if (Number.isNaN(nac.getTime())) return 'No registrada';
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad >= 0 ? String(edad) : 'No registrada';
}

function interpolarPlantilla(
  contenido: string,
  datos: {
    fecha: string;
    pacienteNombre: string;
    pacienteRut: string;
    pacienteEdad: string;
    clinicaNombre: string;
    profesionalNombre: string;
    profesionalRegistro: string;
    prestaciones: string;
  }
): string {
  return contenido
    // Variables con punto (plantillas_documento)
    .replace(/\{\{\s*fecha\s*\}\}/gi, datos.fecha)
    .replace(/\{\{\s*paciente\.nombre\s*\}\}/gi, datos.pacienteNombre)
    .replace(/\{\{\s*paciente\.rut\s*\}\}/gi, datos.pacienteRut)
    .replace(/\{\{\s*paciente\.edad\s*\}\}/gi, datos.pacienteEdad)
    .replace(/\{\{\s*clinica\.nombre\s*\}\}/gi, datos.clinicaNombre)
    .replace(/\{\{\s*profesional\.nombre\s*\}\}/gi, datos.profesionalNombre)
    .replace(/\{\{\s*profesional\.registro\s*\}\}/gi, datos.profesionalRegistro)
    .replace(/\{\{\s*prestaciones\s*\}\}/gi, datos.prestaciones)
    // Compatibilidad con variables antiguas con guion bajo
    .replace(/\{\{\s*nombre_paciente\s*\}\}/gi, datos.pacienteNombre)
    .replace(/\{\{\s*nombres_paciente\s*\}\}/gi, datos.pacienteNombre)
    .replace(/\{\{\s*rut_paciente\s*\}\}/gi, datos.pacienteRut)
    .replace(/\{\{\s*nombre_doctor\s*\}\}/gi, datos.profesionalNombre);
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
          apellidos,
          rut,
          fecha_nacimiento,
          email,
          telefono
        ),
        consentimientos:consentimientos_paciente (
          id,
          folio,
          titulo,
          estado,
          contenido_snapshot,
          created_at,
          firmado_at,
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

// 2. Obtener plantillas activas desde plantillas_documento
export async function obtenerPlantillasActivas() {
  try {
    const { data: plantillas, error } = await supabaseAdmin
      .from('plantillas_documento')
      .select('id, nombre, contenido')
      .ilike('tipo', 'CONSENTIMIENTO%')
      .eq('activa', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error al obtener plantillas:', JSON.stringify(error, null, 2));
      return [];
    }

    return (plantillas || []).map((p) => ({
      id: p.id,
      titulo: p.nombre,
      contenido_template: p.contenido,
    }));
  } catch (err) {
    console.error('Error inesperado en obtenerPlantillasActivas:', err);
    return [];
  }
}

async function prepararDatosBase(payload: {
  citaId?: string;
  pacienteId: string;
  doctorId: string;
  plantillaId: string;
}) {
  const [{ data: paciente }, { data: doctor }, { data: docPlantilla }, { data: cita }] = await Promise.all([
    supabaseAdmin.from('pacientes').select('*').eq('id', payload.pacienteId).single(),
    supabaseAdmin
      .from('perfiles')
      .select('id, nombre_completo, especialidad, registro_profesional, firma_svg')
      .eq('id', payload.doctorId)
      .single(),
    supabaseAdmin
      .from('plantillas_documento')
      .select('nombre, contenido')
      .eq('id', payload.plantillaId)
      .ilike('tipo', 'CONSENTIMIENTO%')
      .single(),
    payload.citaId
      ? supabaseAdmin
          .from('citas')
          .select('inicio, motivo, prestacion:prestaciones(nombre)')
          .eq('id', payload.citaId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!paciente) return { error: 'No se encontró información del paciente.' };
  if (!docPlantilla) return { error: 'No se encontró la plantilla seleccionada.' };

  const pacienteNombre =
    [paciente.nombres, paciente.apellidos].filter(Boolean).join(' ') || paciente.nombre || 'Paciente';
  const doctorNombre = doctor?.nombre_completo || 'Profesional tratante';
  const doctorRegistro = doctor?.registro_profesional || 'Sin registro';

  const fechaTexto = new Date().toLocaleDateString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const prestacionObj = Array.isArray(cita?.prestacion) ? cita?.prestacion[0] : cita?.prestacion;
  const prestacionesTexto =
    prestacionObj?.nombre || cita?.motivo || docPlantilla.nombre || 'Atención odontológica';

  const clinicaNombre = process.env.NEXT_PUBLIC_CLINICA_NOMBRE || 'SoftDent';

  const contenidoCompletado = interpolarPlantilla(docPlantilla.contenido, {
    fecha: fechaTexto,
    pacienteNombre,
    pacienteRut: paciente.rut || 'Sin RUT',
    pacienteEdad: calcularEdadTexto(paciente.fecha_nacimiento),
    clinicaNombre,
    profesionalNombre: doctorNombre,
    profesionalRegistro: doctorRegistro,
    prestaciones: prestacionesTexto,
  });

  return {
    paciente,
    pacienteNombre,
    doctor,
    doctorNombre,
    titulo: docPlantilla.nombre,
    contenidoCompletado,
  };
}

// Crear o actualizar en estado BORRADOR (antes de congelar para firma)
export async function crearBorradorConsentimiento(payload: {
  citaId: string;
  pacienteId: string;
  doctorId: string;
  plantillaId: string;
}) {
  try {
    const base = await prepararDatosBase(payload);
    if ('error' in base) return { exito: false, mensaje: base.error ?? 'Error al preparar datos.' };

    const { data, error } = await supabaseAdmin
      .from('consentimientos_paciente')
      .insert({
        paciente_id: payload.pacienteId,
        doctor_id: payload.doctorId,
        cita_id: payload.citaId,
        plantilla_id: payload.plantillaId,
        titulo: base.titulo,
        contenido_snapshot: base.contenidoCompletado,
        estado: 'BORRADOR',
      })
      .select('id, titulo, contenido_snapshot')
      .single();

    if (error || !data) {
      return { exito: false, mensaje: 'No se pudo crear el borrador.' };
    }

    revalidatePath('/citas-consentimiento');
    return {
      exito: true,
      mensaje: 'Borrador creado.',
      consentimientoId: data.id,
      titulo: data.titulo,
      contenido: data.contenido_snapshot,
    };
  } catch (err) {
    console.error('Error en crearBorradorConsentimiento:', err);
    return { exito: false, mensaje: 'Error inesperado al crear el borrador.' };
  }
}

// Congela texto -> PENDIENTE_FIRMA y genera token de 32 bytes (guardando solo hash)
async function crearConsentimientoYToken(payload: {
  citaId: string;
  pacienteId: string;
  doctorId: string;
  plantillaId: string;
}) {
  const base = await prepararDatosBase(payload);
  if ('error' in base) return { exito: false, mensaje: base.error ?? 'Error al preparar datos.' };

  const contenidoSnapshot = base.contenidoCompletado;
  const hashContenido = sha256(contenidoSnapshot);

  const { data: consentimiento, error: errConsentimiento } = await supabaseAdmin
    .from('consentimientos_paciente')
    .insert({
      paciente_id: payload.pacienteId,
      doctor_id: payload.doctorId,
      cita_id: payload.citaId,
      plantilla_id: payload.plantillaId,
      titulo: base.titulo,
      contenido_snapshot: contenidoSnapshot,
      hash_contenido_sha256: hashContenido,
      estado: 'PENDIENTE_FIRMA',
    })
    .select('id')
    .single();

  if (errConsentimiento || !consentimiento) {
    console.error('Error insert consentimientos_paciente:', errConsentimiento);
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
      intentos_fallidos: 0,
      max_intentos: 5,
    });

  if (errToken) {
    return { exito: false, mensaje: 'Error al crear el token de firma.' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const linkFirma = `${appUrl}/firmar/${tokenRaw}`;

  revalidatePath('/citas-consentimiento');
  return {
    exito: true,
    paciente: { ...base.paciente, nombreCompleto: base.pacienteNombre },
    plantilla: { titulo: base.titulo },
    linkFirma,
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
          <p>Para su próxima atención dental, solicitamos revisar y firmar el siguiente documento:</p>
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

    const digitos = resBase.paciente.telefono ? String(resBase.paciente.telefono).replace(/\D/g, '') : '';
    const telefono = digitos.startsWith('56') ? digitos : digitos.length === 9 ? `56${digitos}` : digitos;

    const mensaje = `Hola *${resBase.paciente.nombreCompleto}*,\n\nPara su próxima atención dental solicitamos revisar y firmar el documento:\n*${resBase.plantilla.titulo}*\n\nPuede completarlo en el siguiente enlace:\n${resBase.linkFirma}\n\n_(Enlace válido por 48 horas)_`;

    const mensajeEncoded = encodeURIComponent(mensaje);
    const linkWhatsApp = telefono
      ? `https://wa.me/${telefono}?text=${mensajeEncoded}`
      : `https://wa.me/?text=${mensajeEncoded}`;

    return {
      exito: true,
      linkWhatsApp,
      mensaje: 'Enlace de WhatsApp generado correctamente.',
    };
  } catch (err) {
    console.error('Error en generarEnlaceWhatsAppConsentimiento:', err);
    return { exito: false, mensaje: 'Ocurrió un error inesperado al generar el enlace de WhatsApp.' };
  }
}

// 5. Firma Presencial en Consulta (tablet o PC)
export async function firmarConsentimientoPresencial(payload: {
  citaId: string;
  pacienteId: string;
  doctorId: string;
  plantillaId: string;
  firmanteNombre: string;
  firmanteRut: string;
  esApoderado: boolean;
  firmaBase64: string;
}) {
  try {
    if (!payload.firmaBase64.startsWith('data:image/png;base64,')) {
      return { exito: false, mensaje: 'La firma capturada no es válida.' };
    }

    const base = await prepararDatosBase(payload);
    if ('error' in base) return { exito: false, mensaje: base.error ?? 'Error al preparar datos.' };

    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'Consulta presencial';
    const userAgent = headersList.get('user-agent') || 'Tablet/PC Consulta';
    const ahora = new Date().toISOString();

    const contenidoSnapshot = base.contenidoCompletado;
    const hashContenido = sha256(contenidoSnapshot);

    const { data: insertado, error: errInsert } = await supabaseAdmin
      .from('consentimientos_paciente')
      .insert({
        paciente_id: payload.pacienteId,
        doctor_id: payload.doctorId,
        cita_id: payload.citaId,
        plantilla_id: payload.plantillaId,
        titulo: base.titulo,
        contenido_snapshot: contenidoSnapshot,
        hash_contenido_sha256: hashContenido,
        estado: 'FIRMADO',
        firma_paciente_url: payload.firmaBase64,
        firmado_at: ahora,
        firmante_nombre: payload.firmanteNombre.trim(),
        firmante_rut: payload.firmanteRut.trim(),
        firmante_es_apoderado: payload.esApoderado,
        firmante_ip: ip,
        firmante_user_agent: userAgent,
      })
      .select('id, folio')
      .single();

    if (errInsert || !insertado) {
      console.error('Error guardando firma presencial:', errInsert);
      return { exito: false, mensaje: 'No se pudo registrar la firma presencial.' };
    }

    const pdfBase64 = await generarPdfConsentimientoBase64({
      id: insertado.id,
      folio: insertado.folio,
      titulo: base.titulo,
      estado: 'FIRMADO',
      contenido_snapshot: contenidoSnapshot,
      hash_contenido_sha256: hashContenido,
      firma_paciente_url: payload.firmaBase64,
      firmado_at: ahora,
      firmante_nombre: payload.firmanteNombre.trim(),
      firmante_rut: payload.firmanteRut.trim(),
      firmante_es_apoderado: payload.esApoderado,
      firmante_ip: ip,
      paciente_nombre: base.pacienteNombre,
      paciente_rut: base.paciente.rut || '',
      doctor_nombre: base.doctorNombre,
      doctor_especialidad: base.doctor?.especialidad ?? null,
      doctor_registro: base.doctor?.registro_profesional ?? null,
      doctor_firma_svg: base.doctor?.firma_svg ?? null,
    });

    await supabaseAdmin
      .from('consentimientos_paciente')
      .update({ pdf_base64: pdfBase64 })
      .eq('id', insertado.id);

    revalidatePath('/citas-consentimiento');
    return { exito: true, mensaje: 'Consentimiento firmado presencialmente y PDF generado.' };
  } catch (err) {
    console.error('Error en firmarConsentimientoPresencial:', err);
    return { exito: false, mensaje: 'Error inesperado al registrar la firma presencial.' };
  }
}

// 6. Revocar un consentimiento (opcional)
export async function revocarConsentimiento(consentimientoId: string, motivo: string) {
  try {
    if (!motivo.trim()) {
      return { exito: false, mensaje: 'Indica el motivo de revocación.' };
    }

    const ahora = new Date().toISOString();
    const { data: consentimiento, error } = await supabaseAdmin
      .from('consentimientos_paciente')
      .update({
        estado: 'REVOCADO',
        motivo_revocacion: motivo.trim(),
        revocado_at: ahora,
        pdf_base64: null,
        updated_at: ahora,
      })
      .eq('id', consentimientoId)
      .select('id')
      .single();

    if (error || !consentimiento) {
      return { exito: false, mensaje: 'No se pudo revocar el consentimiento.' };
    }

    await supabaseAdmin
      .from('tokens_firma_consentimiento')
      .update({ usado_at: ahora })
      .eq('consentimiento_id', consentimientoId)
      .is('usado_at', null);

    revalidatePath('/citas-consentimiento');
    return { exito: true, mensaje: 'Consentimiento revocado.' };
  } catch (err) {
    console.error('Error en revocarConsentimiento:', err);
    return { exito: false, mensaje: 'Error inesperado al revocar.' };
  }
}

// 7. Obtener o Regenerar PDF con firmas incrustadas
export async function obtenerPdfConsentimiento(consentimientoId: string) {
  try {
    if (!consentimientoId) {
      return { exito: false, mensaje: 'ID de consentimiento no proporcionado.' };
    }

    const { data: consentimiento, error } = await supabaseAdmin
      .from('consentimientos_paciente')
      .select(`
        *,
        paciente:pacientes (nombres, apellidos, rut),
        doctor:perfiles!consentimientos_paciente_doctor_id_fkey (
          nombre_completo,
          especialidad,
          registro_profesional,
          firma_svg
        )
      `)
      .eq('id', consentimientoId)
      .single();

    if (error || !consentimiento) {
      return { exito: false, mensaje: 'No se encontró el consentimiento en la base de datos.' };
    }

    const paciente = Array.isArray(consentimiento.paciente)
      ? consentimiento.paciente[0]
      : consentimiento.paciente;
    const doctor = Array.isArray(consentimiento.doctor)
      ? consentimiento.doctor[0]
      : consentimiento.doctor;

    const pacienteNombre =
      [paciente?.nombres, paciente?.apellidos].filter(Boolean).join(' ') || 'Paciente';

    const pdfBase64 = await generarPdfConsentimientoBase64({
      id: consentimiento.id,
      folio: consentimiento.folio,
      titulo: consentimiento.titulo,
      estado: consentimiento.estado,
      contenido_snapshot: consentimiento.contenido_snapshot,
      hash_contenido_sha256: consentimiento.hash_contenido_sha256,
      firma_paciente_url: consentimiento.firma_paciente_url,
      firma_doctor_url: consentimiento.firma_doctor_url,
      firmado_at: consentimiento.firmado_at,
      firmante_nombre: consentimiento.firmante_nombre,
      firmante_rut: consentimiento.firmante_rut,
      firmante_es_apoderado: consentimiento.firmante_es_apoderado,
      firmante_ip: consentimiento.firmante_ip,
      paciente_nombre: pacienteNombre,
      paciente_rut: paciente?.rut ?? null,
      doctor_nombre: doctor?.nombre_completo ?? null,
      doctor_especialidad: doctor?.especialidad ?? null,
      doctor_registro: doctor?.registro_profesional ?? null,
      doctor_firma_svg: doctor?.firma_svg ?? null,
      motivo_revocacion: consentimiento.motivo_revocacion ?? null,
    });

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
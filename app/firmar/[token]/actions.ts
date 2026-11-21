'use server';

import { getSupabase } from '@/lib/supabase';
import { limpiarHtmlDocumento } from '@/lib/html-seguro';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { generarPdfConsentimientoBase64 } from '@/lib/pdf-consentimiento';

const supabase = getSupabase();

function sha256(texto: string): string {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

export async function obtenerDocumentoPorToken(tokenRaw: string) {
  if (!/^[0-9a-f]{64}$/i.test(tokenRaw ?? '')) {
    return { error: 'El enlace de firma es inválido o no existe.' };
  }
  const tokenHash = sha256(tokenRaw);

  const { data: tokenRecord, error } = await supabase
    .from('tokens_firma_consentimiento')
    .select(`
      id,
      expires_at,
      usado_at,
      intentos_fallidos,
      max_intentos,
      consentimiento:consentimientos_paciente (
        id,
        titulo,
        estado,
        contenido_snapshot
      )
    `)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !tokenRecord) {
    return { error: 'El enlace de firma es inválido o no existe.' };
  }

  if (tokenRecord.usado_at) {
    return { error: 'Este enlace ya fue utilizado anteriormente.' };
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    return { error: 'El enlace ha expirado (límite 48 horas).' };
  }

  if (tokenRecord.intentos_fallidos >= tokenRecord.max_intentos) {
    return { error: 'El enlace ha sido bloqueado por superar los intentos de RUT fallidos.' };
  }

  const consentimientoData = Array.isArray(tokenRecord.consentimiento)
    ? tokenRecord.consentimiento[0]
    : tokenRecord.consentimiento;

  if (!consentimientoData) {
    return { error: 'No se encontró el contenido del documento.' };
  }

  if (consentimientoData.estado !== 'PENDIENTE_FIRMA') {
    return { error: `Este documento ya no está pendiente de firma (estado: ${consentimientoData.estado}).` };
  }

  return {
    valido: true,
    documento: {
      titulo: consentimientoData.titulo,
      contenido: limpiarHtmlDocumento(consentimientoData.contenido_snapshot ?? ''),
    },
  };
}

export async function procesarFirmaPaciente(
  tokenRaw: string,
  payload: {
    rutIngresado: string;
    nombreFirmante: string;
    esApoderado: boolean;
    firmaBase64: string;
  }
) {
  // Validación de entrada (ruta pública)
  if (!/^[0-9a-f]{64}$/i.test(tokenRaw ?? '')) {
    return { exito: false, mensaje: 'Token inválido o expirado.' };
  }
  const nombreFirmante = String(payload.nombreFirmante ?? '').trim();
  if (nombreFirmante.length < 3 || nombreFirmante.length > 120) {
    return { exito: false, mensaje: 'Escribe el nombre completo de quien firma.' };
  }
  const firma = String(payload.firmaBase64 ?? '');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(firma) || firma.length > 700_000) {
    return { exito: false, mensaje: 'La firma no es válida. Límpiala y dibújala de nuevo.' };
  }

  const tokenHash = sha256(tokenRaw);

  const { data: tokenRecord, error } = await supabase
    .from('tokens_firma_consentimiento')
    .select(`
      id,
      intentos_fallidos,
      max_intentos,
      expires_at,
      usado_at,
      consentimiento_id,
      consentimiento:consentimientos_paciente (
        id,
        folio,
        titulo,
        estado,
        contenido_snapshot,
        hash_contenido_sha256,
        firma_doctor_url,
        paciente:pacientes (
          nombres,
          apellidos,
          rut
        ),
        doctor:perfiles!consentimientos_paciente_doctor_id_fkey (
          nombre_completo,
          especialidad,
          registro_profesional,
          firma_svg
        )
      )
    `)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !tokenRecord || tokenRecord.usado_at) {
    return { exito: false, mensaje: 'Token inválido o expirado.' };
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    return { exito: false, mensaje: 'El enlace ha expirado (límite 48 horas).' };
  }

  if (tokenRecord.intentos_fallidos >= tokenRecord.max_intentos) {
    return { exito: false, mensaje: 'Enlace bloqueado por superar los intentos permitidos.' };
  }

  const consentimiento = Array.isArray(tokenRecord.consentimiento)
    ? tokenRecord.consentimiento[0]
    : tokenRecord.consentimiento;

  if (!consentimiento || consentimiento.estado !== 'PENDIENTE_FIRMA') {
    return { exito: false, mensaje: 'Este documento ya fue firmado o revocado.' };
  }

  const paciente = Array.isArray(consentimiento.paciente)
    ? consentimiento.paciente[0]
    : consentimiento.paciente;

  const doctor = Array.isArray(consentimiento.doctor)
    ? consentimiento.doctor[0]
    : consentimiento.doctor;

  const rutRaw = (paciente as { rut?: string } | undefined)?.rut || '';
  const rutPacienteBD = rutRaw.replace(/[^0-9kK]/g, '').toLowerCase();
  const rutIngresadoNorm = payload.rutIngresado.replace(/[^0-9kK]/g, '').toLowerCase();

  if (!rutPacienteBD || rutPacienteBD !== rutIngresadoNorm) {
    const nuevosIntentos = tokenRecord.intentos_fallidos + 1;
    await supabase
      .from('tokens_firma_consentimiento')
      .update({ intentos_fallidos: nuevosIntentos })
      .eq('id', tokenRecord.id);

    const rest = tokenRecord.max_intentos - nuevosIntentos;
    return {
      exito: false,
      mensaje:
        rest > 0
          ? `El RUT ingresado no coincide con el paciente. Te quedan ${rest} intento(s).`
          : 'Límite de 5 intentos alcanzado. Enlace bloqueado.',
    };
  }

  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'IP no detectada';
  const userAgent = headersList.get('user-agent') || 'Navegador no detectado';
  const ahora = new Date().toISOString();

  // Token de un solo uso
  const { data: tomado } = await supabase
    .from('tokens_firma_consentimiento')
    .update({ usado_at: ahora })
    .eq('id', tokenRecord.id)
    .is('usado_at', null)
    .select('id');
  if (!tomado || tomado.length === 0) {
    return { exito: false, mensaje: 'Este enlace ya fue utilizado.' };
  }

  const pacienteNombre = [paciente?.nombres, paciente?.apellidos].filter(Boolean).join(' ') || 'Paciente';

  // Generar PDF final con firma del paciente, firma del doctor, fecha, folio y hash
  const pdfBase64 = await generarPdfConsentimientoBase64({
    id: consentimiento.id,
    folio: consentimiento.folio,
    titulo: consentimiento.titulo,
    estado: 'FIRMADO',
    contenido_snapshot: consentimiento.contenido_snapshot,
    hash_contenido_sha256: consentimiento.hash_contenido_sha256,
    firma_paciente_url: firma,
    firma_doctor_url: consentimiento.firma_doctor_url,
    firmado_at: ahora,
    firmante_nombre: nombreFirmante,
    firmante_rut: payload.rutIngresado.trim(),
    firmante_es_apoderado: payload.esApoderado,
    firmante_ip: ip,
    paciente_nombre: pacienteNombre,
    paciente_rut: rutRaw,
    doctor_nombre: doctor?.nombre_completo ?? null,
    doctor_especialidad: doctor?.especialidad ?? null,
    doctor_registro: doctor?.registro_profesional ?? null,
    doctor_firma_svg: doctor?.firma_svg ?? null,
  });

  const { error: errUpdate } = await supabase
    .from('consentimientos_paciente')
    .update({
      estado: 'FIRMADO',
      firma_paciente_url: firma,
      firmado_at: ahora,
      firmante_nombre: nombreFirmante,
      firmante_rut: payload.rutIngresado.trim(),
      firmante_es_apoderado: payload.esApoderado,
      firmante_ip: ip,
      firmante_user_agent: userAgent,
      pdf_base64: pdfBase64,
      updated_at: ahora,
    })
    .eq('id', tokenRecord.consentimiento_id)
    .eq('estado', 'PENDIENTE_FIRMA');

  if (errUpdate) {
    console.error('Error al actualizar consentimiento firmado:', errUpdate);
    // Libera el token si falla el guardado
    await supabase.from('tokens_firma_consentimiento').update({ usado_at: null }).eq('id', tokenRecord.id);
    return { exito: false, mensaje: 'Error al registrar la firma.' };
  }

  return { exito: true, mensaje: 'Documento firmado con éxito.' };
}
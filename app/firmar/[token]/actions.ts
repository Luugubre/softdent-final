'use server';

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { headers } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sha256(texto: string): string {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

export async function obtenerDocumentoPorToken(tokenRaw: string) {
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

  return {
    valido: true,
    documento: {
      titulo: consentimientoData.titulo,
      contenido: consentimientoData.contenido_snapshot,
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
        paciente:pacientes (
          rut
        )
      )
    `)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !tokenRecord || tokenRecord.usado_at) {
    return { exito: false, mensaje: 'Token inválido o expirado.' };
  }

  if (tokenRecord.intentos_fallidos >= tokenRecord.max_intentos) {
    return { exito: false, mensaje: 'Enlace bloqueado.' };
  }

  // Desestructuración segura contra arrays inferidos por Supabase
  const consentimiento = Array.isArray(tokenRecord.consentimiento)
    ? tokenRecord.consentimiento[0]
    : tokenRecord.consentimiento;

  const paciente = Array.isArray(consentimiento?.paciente)
    ? consentimiento.paciente[0]
    : consentimiento?.paciente;

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
      mensaje: rest > 0
        ? `RUT no coincide. Te quedan ${rest} intento(s).`
        : 'Límite alcanzado. Enlace bloqueado.',
    };
  }

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'IP no detectada';
  const userAgent = headersList.get('user-agent') || 'Navegador no detectado';
  const ahora = new Date().toISOString();

  const { error: errUpdate } = await supabase
    .from('consentimientos_paciente')
    .update({
      estado: 'FIRMADO',
      firma_paciente_url: payload.firmaBase64,
      firmado_at: ahora,
      firmante_nombre: payload.nombreFirmante,
      firmante_rut: payload.rutIngresado,
      firmante_es_apoderado: payload.esApoderado,
      firmante_ip: ip,
      firmante_user_agent: userAgent,
      updated_at: ahora,
    })
    .eq('id', tokenRecord.consentimiento_id);

  if (errUpdate) {
    return { exito: false, mensaje: 'Error al registrar la firma.' };
  }

  await supabase
    .from('tokens_firma_consentimiento')
    .update({ usado_at: ahora })
    .eq('id', tokenRecord.id);

  return { exito: true, mensaje: 'Documento firmado con éxito.' };
}
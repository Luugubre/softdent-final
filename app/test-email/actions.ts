'use server';

import { Resend } from 'resend';
import { z } from 'zod';
import { autorizar } from '@/lib/auth';
import { MENSAJE_SIN_PERMISO } from '@/lib/permisos';

// Prueba de envío de correo (solo administrador)
export async function probarResend(emailDestino: string) {
  const usuario = await autorizar('administracion.gestionar');
  if (!usuario) return { exito: false, error: MENSAJE_SIN_PERMISO };

  const correo = z.string().trim().email().safeParse(emailDestino);
  if (!correo.success) return { exito: false, error: 'Correo no válido.' };

  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { exito: false, error: 'Falta configurar RESEND_API_KEY.' };

  try {
    const respuesta = await new Resend(clave).emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: [correo.data],
      subject: 'Prueba de envío - Consentimiento Informado',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>¡Resend configurado correctamente!</h2>
          <p>Este es un correo de prueba para verificar que los enlaces de firma pública llegarán a los pacientes.</p>
        </div>
      `,
    });
    return { exito: !respuesta.error, data: respuesta };
  } catch (error) {
    console.error('Error Resend:', error);
    return { exito: false, error: 'No se pudo enviar el correo de prueba.' };
  }
}

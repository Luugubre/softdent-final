'use server';

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function probarResend(emailDestino: string) {
  try {
    const respuesta = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: [emailDestino], // Debe ser tu email registrado en Resend
      subject: 'Prueba de envío - Consentimiento Informado',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>¡Resend configurado correctamente!</h2>
          <p>Este es un correo de prueba para verificar que los enlaces de firma pública llegarán a los pacientes.</p>
        </div>
      `,
    });

    console.log('Respuesta Resend:', respuesta);
    return { exito: true, data: respuesta };
  } catch (error) {
    console.error('Error Resend:', error);
    return { exito: false, error };
  }
}
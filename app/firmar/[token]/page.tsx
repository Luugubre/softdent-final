import React from 'react';
import { obtenerDocumentoPorToken } from './actions';
import FormularioFirma from '@/components/firmar/FormularioFirma';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function FirmarPage({ params }: PageProps) {
  const { token } = await params;
  const res = await obtenerDocumentoPorToken(token);

  if (!res.valido || !res.documento) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-red-50 text-red-700 rounded-md text-center">
        <h2 className="text-xl font-bold mb-2">Enlace no disponible</h2>
        <p>{res.error || 'No se puede acceder a este consentimiento.'}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <FormularioFirma token={token} documento={res.documento} />
    </main>
  );
}
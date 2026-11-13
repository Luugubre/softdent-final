import React from 'react';
import { redirect } from 'next/navigation';
import { obtenerUsuarioAutenticado, obtenerCitasDoctor, obtenerPlantillasActivas } from './actions';
import TablaCitasConsentimiento from '@/components/citas-consentimiento/TablaCitasConsentimiento';

export default async function CitasConsentimientoPage() {
  const usuario = await obtenerUsuarioAutenticado();

  if (!usuario) {
    redirect('/login');
  }

  const citas = (await obtenerCitasDoctor(usuario.id)) || [];
  const plantillas = (await obtenerPlantillasActivas()) || [];

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Gestión de Citas y Consentimientos Informados
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sesión activa: <span className="font-semibold text-gray-700">{usuario.email}</span>
          </p>
        </div>
      </div>

      {citas.length === 0 ? (
        <div className="p-6 bg-gray-50 border rounded text-center text-gray-500">
          No tienes citas asignadas para tu cuenta actualmente.
        </div>
      ) : (
        <TablaCitasConsentimiento
          citasIniciales={citas}
          plantillas={plantillas}
          doctorId={usuario.id}
        />
      )}
    </main>
  );
}
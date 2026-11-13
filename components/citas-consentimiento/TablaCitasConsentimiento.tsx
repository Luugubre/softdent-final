'use client';

import React, { useState } from 'react';
import { 
  enviarConsentimientoCita, 
  generarEnlaceWhatsAppConsentimiento,
  obtenerPdfConsentimiento
} from '@/app/citas-consentimiento/actions';

interface Paciente {
  id: string;
  nombres: string;
  rut: string;
  email: string;
  telefono?: string;
}

interface Consentimiento {
  id: string;
  estado: string;
  pdf_base64?: string;
}

interface Cita {
  id: string;
  inicio: string;
  fin?: string;
  duracion_min?: number;
  motivo?: string;
  estado: string;
  paciente: Paciente | Paciente[];
  consentimientos?: Consentimiento[];
}

interface Plantilla {
  id: string;
  titulo: string;
}

interface Props {
  citasIniciales: Cita[];
  plantillas: Plantilla[];
  doctorId: string;
}

export default function TablaCitasConsentimiento({ citasIniciales = [], plantillas = [], doctorId }: Props) {
  const [citas] = useState<Cita[]>(citasIniciales);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<{ [citaId: string]: string }>({});
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{ citaId: string; mensaje: string; error: boolean } | null>(null);

  const handleEnviarEmail = async (cita: Cita) => {
    const paciente = Array.isArray(cita.paciente) ? cita.paciente[0] : cita.paciente;
    const plantillaId = plantillaSeleccionada[cita.id];

    if (!paciente) {
      setNotificacion({ citaId: cita.id, mensaje: 'No hay datos del paciente', error: true });
      return;
    }

    if (!plantillaId) {
      setNotificacion({ citaId: cita.id, mensaje: 'Selecciona una plantilla primero', error: true });
      return;
    }

    setCargandoId(`email-${cita.id}`);
    setNotificacion(null);

    const res = await enviarConsentimientoCita({
      citaId: cita.id,
      pacienteId: paciente.id,
      doctorId,
      plantillaId,
      emailPaciente: paciente.email,
    });

    setCargandoId(null);
    setNotificacion({ citaId: cita.id, mensaje: res.mensaje, error: !res.exito });
  };

  const handleEnviarWhatsApp = async (cita: Cita) => {
    const paciente = Array.isArray(cita.paciente) ? cita.paciente[0] : cita.paciente;
    const plantillaId = plantillaSeleccionada[cita.id];

    if (!paciente) {
      setNotificacion({ citaId: cita.id, mensaje: 'No hay datos del paciente', error: true });
      return;
    }

    if (!plantillaId) {
      setNotificacion({ citaId: cita.id, mensaje: 'Selecciona una plantilla primero', error: true });
      return;
    }

    setCargandoId(`wa-${cita.id}`);
    setNotificacion(null);

    const res = await generarEnlaceWhatsAppConsentimiento({
      citaId: cita.id,
      pacienteId: paciente.id,
      doctorId,
      plantillaId,
    });

    setCargandoId(null);

    if (res.exito && res.linkWhatsApp) {
      window.open(res.linkWhatsApp, '_blank');
      setNotificacion({ citaId: cita.id, mensaje: 'WhatsApp abierto con éxito.', error: false });
    } else {
      setNotificacion({ citaId: cita.id, mensaje: res.mensaje, error: true });
    }
  };

const handleVerPdf = async (consentimientoId: string) => {
    if (!consentimientoId) {
      alert('El consentimiento no posee un identificador válido.');
      return;
    }

    setCargandoId(`pdf-${consentimientoId}`);
    const res = await obtenerPdfConsentimiento(consentimientoId);
    setCargandoId(null);

    if (res.exito && res.pdfBase64) {
      const byteCharacters = atob(res.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      window.open(blobUrl, '_blank');
    } else {
      alert(res.mensaje || 'No se encontró el PDF firmado.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha / Hora</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Paciente</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Motivo / Tratamiento</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Estado Firma</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Plantilla Consentimiento</th>
            <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {(citas || []).map((cita) => {
            const paciente = Array.isArray(cita.paciente) ? cita.paciente[0] : cita.paciente;
            const ultConsentimiento = cita.consentimientos?.[cita.consentimientos.length - 1];

            const fechaHoraTexto = cita.inicio 
              ? new Date(cita.inicio).toLocaleString('es-CL', { 
                  dateStyle: 'short', 
                  timeStyle: 'short' 
                }) 
              : 'Sin fecha';

            return (
              <tr key={cita.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <div>{fechaHoraTexto}</div>
                  {cita.duracion_min && (
                    <div className="text-[11px] text-gray-400">({cita.duracion_min} min)</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{paciente?.nombres || 'Sin Nombre'}</div>
                  <div className="text-xs text-gray-500">RUT: {paciente?.rut || 'S/N'} | {paciente?.email || 'Sin Email'}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-100">
                    {cita.motivo || 'Consulta General'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {ultConsentimiento ? (
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      ultConsentimiento.estado === 'FIRMADO' ? 'bg-green-100 text-green-800' :
                      ultConsentimiento.estado === 'PENDIENTE_FIRMA' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {ultConsentimiento.estado}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Sin Solicitud</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="border p-1.5 rounded text-xs w-full"
                    value={plantillaSeleccionada[cita.id] || ''}
                    onChange={(e) =>
                      setPlantillaSeleccionada({ ...plantillaSeleccionada, [cita.id]: e.target.value })
                    }
                  >
                    <option value="">-- Seleccionar Consentimiento --</option>
                    {(plantillas || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.titulo}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {ultConsentimiento?.estado === 'FIRMADO' ? (
                      <button
                        onClick={() => handleVerPdf(ultConsentimiento.id)}
                        disabled={cargandoId !== null}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 shadow-sm"
                      >
                        {cargandoId === `pdf-${ultConsentimiento.id}` ? 'Cargando...' : '📄 Ver PDF'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEnviarEmail(cita)}
                          disabled={cargandoId !== null}
                          className="bg-blue-600 text-white px-2.5 py-1.5 rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                          {cargandoId === `email-${cita.id}` ? 'Enviando...' : 'Email'}
                        </button>
                        <button
                          onClick={() => handleEnviarWhatsApp(cita)}
                          disabled={cargandoId !== null}
                          className="bg-emerald-600 text-white px-2.5 py-1.5 rounded text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {cargandoId === `wa-${cita.id}` ? 'Generando...' : 'WhatsApp'}
                        </button>
                      </>
                    )}
                  </div>
                  {notificacion?.citaId === cita.id && (
                    <div className={`text-[10px] mt-1 ${notificacion.error ? 'text-red-600' : 'text-green-600'}`}>
                      {notificacion.mensaje}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
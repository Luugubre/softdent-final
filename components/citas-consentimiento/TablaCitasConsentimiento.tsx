'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  enviarConsentimientoCita,
  firmarConsentimientoPresencial,
  generarEnlaceWhatsAppConsentimiento,
  obtenerPdfConsentimiento,
  revocarConsentimiento,
} from '@/app/citas-consentimiento/actions';

interface Paciente {
  id: string;
  nombres: string;
  apellidos?: string;
  rut: string;
  email: string;
  telefono?: string;
}

interface Consentimiento {
  id: string;
  folio?: number;
  titulo?: string;
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
  contenido_template?: string;
}

interface Props {
  citasIniciales: Cita[];
  plantillas: Plantilla[];
  doctorId: string;
}

export default function TablaCitasConsentimiento({ citasIniciales = [], plantillas = [], doctorId }: Props) {
  const router = useRouter();
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<{ [citaId: string]: string }>({});
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{ citaId: string; mensaje: string; error: boolean } | null>(null);

  // Modal de firma presencial en consulta
  const [modalPresencial, setModalPresencial] = useState<{
    cita: Cita;
    paciente: Paciente;
    plantilla: Plantilla;
  } | null>(null);
  const [firmanteNombre, setFirmanteNombre] = useState('');
  const [firmanteRut, setFirmanteRut] = useState('');
  const [esApoderado, setEsApoderado] = useState(false);
  const [aceptoPresencial, setAceptoPresencial] = useState(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  const obtenerCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    isDrawing.current = true;
    const { x, y } = obtenerCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    canvasRef.current?.getContext('2d')?.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = obtenerCoords(e, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
    setTieneTrazo(true);
  };

  const limpiarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
  };

  const abrirModalPresencial = (cita: Cita) => {
    const paciente = Array.isArray(cita.paciente) ? cita.paciente[0] : cita.paciente;
    const plantillaId = plantillaSeleccionada[cita.id];
    const plantilla = plantillas.find((p) => p.id === plantillaId);

    if (!paciente) {
      setNotificacion({ citaId: cita.id, mensaje: 'No hay datos del paciente', error: true });
      return;
    }
    if (!plantilla) {
      setNotificacion({ citaId: cita.id, mensaje: 'Selecciona una plantilla primero', error: true });
      return;
    }

    const nombreCompleto = [paciente.nombres, paciente.apellidos].filter(Boolean).join(' ');
    setFirmanteNombre(nombreCompleto);
    setFirmanteRut(paciente.rut || '');
    setEsApoderado(false);
    setAceptoPresencial(false);
    setTieneTrazo(false);
    setErrorModal(null);
    setModalPresencial({ cita, paciente, plantilla });
  };

  const confirmarFirmaPresencial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPresencial || !canvasRef.current) return;
    setErrorModal(null);

    if (!aceptoPresencial) {
      setErrorModal('El paciente debe marcar "Leí y acepto".');
      return;
    }
    if (!tieneTrazo) {
      setErrorModal('Traza la firma en el recuadro antes de confirmar.');
      return;
    }

    const firmaBase64 = canvasRef.current.toDataURL('image/png');
    setCargandoId(`presencial-${modalPresencial.cita.id}`);

    const res = await firmarConsentimientoPresencial({
      citaId: modalPresencial.cita.id,
      pacienteId: modalPresencial.paciente.id,
      doctorId,
      plantillaId: modalPresencial.plantilla.id,
      firmanteNombre,
      firmanteRut,
      esApoderado,
      firmaBase64,
    });

    setCargandoId(null);

    if (res.exito) {
      const citaId = modalPresencial.cita.id;
      setModalPresencial(null);
      setNotificacion({
        citaId,
        mensaje: res.mensaje ?? 'Consentimiento firmado presencialmente y PDF generado.',
        error: false,
      });
      router.refresh();
    } else {
      setErrorModal(res.mensaje ?? 'No se pudo registrar la firma presencial.');
    }
  };

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
    setNotificacion({
      citaId: cita.id,
      mensaje: res.mensaje ?? 'Proceso finalizado.',
      error: !res.exito,
    });
    if (res.exito) router.refresh();
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
      setNotificacion({
        citaId: cita.id,
        mensaje: res.mensaje ?? 'WhatsApp abierto con éxito.',
        error: false,
      });
      router.refresh();
    } else {
      setNotificacion({
        citaId: cita.id,
        mensaje: res.mensaje ?? 'No se pudo generar el enlace de WhatsApp.',
        error: true,
      });
    }
  };

  const handleVerPdf = async (consentimientoId: string) => {
    if (!consentimientoId) return;

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
      alert(res.mensaje ?? 'No se encontró el PDF.');
    }
  };

  const handleRevocar = async (citaId: string, consentimientoId: string) => {
    const motivo = window.prompt('Ingresa el motivo de revocación del consentimiento:');
    if (!motivo || !motivo.trim()) return;

    setCargandoId(`rev-${consentimientoId}`);
    const res = await revocarConsentimiento(consentimientoId, motivo);
    setCargandoId(null);

    setNotificacion({
      citaId,
      mensaje: res.mensaje ?? 'Estado actualizado.',
      error: !res.exito,
    });
    if (res.exito) router.refresh();
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
          {(citasIniciales || []).map((cita) => {
            const paciente = Array.isArray(cita.paciente) ? cita.paciente[0] : cita.paciente;
            const ultConsentimiento = cita.consentimientos?.[cita.consentimientos.length - 1];

            const fechaHoraTexto = cita.inicio
              ? new Date(cita.inicio).toLocaleString('es-CL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
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
                  <div className="font-semibold text-gray-900">
                    {[paciente?.nombres, paciente?.apellidos].filter(Boolean).join(' ') || 'Sin Nombre'}
                  </div>
                  <div className="text-xs text-gray-500">
                    RUT: {paciente?.rut || 'S/N'} | {paciente?.email || 'Sin Email'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-100">
                    {cita.motivo || 'Consulta General'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {ultConsentimiento ? (
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        ultConsentimiento.estado === 'FIRMADO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ultConsentimiento.estado === 'PENDIENTE_FIRMA'
                          ? 'bg-amber-100 text-amber-800'
                          : ultConsentimiento.estado === 'REVOCADO'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {ultConsentimiento.estado}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">BORRADOR / Sin envío</span>
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
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {ultConsentimiento?.estado === 'FIRMADO' ? (
                      <>
                        <button
                          onClick={() => handleVerPdf(ultConsentimiento.id)}
                          disabled={cargandoId !== null}
                          className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 shadow-sm"
                        >
                          {cargandoId === `pdf-${ultConsentimiento.id}` ? 'Generando...' : '📄 Ver PDF'}
                        </button>
                        <button
                          onClick={() => handleRevocar(cita.id, ultConsentimiento.id)}
                          disabled={cargandoId !== null}
                          className="border border-rose-200 bg-rose-50 text-rose-700 px-2 py-1.5 rounded text-xs font-semibold hover:bg-rose-100"
                        >
                          Revocar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => abrirModalPresencial(cita)}
                          disabled={cargandoId !== null}
                          className="bg-indigo-600 text-white px-2.5 py-1.5 rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                        >
                          ✍️ Firmar aquí
                        </button>
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
                          className="bg-emerald-600 text-white px-2.5 py-1.5 rounded text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {cargandoId === `wa-${cita.id}` ? 'Generando...' : 'WhatsApp'}
                        </button>
                        {ultConsentimiento && ultConsentimiento.estado !== 'REVOCADO' && (
                          <button
                            onClick={() => handleRevocar(cita.id, ultConsentimiento.id)}
                            disabled={cargandoId !== null}
                            className="border border-rose-200 bg-rose-50 text-rose-700 px-2 py-1.5 rounded text-xs font-semibold hover:bg-rose-100"
                          >
                            Revocar
                          </button>
                        )}
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

      {/* Modal de Firma Presencial (Tablet / PC en consulta) */}
      {modalPresencial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between gap-4 border-b pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Firma Presencial en Consulta
                </p>
                <h2 className="text-lg font-black text-gray-900">{modalPresencial.plantilla.titulo}</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalPresencial(null)}
                className="rounded-lg px-2.5 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {modalPresencial.plantilla.contenido_template && (
              <div
                className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: modalPresencial.plantilla.contenido_template
                    .replace(
                      /\{\{\s*fecha\s*\}\}/gi,
                      new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })
                    )
                    .replace(
                      /\{\{\s*(paciente\.nombre|nombre_paciente|nombres_paciente)\s*\}\}/gi,
                      [modalPresencial.paciente.nombres, modalPresencial.paciente.apellidos].filter(Boolean).join(' ')
                    )
                    .replace(/\{\{\s*(paciente\.rut|rut_paciente)\s*\}\}/gi, modalPresencial.paciente.rut || '')
                    .replace(/\{\{\s*clinica\.nombre\s*\}\}/gi, 'SoftDent')
                    .replace(/\{\{\s*prestaciones\s*\}\}/gi, modalPresencial.cita.motivo || modalPresencial.plantilla.titulo)
                    .replace(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g, '—'),
                }}
              />
            )}

            <form onSubmit={confirmarFirmaPresencial} className="space-y-3">
              {errorModal && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">
                  {errorModal}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="tablacitasconsentimi-nombre-de-quien" className="block text-xs font-bold text-gray-700">Nombre de quien firma</label>
                  <input id="tablacitasconsentimi-nombre-de-quien"
                    type="text"
                    required
                    value={firmanteNombre}
                    onChange={(e) => setFirmanteNombre(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="tablacitasconsentimi-rut-de-quien" className="block text-xs font-bold text-gray-700">RUT de quien firma</label>
                  <input id="tablacitasconsentimi-rut-de-quien"
                    type="text"
                    required
                    value={firmanteRut}
                    onChange={(e) => setFirmanteRut(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={esApoderado}
                  onChange={(e) => setEsApoderado(e.target.checked)}
                />
                Firma apoderado o tutor legal (paciente menor de edad)
              </label>

              <label className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 p-2.5 text-xs font-bold text-gray-900">
                <input
                  type="checkbox"
                  checked={aceptoPresencial}
                  onChange={(e) => setAceptoPresencial(e.target.checked)}
                />
                Leí y acepto los términos del consentimiento informado
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700">Firma del paciente / apoderado:</span>
                  <button
                    type="button"
                    onClick={limpiarCanvas}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Limpiar firma
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={160}
                  onMouseDown={startDrawing}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onMouseMove={draw}
                  onTouchStart={startDrawing}
                  onTouchEnd={stopDrawing}
                  onTouchMove={draw}
                  className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 touch-none cursor-crosshair"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPresencial(null)}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoId !== null}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {cargandoId ? 'Guardando...' : 'Confirmar y Firmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
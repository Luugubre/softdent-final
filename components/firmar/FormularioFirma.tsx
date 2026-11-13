'use client';

import React, { useRef, useState } from 'react';
import { procesarFirmaPaciente } from '@/app/firmar/[token]/actions';

interface Props {
  token: string;
  documento: {
    titulo: string;
    contenido: string;
  };
}

export default function FormularioFirma({ token, documento }: Props) {
  const [rut, setRut] = useState('');
  const [nombre, setNombre] = useState('');
  const [esApoderado, setEsApoderado] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firmado, setFirmado] = useState(false);
  const [cargando, setCargando] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    draw(e);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const limpiarFirma = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acepto) {
      setError('Debes declarar que has leído y aceptas el documento.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const firmaBase64 = canvas.toDataURL('image/png');

    setCargando(true);
    const res = await procesarFirmaPaciente(token, {
      rutIngresado: rut,
      nombreFirmante: nombre,
      esApoderado,
      firmaBase64,
    });
    setCargando(false);

    if (res.exito) {
      setFirmado(true);
    } else {
      setError(res.mensaje);
    }
  };

  if (firmado) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center bg-white rounded-lg shadow mt-10">
        <h2 className="text-2xl font-bold text-green-600 mb-2">¡Documento Firmado!</h2>
        <p className="text-gray-600">Se ha guardado la firma y la evidencia legal correctamente. Ya puedes cerrar esta ventana.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white shadow rounded-md my-6">
      <h1 className="text-2xl font-bold mb-4">{documento.titulo}</h1>

      <div
        className="border p-4 h-64 overflow-y-auto mb-6 text-sm bg-gray-50 rounded"
        dangerouslySetInnerHTML={{ __html: documento.contenido }}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium">RUT del Paciente</label>
          <input
            type="text"
            required
            placeholder="11.111.111-1"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Nombre completo de quien firma</label>
          <input
            type="text"
            required
            placeholder="Juan Pérez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border p-2 rounded mt-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="apoderado"
            checked={esApoderado}
            onChange={(e) => setEsApoderado(e.target.checked)}
          />
          <label htmlFor="apoderado" className="text-sm">Firma un apoderado o tutor legal (menor de edad)</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="acepto"
            checked={acepto}
            onChange={(e) => setAcepto(e.target.checked)}
          />
          <label htmlFor="acepto" className="text-sm font-semibold">Leí y acepto los términos del consentimiento informado</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Traza tu firma a continuación:</label>
          <canvas
            ref={canvasRef}
            width={500}
            height={150}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onMouseMove={draw}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchMove={draw}
            className="border rounded w-full bg-gray-50 touch-none cursor-crosshair"
          />
          <button
            type="button"
            onClick={limpiarFirma}
            className="text-xs text-red-500 underline mt-1"
          >
            Limpiar firma
          </button>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          {cargando ? 'Guardando firma...' : 'Confirmar y Firmar'}
        </button>
      </form>
    </div>
  );
}
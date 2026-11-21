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
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firmado, setFirmado] = useState(false);
  const [cargando, setCargando] = useState(false);

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
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
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

  const limpiarFirma = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acepto) {
      setError('Debes declarar que has leído y aceptas el documento.');
      return;
    }

    if (!tieneTrazo || !canvasRef.current) {
      setError('Por favor dibuja tu firma en el recuadro antes de confirmar.');
      return;
    }

    const firmaBase64 = canvasRef.current.toDataURL('image/png');

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
      <div className="max-w-xl mx-auto p-8 text-center bg-white rounded-2xl shadow mt-10 space-y-3">
        <div className="text-4xl">✅</div>
        <h2 className="text-2xl font-black text-emerald-700">¡Documento Firmado!</h2>
        <p className="text-sm text-gray-600">
          Se ha guardado tu firma, el sello SHA-256 y la evidencia legal correctamente. Ya puedes cerrar esta ventana.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-2xl my-6">
      <h1 className="text-2xl font-black text-gray-900 mb-4">{documento.titulo}</h1>

      <div
        className="border border-gray-200 p-4 h-64 overflow-y-auto mb-6 text-sm bg-gray-50 rounded-xl leading-relaxed"
        dangerouslySetInnerHTML={{ __html: documento.contenido }}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-bold text-gray-700">RUT del Paciente (para validar identidad)</label>
            <input
              type="text"
              required
              placeholder="11.111.111-1"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-xl mt-1 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">Nombre completo de quien firma</label>
            <input
              type="text"
              required
              placeholder="Juan Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-xl mt-1 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="apoderado"
            checked={esApoderado}
            onChange={(e) => setEsApoderado(e.target.checked)}
          />
          <label htmlFor="apoderado" className="text-sm text-gray-700">
            Firma un apoderado o tutor legal (paciente menor de edad)
          </label>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-blue-50/70 border border-blue-100 p-3">
          <input
            type="checkbox"
            id="acepto"
            checked={acepto}
            onChange={(e) => setAcepto(e.target.checked)}
          />
          <label htmlFor="acepto" className="text-sm font-bold text-gray-900">
            Leí y acepto los términos del consentimiento informado
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-bold text-gray-700">Traza tu firma en el recuadro:</label>
            <button
              type="button"
              onClick={limpiarFirma}
              className="text-xs font-bold text-rose-600 hover:underline"
            >
              Limpiar firma
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={560}
            height={170}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onMouseMove={draw}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchMove={draw}
            className="border-2 border-dashed border-gray-300 rounded-xl w-full bg-gray-50 touch-none cursor-crosshair"
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {cargando ? 'Guardando firma...' : 'Confirmar y Firmar'}
        </button>
      </form>
    </div>
  );
}
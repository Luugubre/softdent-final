'use client';

import React, { useState } from 'react';
import { probarResend } from './actions';

export default function TestEmailPage() {
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setResultado(null);

    const res = await probarResend(email);

    setCargando(false);
    if (res.exito) {
      setResultado('¡Correo enviado con éxito! Revisa tu bandeja de entrada.');
    } else {
      setResultado(`Error al enviar: ${JSON.stringify(res.error)}`);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white border rounded shadow">
      <h1 className="text-xl font-bold mb-4">Probar Envío con Resend</h1>
      <form onSubmit={handleEnviar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Correo de prueba (debe ser el que usaste en Resend):
          </label>
          <input
            type="email"
            required
            placeholder="tu-correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {cargando ? 'Enviando...' : 'Enviar Correo de Prueba'}
        </button>
      </form>
      {resultado && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-sm font-mono break-all">
          {resultado}
        </div>
      )}
    </div>
  );
}
"use client"

import { useEffect, useState } from "react"
import { buscarPacientesFonasa, buscarPrestacionesFonasa } from "@/app/fonasa-convenios/actions"

export const campo = "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
export const etiqueta = "block text-xs font-black uppercase tracking-wider text-gray-500 mb-1"

type Paciente = { id: string; nombres: string; apellidos: string; rut: string; prevision?: string }
type Prestacion = { id: string; nombre: string; codigo_fonasa: string }

function useBusqueda<T>(texto: string, buscar: (t: string) => Promise<T[]>, activo: boolean) {
  const [res, setRes] = useState<T[]>([])
  useEffect(() => {
    if (!activo || texto.trim().length < 2) {
      setRes([])
      return
    }
    let vigente = true
    const t = setTimeout(async () => {
      const r = await buscar(texto)
      if (vigente) setRes(r)
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [texto, buscar, activo])
  return res
}

export function SelectorPaciente({ valor, onCambio, titulo = "Paciente" }: { valor: Paciente | null; onCambio: (p: Paciente | null) => void; titulo?: string }) {
  const [texto, setTexto] = useState("")
  const res = useBusqueda(texto, buscarPacientesFonasa, !valor)
  return (
    <div>
      <span className={etiqueta}>{titulo}</span>
      {valor ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="text-sm font-bold text-emerald-900 uppercase">
            {valor.nombres} {valor.apellidos} <span className="text-xs font-semibold normal-case text-emerald-700">· {valor.rut}{valor.prevision ? ` · ${valor.prevision}` : ""}</span>
          </span>
          <button onClick={() => onCambio(null)} className="font-black text-emerald-800">
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o RUT…" className={campo} />
          {res.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
              {res.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      onCambio(p)
                      setTexto("")
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-bold uppercase">
                      {p.nombres} {p.apellidos}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {p.rut} · {p.prevision}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function SelectorPrestacionFonasa({ valor, onCambio }: { valor: Prestacion | null; onCambio: (p: Prestacion | null) => void }) {
  const [texto, setTexto] = useState("")
  const res = useBusqueda(texto, buscarPrestacionesFonasa, !valor)
  return (
    <div>
      <span className={etiqueta}>Prestación bonificada (con código FONASA)</span>
      {valor ? (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-sm font-bold text-blue-900">
            {valor.nombre} <span className="text-xs font-mono text-blue-700">· {valor.codigo_fonasa}</span>
          </span>
          <button onClick={() => onCambio(null)} className="font-black text-blue-800">
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o código FONASA…" className={campo} />
          {res.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
              {res.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      onCambio(p)
                      setTexto("")
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-semibold">{p.nombre}</span>
                    <span className="ml-2 text-xs font-mono text-gray-500">{p.codigo_fonasa}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {texto.trim().length >= 2 && res.length === 0 && (
            <p className="mt-1 text-xs font-semibold text-gray-400">Sin resultados. Solo aparecen prestaciones con código FONASA (se define en Prestaciones).</p>
          )}
        </div>
      )}
    </div>
  )
}

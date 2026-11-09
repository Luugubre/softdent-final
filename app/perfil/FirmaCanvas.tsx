"use client"

import { useRef, useState } from "react"

interface FirmaCanvasProps {
  valorInicial?: string
  onChange: (svgContent: string) => void
}

export function FirmaCanvas({ valorInicial = "", onChange }: FirmaCanvasProps) {
  const [dibujando, setDibujando] = useState(false)
  const [trazos, setTrazos] = useState<string[]>([])
  const [trazoActual, setTrazoActual] = useState<string>("")
  const containerRef = useRef<HTMLDivElement>(null)

  function obtenerCoordenadas(e: React.PointerEvent<HTMLDivElement>) {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: Number((e.clientX - rect.left).toFixed(1)),
      y: Number((e.clientY - rect.top).toFixed(1)),
    }
  }

  function iniciarDibujo(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDibujando(true)
    const { x, y } = obtenerCoordenadas(e)
    setTrazoActual(`M ${x} ${y}`)
  }

  function moverDibujo(e: React.PointerEvent<HTMLDivElement>) {
    if (!dibujando) return
    const { x, y } = obtenerCoordenadas(e)
    setTrazoActual((prev) => `${prev} L ${x} ${y}`)
  }

  function finalizarDibujo() {
    if (!dibujando) return
    setDibujando(false)
    if (trazoActual) {
      const nuevosTrazos = [...trazos, trazoActual]
      setTrazos(nuevosTrazos)
      setTrazoActual("")
      notificarSVG(nuevosTrazos)
    }
  }

  function notificarSVG(listaTrazos: string[]) {
    if (listaTrazos.length === 0) {
      onChange("")
      return
    }
    const paths = listaTrazos
      .map((d) => `<path d="${d}" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join("")
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160">${paths}</svg>`
    onChange(svgStr)
  }

  function limpiar() {
    setTrazos([])
    setTrazoActual("")
    onChange("")
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        onPointerDown={iniciarDibujo}
        onPointerMove={moverDibujo}
        onPointerUp={finalizarDibujo}
        className="w-full max-w-md h-40 border-2 border-dashed border-gray-300 rounded-xl bg-white touch-none cursor-crosshair relative flex items-center justify-center select-none"
      >
        <svg viewBox="0 0 400 160" className="w-full h-full pointer-events-none">
          {trazos.map((d, idx) => (
            <path key={idx} d={d} stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {trazoActual && (
            <path d={trazoActual} stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>

        {trazos.length === 0 && !trazoActual && !valorInicial && (
          <span className="absolute text-xs font-semibold text-gray-400 pointer-events-none">
            Dibuja tu firma aquí (Mouse o Táctil)
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={limpiar}
          className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
        >
          Limpiar trazado
        </button>
      </div>

      {valorInicial && trazos.length === 0 && (
        <div className="pt-2">
          <p className="text-xs font-bold text-gray-500 mb-1">Firma actual guardada:</p>
          <div
            className="w-48 h-20 border border-gray-200 rounded-lg bg-gray-50 p-2 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: valorInicial }}
          />
        </div>
      )}
    </div>
  )
}
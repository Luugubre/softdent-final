"use client"

import { useEffect } from "react"

/** Ventana modal con encabezado oscuro. No se cierra al hacer clic afuera (para no perder lo escrito). */
export function Ventana({
  titulo,
  subtitulo,
  icono,
  ancho = "max-w-2xl",
  onClose,
  pie,
  children,
}: {
  titulo: string
  subtitulo?: string
  icono?: string
  ancho?: string
  onClose: () => void
  pie?: React.ReactNode
  children: React.ReactNode
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", esc)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", esc)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2 sm:p-4">
      <div className={`w-full ${ancho} max-h-[94vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {icono && <span className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl">{icono}</span>}
            <div className="min-w-0">
              <h2 className="text-lg font-black tracking-tight truncate">{titulo}</h2>
              {subtitulo && <p className="text-xs font-semibold text-slate-300 truncate">{subtitulo}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-white/10 font-black text-slate-300 hover:text-white">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50">{children}</div>
        {pie && <div className="shrink-0 border-t border-gray-100 bg-white px-6 py-4">{pie}</div>}
      </div>
    </div>
  )
}

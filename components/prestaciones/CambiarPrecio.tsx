"use client"

import { useState, useTransition } from "react"
import { fijarPrecio } from "@/app/prestaciones/actions"
import { hoyChile } from "@/lib/formato"

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"

export function CambiarPrecio({
  prestacionId,
  arancelId,
  arancelNombre,
}: {
  prestacionId: string
  arancelId: string
  arancelNombre: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, startTransition] = useTransition()

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = await fijarPrecio(prestacionId, arancelId, formData)
      setMensaje({ ok: res.ok, texto: res.mensaje })
      if (res.ok) setAbierto(false)
    })
  }

  if (!abierto) {
    return (
      <div className="text-right space-y-1">
        <button
          onClick={() => {
            setMensaje(null)
            setAbierto(true)
          }}
          className="px-4 py-2 rounded-xl text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          Cambiar precio
        </button>
        {mensaje && <p className={`text-xs font-semibold ${mensaje.ok ? "text-emerald-700" : "text-rose-700"}`}>{mensaje.texto}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="w-full md:w-auto md:min-w-[420px] rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-2">
      <p className="text-xs font-black uppercase tracking-wider text-blue-800">Nuevo precio · {arancelNombre}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
          <input name="precio" inputMode="numeric" placeholder="Precio" required className={`${inputClass} pl-7`} />
        </div>
        <input name="vigente_desde" type="date" defaultValue={hoyChile()} min={hoyChile()} required className={inputClass} />
      </div>
      <input name="motivo" placeholder="Motivo (ej: reajuste anual)" className={inputClass} />
      {mensaje && !mensaje.ok && <p className="text-xs font-semibold text-rose-700">{mensaje.texto}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setAbierto(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-100">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
        >
          {guardando ? "Guardando..." : "Registrar precio"}
        </button>
      </div>
    </form>
  )
}

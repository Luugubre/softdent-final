"use client"

import { useState, useTransition } from "react"
import { iniciarSesion } from "@/app/login/actions"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"

export function FormLogin({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null)
  const [cargando, startTransition] = useTransition()

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await iniciarSesion(formData)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="block text-xs font-bold text-gray-700 mb-1">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-bold text-gray-700 mb-1">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="w-full px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm"
      >
        {cargando ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  )
}

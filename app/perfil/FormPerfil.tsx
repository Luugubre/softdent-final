"use client"

import { useState, useTransition } from "react"
import { actualizarPerfil, cambiarPassword } from "./actions"
import { FirmaCanvas } from "./FirmaCanvas"

interface PerfilProps {
  perfil: {
    nombres: string
    apellidos: string
    email: string
    telefono?: string
    firma_svg?: string
    preferencias?: {
      notificaciones_email?: boolean
      tema?: string
    }
  }
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"

export function FormPerfil({ perfil }: PerfilProps) {
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [firmaSvg, setFirmaSvg] = useState<string>(perfil.firma_svg || "")
  const [cargando, startTransition] = useTransition()

  // Envío del perfil y preferencias
  function onSubmitPerfil(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setError(null)
    setExito(null)
    const formData = new FormData(ev.currentTarget)
    formData.set("firma_svg", firmaSvg)

    startTransition(async () => {
      const res = await actualizarPerfil(formData)
      if (res.error) setError(res.error)
      else setExito("Perfil actualizado correctamente.")
    })
  }

  // Envío de actualización de contraseña
  function onSubmitPassword(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setError(null)
    setExito(null)
    const form = ev.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await cambiarPassword(formData)
      if (res.error) setError(res.error)
      else {
        setExito("Contraseña cambiada exitosamente.")
        form.reset()
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Perfil de Usuario</h1>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold">
          {error}
        </div>
      )}

      {exito && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold">
          {exito}
        </div>
      )}

      {/* SECCIÓN 1: DATOS PERSONALES, FIRMA SVG Y PREFERENCIAS */}
      <form onSubmit={onSubmitPerfil} className="bg-white p-6 rounded-2xl border border-gray-200 space-y-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Información Personal</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nombres</label>
            <input name="nombres" defaultValue={perfil.nombres} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Apellidos</label>
            <input name="apellidos" defaultValue={perfil.apellidos} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Correo (Lectura)</label>
            <input value={perfil.email} disabled className={`${inputClass} bg-gray-100 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
            <input name="telefono" defaultValue={perfil.telefono} placeholder="+56 9 1234 5678" className={inputClass} />
          </div>
        </div>

        {/* FIRMA DIGITAL SVG */}
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2 pt-4">Firma Digital (SVG)</h2>
        <FirmaCanvas valorInicial={perfil.firma_svg} onChange={(svg: string) => setFirmaSvg(svg)} />

        {/* PREFERENCIAS */}
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2 pt-4">Preferencias</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="notificaciones_email"
              name="notificaciones_email"
              value="true"
              defaultChecked={perfil.preferencias?.notificaciones_email ?? true}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="notificaciones_email" className="text-sm font-medium text-gray-700">
              Recibir notificaciones por correo
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Tema de Interfaz</label>
            <select name="tema" defaultValue={perfil.preferencias?.tema ?? "light"} className={inputClass}>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
              <option value="system">Sistema</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm text-sm"
        >
          {cargando ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>

      {/* SECCIÓN 2: CAMBIO DE CONTRASEÑA */}
      <form onSubmit={onSubmitPassword} className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Cambiar Contraseña</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Contraseña Actual</label>
            <input type="password" name="password_actual" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nueva Contraseña</label>
            <input type="password" name="nueva_password" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Confirmar Contraseña</label>
            <input type="password" name="confirmar_password" required className={inputClass} />
          </div>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="px-5 py-2.5 rounded-xl font-bold text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-60 transition-colors shadow-sm text-sm"
        >
          Actualizar Contraseña
        </button>
      </form>
    </div>
  )
}
"use client"

import { useRef, useState, useTransition } from "react"
import { crearUsuario } from "@/app/usuarios/actions"
import { ROLES, ROL_DESCRIPCION, ROL_ETIQUETAS, type Rol } from "@/lib/permisos"
import { formatearRut } from "@/lib/validaciones"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-xs font-bold text-gray-700 mb-1"

export function UsuarioForm() {
  const [abierto, setAbierto] = useState(false)
  const [rol, setRol] = useState<Rol>("RECEPCIONISTA")
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string; errores?: Record<string, string> } | null>(null)
  const [guardando, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const err = resultado?.errores

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = await crearUsuario(formData)
      setResultado(res)
      if (res.ok) {
        formRef.current?.reset()
        setRol("RECEPCIONISTA")
        setAbierto(false)
      }
    })
  }

  const MensajeError = ({ campo }: { campo: string }) =>
    err?.[campo] ? <p className="mt-1 text-xs font-semibold text-rose-600">{err[campo]}</p> : null

  if (!abierto) {
    return (
      <div className="space-y-3">
        {resultado?.ok && (
          <p className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
            {resultado.mensaje}
          </p>
        )}
        <button
          onClick={() => {
            setResultado(null)
            setAbierto(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm"
        >
          + Nuevo usuario
        </button>
      </div>
    )
  }

  const esClinico = rol === "DENTISTA" || rol === "ASISTENTE"

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900">Nuevo usuario</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm font-bold text-gray-500 hover:text-gray-800">
          Cerrar ✕
        </button>
      </div>

      {resultado && !resultado.ok && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">{resultado.mensaje}</p>
      )}

      <div>
        <p className={labelClass}>Rol <span className="text-rose-600">*</span></p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {ROLES.map((r) => (
            <label
              key={r}
              className={`cursor-pointer rounded-xl border-2 p-3 transition-colors ${
                rol === r ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input type="radio" name="rol" value={r} checked={rol === r} onChange={() => setRol(r)} className="sr-only" />
              <p className="text-sm font-extrabold text-gray-900">{ROL_ETIQUETAS[r]}</p>
              <p className="text-xs font-medium text-gray-500">{ROL_DESCRIPCION[r]}</p>
            </label>
          ))}
        </div>
        <MensajeError campo="rol" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nombre_completo" className={labelClass}>Nombre completo <span className="text-rose-600">*</span></label>
          <input id="nombre_completo" name="nombre_completo" className={inputClass} />
          <MensajeError campo="nombre_completo" />
        </div>
        <div>
          <label htmlFor="rut" className={labelClass}>RUT</label>
          <input
            id="rut"
            name="rut"
            placeholder="12.345.678-9"
            onBlur={(e) => e.target.value && (e.target.value = formatearRut(e.target.value))}
            className={inputClass}
          />
          <MensajeError campo="rut" />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Correo (para iniciar sesión) <span className="text-rose-600">*</span></label>
          <input id="email" name="email" type="email" autoComplete="off" className={inputClass} />
          <MensajeError campo="email" />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>Contraseña inicial <span className="text-rose-600">*</span></label>
          <input id="password" name="password" type="text" autoComplete="new-password" placeholder="Mínimo 8 caracteres" className={inputClass} />
          <MensajeError campo="password" />
        </div>

        {esClinico && (
          <>
            <div>
              <label htmlFor="especialidad" className={labelClass}>Especialidad</label>
              <input id="especialidad" name="especialidad" placeholder="Ej: Ortodoncia, Odontología general" className={inputClass} />
            </div>
            <div>
              <label htmlFor="registro_profesional" className={labelClass}>N° registro Superintendencia de Salud</label>
              <input id="registro_profesional" name="registro_profesional" className={inputClass} />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={() => setAbierto(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm"
        >
          {guardando ? "Creando..." : "Crear usuario"}
        </button>
      </div>
    </form>
  )
}

"use client"

import { useRef, useState, useTransition } from "react"
import { actualizarPaciente, crearPaciente, type EstadoFormulario } from "@/app/pacientes/actions"
import { PREVISIONES, REFERENCIAS, SEXOS, SEXO_ETIQUETAS, calcularEdad, formatearRut } from "@/lib/validaciones"
import type { Paciente } from "@/types/paciente"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-xs font-bold text-gray-700 mb-1"

type CampoProps = {
  nombre: string
  etiqueta: string
  obligatorio?: boolean
  errores?: EstadoFormulario["errores"]
  children: React.ReactNode
}

function Campo({ nombre, etiqueta, obligatorio, errores, children }: CampoProps) {
  const error = errores?.[nombre]?.[0]
  return (
    <div>
      <label htmlFor={nombre} className={labelClass}>
        {etiqueta} {obligatorio && <span className="text-rose-600">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  )
}

type Props = {
  paciente?: Paciente
  onCerrar?: (mensaje?: string) => void
  previsiones?: readonly string[]
}

export function PacienteForm({ paciente: p, onCerrar, previsiones = PREVISIONES }: Props) {
  const editando = !!p
  const [abierto, setAbierto] = useState(editando)
  const [estado, setEstado] = useState<EstadoFormulario | null>(null)
  const [guardando, startTransition] = useTransition()
  const [extranjero, setExtranjero] = useState(p?.extranjero ?? false)
  const [fechaNacimiento, setFechaNacimiento] = useState(p?.fecha_nacimiento ?? "")
  const formRef = useRef<HTMLFormElement>(null)

  const edad = fechaNacimiento ? calcularEdad(fechaNacimiento) : null
  const esMenor = edad !== null && edad >= 0 && edad < 18
  const e = estado?.errores

  function cerrar() {
    if (editando) onCerrar?.()
    else setAbierto(false)
  }

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = p ? await actualizarPaciente(p.id, formData) : await crearPaciente(formData)
      setEstado(res)
      if (!res.ok) return

      if (editando) {
        onCerrar?.(res.mensaje)
      } else {
        formRef.current?.reset()
        setFechaNacimiento("")
        setExtranjero(false)
        setAbierto(false)
      }
    })
  }

  const formatearAlSalir = (ev: React.FocusEvent<HTMLInputElement>) => {
    if (ev.target.value) ev.target.value = formatearRut(ev.target.value)
  }

  if (!abierto) {
    return (
      <div className="space-y-3">
        {estado?.ok && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
            {estado.mensaje}
          </div>
        )}
        <button
          onClick={() => {
            setEstado(null)
            setAbierto(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          + Nuevo paciente
        </button>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-8"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900">
          {editando ? "Editar datos del paciente" : "Registrar paciente"}
        </h2>
        <button type="button" onClick={cerrar} className="text-sm font-bold text-gray-500 hover:text-gray-800">
          Cerrar ✕
        </button>
      </div>

      {estado && !estado.ok && (
        <div className="rounded-xl px-4 py-3 text-sm font-semibold border bg-rose-50 border-rose-200 text-rose-800">
          {estado.mensaje}
        </div>
      )}

      <section className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Identificación</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo nombre="rut" etiqueta={extranjero ? "Documento / Pasaporte" : "RUT"} obligatorio errores={e}>
            <input
              id="rut"
              name="rut"
              defaultValue={p ? (p.extranjero ? p.rut : formatearRut(p.rut)) : undefined}
              placeholder={extranjero ? "N° de documento" : "12.345.678-9"}
              onBlur={extranjero ? undefined : formatearAlSalir}
              className={inputClass}
            />
            <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
              <input
                type="checkbox"
                name="extranjero"
                checked={extranjero}
                onChange={(ev) => setExtranjero(ev.target.checked)}
              />
              Paciente extranjero (sin RUT)
            </label>
          </Campo>

          <Campo nombre="nombres" etiqueta="Nombres" obligatorio errores={e}>
            <input id="nombres" name="nombres" defaultValue={p?.nombres} className={inputClass} />
          </Campo>

          <Campo nombre="apellidos" etiqueta="Apellidos" obligatorio errores={e}>
            <input id="apellidos" name="apellidos" defaultValue={p?.apellidos} className={inputClass} />
          </Campo>

          <Campo nombre="nombre_social" etiqueta="Nombre social" errores={e}>
            <input
              id="nombre_social"
              name="nombre_social"
              defaultValue={p?.nombre_social ?? ""}
              placeholder="Opcional"
              className={inputClass}
            />
          </Campo>

          <Campo nombre="fecha_nacimiento" etiqueta="Fecha de nacimiento" obligatorio errores={e}>
            <input
              id="fecha_nacimiento"
              name="fecha_nacimiento"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={fechaNacimiento}
              onChange={(ev) => setFechaNacimiento(ev.target.value)}
              className={inputClass}
            />
            {edad !== null && edad >= 0 && (
              <p className="mt-1 text-xs font-semibold text-gray-500">
                {edad} año{edad === 1 ? "" : "s"}
                {esMenor && " · menor de edad"}
              </p>
            )}
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo nombre="sexo" etiqueta="Sexo" errores={e}>
              <select id="sexo" name="sexo" defaultValue={p?.sexo ?? ""} className={inputClass}>
                <option value="">—</option>
                {SEXOS.map((s) => (
                  <option key={s} value={s}>{SEXO_ETIQUETAS[s]}</option>
                ))}
              </select>
            </Campo>
            <Campo nombre="genero" etiqueta="Género" errores={e}>
              <input id="genero" name="genero" defaultValue={p?.genero ?? ""} placeholder="Opcional" className={inputClass} />
            </Campo>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Contacto</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo nombre="telefono" etiqueta="Celular" errores={e}>
            <input id="telefono" name="telefono" type="tel" defaultValue={p?.telefono ?? ""} placeholder="+56 9 1234 5678" className={inputClass} />
          </Campo>
          <Campo nombre="telefono_fijo" etiqueta="Teléfono fijo" errores={e}>
            <input id="telefono_fijo" name="telefono_fijo" type="tel" defaultValue={p?.telefono_fijo ?? ""} placeholder="Opcional" className={inputClass} />
          </Campo>
          <Campo nombre="email" etiqueta="Correo electrónico" errores={e}>
            <input id="email" name="email" type="email" defaultValue={p?.email ?? ""} placeholder="paciente@correo.cl" className={inputClass} />
          </Campo>
          <Campo nombre="direccion" etiqueta="Dirección" errores={e}>
            <input id="direccion" name="direccion" defaultValue={p?.direccion ?? ""} placeholder="Calle y número" className={inputClass} />
          </Campo>
          <Campo nombre="comuna" etiqueta="Comuna" errores={e}>
            <input id="comuna" name="comuna" defaultValue={p?.comuna ?? ""} className={inputClass} />
          </Campo>
          <Campo nombre="ciudad" etiqueta="Ciudad" errores={e}>
            <input id="ciudad" name="ciudad" defaultValue={p?.ciudad ?? ""} className={inputClass} />
          </Campo>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Previsión y otros datos</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Campo nombre="prevision" etiqueta="Previsión" obligatorio errores={e}>
            <select id="prevision" name="prevision" defaultValue={p?.prevision ?? "Particular"} className={inputClass}>
              {p?.prevision && !previsiones.includes(p.prevision) && (
                <option value={p.prevision}>{p.prevision}</option>
              )}
              {previsiones.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </Campo>
          <Campo nombre="actividad_profesion" etiqueta="Actividad / profesión" errores={e}>
            <input id="actividad_profesion" name="actividad_profesion" defaultValue={p?.actividad_profesion ?? ""} className={inputClass} />
          </Campo>
          <Campo nombre="empleador" etiqueta="Empleador" errores={e}>
            <input id="empleador" name="empleador" defaultValue={p?.empleador ?? ""} className={inputClass} />
          </Campo>
          <Campo nombre="referencia" etiqueta="¿Cómo nos conoció?" errores={e}>
            <select id="referencia" name="referencia" defaultValue={p?.referencia ?? ""} className={inputClass}>
              <option value="">—</option>
              {p?.referencia && !(REFERENCIAS as readonly string[]).includes(p.referencia) && (
                <option value={p.referencia}>{p.referencia}</option>
              )}
              {REFERENCIAS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Campo>
        </div>
      </section>

      {esMenor && (
        <section className="space-y-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-amber-800">
            Apoderado · obligatorio para menores de 18 años
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Campo nombre="apoderado_nombre" etiqueta="Nombre completo" obligatorio errores={e}>
              <input id="apoderado_nombre" name="apoderado_nombre" defaultValue={p?.apoderado_nombre ?? ""} className={inputClass} />
            </Campo>
            <Campo nombre="apoderado_rut" etiqueta="RUT" obligatorio errores={e}>
              <input
                id="apoderado_rut"
                name="apoderado_rut"
                defaultValue={p?.apoderado_rut ? formatearRut(p.apoderado_rut) : ""}
                placeholder="12.345.678-9"
                onBlur={formatearAlSalir}
                className={inputClass}
              />
            </Campo>
            <Campo nombre="apoderado_telefono" etiqueta="Teléfono" errores={e}>
              <input id="apoderado_telefono" name="apoderado_telefono" type="tel" defaultValue={p?.apoderado_telefono ?? ""} className={inputClass} />
            </Campo>
          </div>
        </section>
      )}

      <Campo nombre="observaciones" etiqueta="Observaciones" errores={e}>
        <textarea
          id="observaciones"
          name="observaciones"
          rows={3}
          defaultValue={p?.observaciones ?? ""}
          placeholder="Información administrativa relevante (no clínica)"
          className={inputClass}
        />
      </Campo>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={cerrar}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm"
        >
          {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar paciente"}
        </button>
      </div>
    </form>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { actualizarPrestacion, crearPrestacion, type Resultado } from "@/app/prestaciones/actions"
import type { Arancel, ItemCatalogo, Prestacion } from "@/types/prestacion"
import { IconoMuestra } from "@/lib/iconos-dentales"
import { ICONOS_PRESTACION } from "@/lib/iconos-datos"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-xs font-bold text-gray-700 mb-1"

function Campo({
  nombre,
  etiqueta,
  obligatorio,
  errores,
  children,
}: {
  nombre: string
  etiqueta: string
  obligatorio?: boolean
  errores?: Record<string, string>
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={nombre} className={labelClass}>
        {etiqueta} {obligatorio && <span className="text-rose-600">*</span>}
      </label>
      {children}
      {errores?.[nombre] && <p className="mt-1 text-xs font-semibold text-rose-600">{errores[nombre]}</p>}
    </div>
  )
}

type Props = {
  aranceles: Arancel[]
  categorias: ItemCatalogo[]
  especialidades: ItemCatalogo[]
  /** Si viene, el formulario edita esta prestación */
  prestacion?: Prestacion
  onCerrar?: () => void
}

export function PrestacionForm({ aranceles, categorias, especialidades, prestacion: p, onCerrar }: Props) {
  const editando = !!p
  const router = useRouter()
  const [abierto, setAbierto] = useState(editando)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [guardando, startTransition] = useTransition()
  const [icono, setIcono] = useState(p?.icono ?? "")
  const e = resultado?.errores

  function cerrar() {
    if (editando) onCerrar?.()
    else setAbierto(false)
  }

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = p ? await actualizarPrestacion(p.id, formData) : await crearPrestacion(formData)
      setResultado(res)
      if (res.ok) {
        if (editando) onCerrar?.()
        else if (res.id) router.push(`/prestaciones/${res.id}`)
      } else if (res.id) {
        router.push(`/prestaciones/${res.id}`)
      }
    })
  }

  if (!abierto) {
    return (
      <button
        onClick={() => {
          setResultado(null)
          setAbierto(true)
        }}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm"
      >
        + Nueva prestación
      </button>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900">{editando ? "Editar prestación" : "Nueva prestación"}</h2>
        <button type="button" onClick={cerrar} className="text-sm font-bold text-gray-500 hover:text-gray-800">
          Cerrar ✕
        </button>
      </div>

      {resultado && !resultado.ok && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">{resultado.mensaje}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Campo nombre="codigo_interno" etiqueta="Código interno" obligatorio errores={e}>
          <input
            id="codigo_interno"
            name="codigo_interno"
            defaultValue={p?.codigo_interno}
            placeholder="OP-001"
            className={`${inputClass} uppercase font-mono`}
          />
        </Campo>
        <Campo nombre="codigo_fonasa" etiqueta="Código FONASA" errores={e}>
          <input
            id="codigo_fonasa"
            name="codigo_fonasa"
            defaultValue={p?.codigo_fonasa ?? ""}
            placeholder="7 dígitos (opcional)"
            inputMode="numeric"
            maxLength={7}
            className={`${inputClass} font-mono`}
          />
        </Campo>
        <div className="md:col-span-2">
          <Campo nombre="nombre" etiqueta="Nombre" obligatorio errores={e}>
            <input id="nombre" name="nombre" defaultValue={p?.nombre} placeholder="Ej: Restauración de resina compuesta" className={inputClass} />
          </Campo>
        </div>

        <Campo nombre="categoria_id" etiqueta="Categoría" obligatorio errores={e}>
          <select id="categoria_id" name="categoria_id" defaultValue={p?.categoria_id ?? ""} className={inputClass}>
            <option value="" disabled>Selecciona...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo nombre="especialidad_id" etiqueta="Especialidad" errores={e}>
          <select id="especialidad_id" name="especialidad_id" defaultValue={p?.especialidad_id ?? ""} className={inputClass}>
            <option value="">— Sin especialidad —</option>
            {especialidades.map((x) => (
              <option key={x.id} value={x.id}>{x.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo nombre="duracion_min" etiqueta="Duración (minutos)" obligatorio errores={e}>
          <input
            id="duracion_min"
            name="duracion_min"
            type="number"
            min={5}
            max={480}
            step={5}
            defaultValue={p?.duracion_min ?? 30}
            className={inputClass}
          />
        </Campo>
        <div className="md:col-span-1" />

        {/* Ícono que se dibuja en el odontograma */}
        <div className="md:col-span-4">
          <p className={labelClass}>Ícono en el odontograma</p>
          <input type="hidden" name="icono" value={icono} />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setIcono("")}
              className={`px-3 py-1.5 rounded-xl border-2 text-xs font-bold ${
                icono === "" ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              Automático (según nombre)
            </button>
            {ICONOS_PRESTACION.map((ic) => (
              <button
                key={ic.id}
                type="button"
                title={ic.etiqueta}
                onClick={() => setIcono(ic.id)}
                className={`flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-xl border-2 text-[11px] font-bold ${
                  icono === ic.id ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <IconoMuestra tipo={ic.id} color="#f59e0b" size={18} />
                {ic.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-4">
          <Campo nombre="descripcion" etiqueta="Descripción" errores={e}>
            <textarea id="descripcion" name="descripcion" rows={2} defaultValue={p?.descripcion ?? ""} className={inputClass} />
          </Campo>
        </div>
      </div>

      {/* Precios iniciales (solo al crear; después se cambian en la ficha de la prestación) */}
      {!editando && (
        <section className="space-y-3 rounded-2xl bg-gray-50 border border-gray-200 p-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Precios iniciales (vigentes desde hoy)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aranceles.map((a) => (
              <Campo
                key={a.id}
                nombre={`precio_${a.id}`}
                etiqueta={`${a.nombre}${a.es_base ? " (base)" : ""}`}
                obligatorio={a.es_base}
                errores={e}
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                  <input
                    id={`precio_${a.id}`}
                    name={`precio_${a.id}`}
                    inputMode="numeric"
                    placeholder={a.porcentaje_descuento > 0 ? `Auto: base -${a.porcentaje_descuento}%` : "0"}
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </Campo>
            ))}
          </div>
          <p className="text-xs font-medium text-gray-500">
            Deja en blanco los aranceles donde no se ofrece la prestación. Los convenios con descuento usan el precio base menos su
            porcentaje si no les pones un precio especial.
          </p>
        </section>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={cerrar} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm"
        >
          {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear prestación"}
        </button>
      </div>
    </form>
  )
}

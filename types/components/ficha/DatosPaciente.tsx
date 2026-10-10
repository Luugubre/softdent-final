"use client"

import { useState } from "react"
import { PacienteForm } from "@/components/PacienteForm"
import { SEXO_ETIQUETAS, calcularEdad, formatearRut } from "@/lib/validaciones"
import { formatearFecha, formatearFechaHora } from "@/lib/formato"
import type { Paciente } from "@/types/paciente"

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold text-gray-500 uppercase tracking-wide">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-900 break-words">{valor || "—"}</dd>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">{titulo}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">{children}</dl>
    </section>
  )
}

export function DatosPaciente({ paciente: p, puedeEditar = true }: { paciente: Paciente; puedeEditar?: boolean }) {
  const [editando, setEditando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  if (editando) {
    return (
      <PacienteForm
        paciente={p}
        onCerrar={(msg) => {
          setEditando(false)
          setMensaje(msg ?? null)
        }}
      />
    )
  }

  const edad = calcularEdad(p.fecha_nacimiento)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-extrabold text-gray-900">Datos personales</h2>
        {puedeEditar && (
        <button
          onClick={() => {
            setMensaje(null)
            setEditando(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-sm"
        >
          Editar datos
        </button>
        )}
      </div>

      {mensaje && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
          {mensaje}
        </div>
      )}

      <Seccion titulo="Identificación">
        <Dato
          etiqueta={p.extranjero ? "Documento (extranjero)" : "RUT"}
          valor={p.extranjero ? p.rut : formatearRut(p.rut)}
        />
        <Dato etiqueta="Nombres" valor={p.nombres} />
        <Dato etiqueta="Apellidos" valor={p.apellidos} />
        <Dato etiqueta="Nombre social" valor={p.nombre_social} />
        <Dato
          etiqueta="Fecha de nacimiento"
          valor={`${formatearFecha(p.fecha_nacimiento)}${edad !== null ? ` (${edad} años)` : ""}`}
        />
        <Dato etiqueta="Sexo" valor={p.sexo ? SEXO_ETIQUETAS[p.sexo] : null} />
        <Dato etiqueta="Género" valor={p.genero} />
      </Seccion>

      <Seccion titulo="Contacto">
        <Dato etiqueta="Celular" valor={p.telefono} />
        <Dato etiqueta="Teléfono fijo" valor={p.telefono_fijo} />
        <Dato etiqueta="Correo" valor={p.email} />
        <Dato etiqueta="Dirección" valor={p.direccion} />
        <Dato etiqueta="Comuna" valor={p.comuna} />
        <Dato etiqueta="Ciudad" valor={p.ciudad} />
      </Seccion>

      <Seccion titulo="Previsión y otros datos">
        <Dato etiqueta="Previsión" valor={p.prevision} />
        <Dato etiqueta="Actividad / profesión" valor={p.actividad_profesion} />
        <Dato etiqueta="Empleador" valor={p.empleador} />
        <Dato etiqueta="¿Cómo nos conoció?" valor={p.referencia} />
      </Seccion>

      {(p.apoderado_nombre || p.apoderado_rut) && (
        <Seccion titulo="Apoderado">
          <Dato etiqueta="Nombre" valor={p.apoderado_nombre} />
          <Dato etiqueta="RUT" valor={p.apoderado_rut ? formatearRut(p.apoderado_rut) : null} />
          <Dato etiqueta="Teléfono" valor={p.apoderado_telefono} />
        </Seccion>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Observaciones</h3>
        <p className="text-sm font-medium text-gray-800 whitespace-pre-line">{p.observaciones || "—"}</p>
      </section>

      <p className="text-xs text-gray-400 font-medium border-t border-gray-100 pt-4">
        Registrado el {formatearFechaHora(p.created_at)} · Última modificación {formatearFechaHora(p.updated_at)}
      </p>
    </div>
  )
}

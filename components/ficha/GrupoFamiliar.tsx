"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { asignarTitular, quitarTitular } from "@/app/pacientes/[id]/actions"
import { calcularEdad, formatearRut } from "@/lib/validaciones"

export type PacienteResumen = {
  id: string
  rut: string
  nombres: string
  apellidos: string
  fecha_nacimiento: string
  activo: boolean
}

function FilaPaciente({ p, accion }: { p: PacienteResumen; accion?: React.ReactNode }) {
  const edad = calcularEdad(p.fecha_nacimiento)
  return (
    <li className="py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-extrabold text-gray-900">
          {p.nombres} {p.apellidos}
          {!p.activo && <span className="ml-2 text-xs font-bold text-gray-400">(inactivo)</span>}
        </p>
        <p className="text-xs font-mono font-semibold text-gray-500">
          {formatearRut(p.rut)}
          {edad !== null && ` · ${edad} años`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {accion}
        <Link
          href={`/pacientes/${p.id}`}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-xl hover:bg-blue-700 font-bold text-xs shadow-sm"
        >
          Ver ficha →
        </Link>
      </div>
    </li>
  )
}

export function GrupoFamiliar({
  pacienteId,
  titular,
  cargas,
  puedeEditar = true,
}: {
  pacienteId: string
  titular: PacienteResumen | null
  cargas: PacienteResumen[]
  puedeEditar?: boolean
}) {
  const [rut, setRut] = useState("")
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  function onAsignar(ev: React.FormEvent) {
    ev.preventDefault()
    startTransition(async () => {
      const res = await asignarTitular(pacienteId, rut)
      setMensaje({ ok: res.ok, texto: res.mensaje })
      if (res.ok) setRut("")
    })
  }

  function onQuitar() {
    if (!titular || !window.confirm("¿Desvincular a este paciente de su titular?")) return
    startTransition(async () => {
      const res = await quitarTitular(pacienteId, titular.id)
      setMensaje({ ok: res.ok, texto: res.mensaje })
    })
  }

  return (
    <div className="space-y-6">
      {mensaje && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
            mensaje.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-extrabold text-gray-900">Titular</h2>

        {titular ? (
          <ul>
            <FilaPaciente
              p={titular}
              accion={
                puedeEditar && (
                <button
                  onClick={onQuitar}
                  disabled={pendiente}
                  className="text-xs font-bold text-gray-500 hover:text-rose-600"
                >
                  Desvincular
                </button>
                )
              }
            />
          </ul>
        ) : cargas.length > 0 ? (
          <p className="text-sm font-medium text-gray-600">
            Este paciente es <strong>titular</strong> de {cargas.length} carga{cargas.length === 1 ? "" : "s"}, por lo
            que no puede ser carga de otro paciente.
          </p>
        ) : !puedeEditar ? (
          <p className="text-sm font-medium text-gray-400">Sin titular asignado.</p>
        ) : (
          <form onSubmit={onAsignar} className="space-y-2">
            <p className="text-sm font-medium text-gray-600">
              Si este paciente es carga familiar (hijo/a, cónyuge…), ingresa el RUT del titular. El titular debe estar
              registrado como paciente.
            </p>
            <div className="flex gap-2 max-w-md">
              <input
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                onBlur={() => rut && setRut(formatearRut(rut))}
                placeholder="RUT del titular"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={pendiente || !rut}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm whitespace-nowrap"
              >
                {pendiente ? "..." : "Asignar"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-2">
        <h2 className="text-xl font-extrabold text-gray-900">Cargas familiares</h2>
        {cargas.length === 0 ? (
          <p className="text-sm text-gray-400 font-medium">
            Sin cargas. Para agregar una, abre la ficha de la carga y asígnale este paciente como titular.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {cargas.map((c) => (
              <FilaPaciente key={c.id} p={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

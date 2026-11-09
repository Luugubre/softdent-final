"use client"

import { useState } from "react"
import { VARIABLES_DISPONIBLES, procesarPlantilla } from "@/lib/plantillas"
import { guardarPlantilla, cargarPlantillasBase } from "./actions"

export type PlantillaBD = {
  id: string
  tipo: string
  nombre: string
  contenido: string
  version: number
  activa: boolean
  updated_at: string
}

type Props = {
  plantillas: PlantillaBD[]
  esAdmin: boolean
}

export default function GestionPlantillasClient({ plantillas, esAdmin }: Props) {
  const [plantillaSel, setPlantillaSel] = useState<PlantillaBD | null>(plantillas[0] ?? null)
  const [nombre, setNombre] = useState(plantillas[0]?.nombre ?? "")
  const [contenido, setContenido] = useState(plantillas[0]?.contenido ?? "")
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null)

  // Datos de prueba para la previsualización en vivo
  const datosPrueba = {
    paciente: { nombre: "Alexis Romero Soto", rut: "20.793.934-K", edad: 28 },
    profesional: { nombre: "Dra. Dentista Ejemplo", registro: "32323" },
    clinica: { nombre: "Clínica Odontológica SoftDent" },
    fecha: new Date().toLocaleDateString("es-CL"),
    prestaciones: "Exodoncia pieza 1.8 e Implante en pieza 3.6",
  }

  const seleccionarPlantilla = (p: PlantillaBD) => {
    setPlantillaSel(p)
    setNombre(p.nombre)
    setContenido(p.contenido)
    setMensaje(null)
  }

  const insertarVariable = (variableClave: string) => {
    setContenido((prev) => prev + " " + variableClave)
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plantillaSel) return
    if (!esAdmin) {
      setMensaje({ tipo: "error", texto: "Solo el ADMINISTRADOR puede modificar las plantillas." })
      return
    }

    setCargando(true)
    setMensaje(null)

    const res = await guardarPlantilla({
      tipo: plantillaSel.tipo,
      nombre,
      contenido,
    })

    setCargando(false)

    if (res.error) {
      setMensaje({ tipo: "error", texto: res.error })
    } else {
      setMensaje({
        tipo: "exito",
        texto: `¡Plantilla guardada con éxito! Se creó la Versión ${res.version}.`,
      })
    }
  }

  const handleInicializarBase = async () => {
    setCargando(true)
    setMensaje(null)
    const res = await cargarPlantillasBase()
    setCargando(false)

    if (res.error) {
      setMensaje({ tipo: "error", texto: res.error })
    } else {
      setMensaje({ tipo: "exito", texto: "Se han cargado las 6 plantillas base obligatorias." })
    }
  }

  return (
    <div className="space-y-6">
      {/* Botón de Cargar Plantillas Base si no hay plantillas */}
      {plantillas.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm font-bold text-amber-900">
            No se han registrado plantillas de consentimientos en la base de datos.
          </p>
          {esAdmin && (
            <button
              onClick={handleInicializarBase}
              disabled={cargando}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-amber-700 shadow-md transition-all"
            >
              {cargando ? "Cargando..." : "⚡ Cargar las 6 Plantillas Base Obligatorias"}
            </button>
          )}
        </div>
      )}

      {mensaje && (
        <div
          className={`p-4 rounded-xl border text-xs font-bold ${
            mensaje.tipo === "exito"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Columna Izquierda: Lista de Plantillas */}
        <div className="space-y-2 lg:col-span-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-500">Documentos Activos</h2>
          <div className="space-y-1.5">
            {plantillas.map((p) => {
              const activa = plantillaSel?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => seleccionarPlantilla(p)}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all ${
                    activa
                      ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold truncate">{p.nombre}</span>
                    <span className="ml-2 shrink-0 px-2 py-0.5 text-[10px] font-black rounded-full bg-blue-100 text-blue-700">
                      v{p.version}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Tipo: {p.tipo}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Columna Central y Derecha: Editor y Previsualización */}
        {plantillaSel ? (
          <div className="lg:col-span-3 space-y-6">
            <form onSubmit={handleGuardar} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Editando: {plantillaSel.nombre}
                  </h3>
                  <p className="text-xs font-medium text-gray-500">
                    Versión activa actual: <strong className="text-blue-600">v{plantillaSel.version}</strong>
                  </p>
                </div>
                {esAdmin && (
                  <button
                    type="submit"
                    disabled={cargando}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700 shadow-md transition-all disabled:opacity-50"
                  >
                    {cargando ? "Guardando..." : "💾 Guardar Nueva Versión"}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Documento</label>
                <input
                  type="text"
                  required
                  disabled={!esAdmin}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Botones de inserción de variables */}
              {esAdmin && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">
                    Insertar Variable (haz clic para agregar al texto):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES_DISPONIBLES.map((v) => (
                      <button
                        key={v.clave}
                        type="button"
                        onClick={() => insertarVariable(v.clave)}
                        title={v.descripcion}
                        className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      >
                        {v.clave}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Editor de Contenido */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contenido de la Plantilla</label>
                <textarea
                  required
                  rows={10}
                  disabled={!esAdmin}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </form>

            {/* Previsualización en Tiempo Real */}
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">
                👁️ Previsualización con datos de muestra
              </h4>
              <div className="bg-white p-6 rounded-xl border border-gray-300 font-sans text-xs whitespace-pre-wrap leading-relaxed shadow-inner text-gray-800">
                {procesarPlantilla(contenido, datosPrueba)}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 bg-white p-10 text-center rounded-2xl border text-sm text-gray-400">
            Selecciona una plantilla del listado para editar o previsualizar.
          </div>
        )}
      </div>
    </div>
  )
}
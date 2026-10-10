"use client"

import { useRef, useState, useTransition } from "react"
import { subirArchivo } from "@/app/pacientes/[id]/actions"
import {
  CATEGORIAS_ARCHIVO,
  CATEGORIA_ARCHIVO_ETIQUETAS,
  TAMANO_MAXIMO_BYTES,
  TIPOS_PERMITIDOS,
} from "@/types/archivo"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-xs font-bold text-gray-700 mb-1"

export function SubirArchivo({ pacienteId }: { pacienteId: string }) {
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [subiendo, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function onArchivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const archivo = ev.target.files?.[0]
    setMensaje(null)
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia)
    setVistaPrevia(null)
    if (!archivo) return

    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setMensaje({ ok: false, texto: "El archivo supera los 10 MB." })
      ev.target.value = ""
      return
    }
    if (archivo.type.startsWith("image/")) setVistaPrevia(URL.createObjectURL(archivo))

    // Sugerir título a partir del nombre del archivo
    const titulo = formRef.current?.elements.namedItem("titulo") as HTMLInputElement | null
    if (titulo && !titulo.value) titulo.value = archivo.name.replace(/\.[^.]+$/, "")
  }

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = await subirArchivo(pacienteId, formData)
      setMensaje({ ok: res.ok, texto: res.mensaje })
      if (res.ok) {
        formRef.current?.reset()
        if (vistaPrevia) URL.revokeObjectURL(vistaPrevia)
        setVistaPrevia(null)
      }
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4"
    >
      <h2 className="text-xl font-extrabold text-gray-900">Subir radiografía o archivo</h2>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="archivo" className={labelClass}>
                Archivo <span className="text-rose-600">*</span>
              </label>
              <input
                id="archivo"
                name="archivo"
                type="file"
                accept={TIPOS_PERMITIDOS.join(",")}
                onChange={onArchivo}
                required
                className="block w-full text-sm font-medium text-gray-700 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-[11px] font-medium text-gray-400">JPG, PNG, WEBP o PDF · máximo 10 MB</p>
            </div>
            <div>
              <label htmlFor="categoria" className={labelClass}>
                Categoría <span className="text-rose-600">*</span>
              </label>
              <select id="categoria" name="categoria" defaultValue="RADIOGRAFIA" className={inputClass}>
                {CATEGORIAS_ARCHIVO.map((c) => (
                  <option key={c} value={c}>{CATEGORIA_ARCHIVO_ETIQUETAS[c]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="titulo" className={labelClass}>
                Título <span className="text-rose-600">*</span>
              </label>
              <input id="titulo" name="titulo" placeholder="Ej: Panorámica inicial" className={inputClass} />
            </div>
            <div>
              <label htmlFor="descripcion" className={labelClass}>Descripción</label>
              <input id="descripcion" name="descripcion" placeholder="Opcional" className={inputClass} />
            </div>
          </div>
        </div>

        {vistaPrevia && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vistaPrevia} alt="Vista previa" className="h-36 w-36 rounded-xl object-cover border border-gray-200" />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <p className={`text-sm font-semibold ${mensaje?.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {mensaje?.texto}
        </p>
        <button
          type="submit"
          disabled={subiendo}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 shadow-sm whitespace-nowrap"
        >
          {subiendo ? "Subiendo..." : "Subir archivo"}
        </button>
      </div>
    </form>
  )
}

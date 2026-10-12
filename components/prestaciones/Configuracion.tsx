"use client"

import { useRef, useState, useTransition } from "react"
import {
  cambiarEstadoArancel,
  cambiarEstadoItemCatalogo,
  crearArancel,
  crearItemCatalogo,
} from "@/app/prestaciones/actions"
import { TIPOS_ARANCEL, TIPO_ARANCEL_ETIQUETAS, type TipoArancel } from "@/types/prestacion"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"

export function ArancelForm() {
  const [tipo, setTipo] = useState<TipoArancel>("CONVENIO")
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const formData = new FormData(ev.currentTarget)
    startTransition(async () => {
      const res = await crearArancel(formData)
      setMensaje({ ok: res.ok, texto: res.mensaje })
      if (res.ok) formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
      <p className="text-xs font-black uppercase tracking-wider text-blue-700">Nuevo arancel</p>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_140px_1fr_auto] gap-2 items-start">
        <input name="nombre" placeholder="Nombre (ej: Convenio Sindicato X)" className={inputClass} />
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoArancel)} className={inputClass}>
          {TIPOS_ARANCEL.map((t) => (
            <option key={t} value={t}>{TIPO_ARANCEL_ETIQUETAS[t]}</option>
          ))}
        </select>
        <div className="relative">
          <input
            name="porcentaje_descuento"
            inputMode="decimal"
            placeholder="Descuento"
            disabled={tipo !== "CONVENIO"}
            className={`${inputClass} pr-7 disabled:bg-gray-100`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</span>
        </div>
        <input name="descripcion" placeholder="Descripción (opcional)" className={inputClass} />
        <button
          type="submit"
          disabled={guardando}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
        >
          {guardando ? "..." : "Crear"}
        </button>
      </div>
      {mensaje && <p className={`text-sm font-semibold ${mensaje.ok ? "text-emerald-700" : "text-rose-700"}`}>{mensaje.texto}</p>}
    </form>
  )
}

export function BotonEstadoArancel({ id, activo }: { id: string; activo: boolean }) {
  const [cargando, startTransition] = useTransition()
  return (
    <button
      disabled={cargando}
      onClick={() =>
        startTransition(async () => {
          const res = await cambiarEstadoArancel(id)
          if (!res.ok) alert(res.mensaje)
        })
      }
      className={`text-xs font-bold hover:underline disabled:opacity-50 ${activo ? "text-emerald-700" : "text-gray-500"}`}
    >
      {cargando ? "..." : activo ? "Activo · desactivar" : "Inactivo · activar"}
    </button>
  )
}

type Catalogo = "categoria" | "especialidad"

export function NuevoItemCatalogo({ catalogo }: { catalogo: Catalogo }) {
  const [nombre, setNombre] = useState("")
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    startTransition(async () => {
      const res = await crearItemCatalogo(catalogo, nombre)
      setMensaje(res.ok ? null : res.mensaje)
      if (res.ok) setNombre("")
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <div className="flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={catalogo === "categoria" ? "Nueva categoría" : "Nueva especialidad"}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={guardando || !nombre.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
      {mensaje && <p className="text-xs font-semibold text-rose-700">{mensaje}</p>}
    </form>
  )
}

export function BotonEstadoCatalogo({ catalogo, id, activo }: { catalogo: Catalogo; id: string; activo: boolean }) {
  const [cargando, startTransition] = useTransition()
  return (
    <button
      disabled={cargando}
      onClick={() =>
        startTransition(async () => {
          const res = await cambiarEstadoItemCatalogo(catalogo, id)
          if (!res.ok) alert(res.mensaje)
        })
      }
      className={`text-xs font-bold hover:underline disabled:opacity-50 ${activo ? "text-gray-500" : "text-emerald-700"}`}
    >
      {cargando ? "..." : activo ? "Desactivar" : "Activar"}
    </button>
  )
}

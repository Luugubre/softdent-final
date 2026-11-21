"use client"

import { useState, useTransition } from "react"
import { formatearPesos } from "@/lib/formato"
import { guardarPackPrestaciones, cambiarEstadoPack, type ItemPackInput } from "@/app/prestaciones/packs/actions"

export type PrestacionOpcion = {
  id: string
  codigo_interno: string
  nombre: string
  duracion_min: number
  precio_base: number
}

export type PackConItems = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  items: {
    id: string
    prestacion_id: string
    cantidad: number
    precio_pack: number | null
    nota: string | null
    orden: number
    prestacion: {
      id: string
      codigo_interno: string
      nombre: string
      duracion_min: number
      activo: boolean
    } | null
  }[]
}

type Props = {
  packs: PackConItems[]
  prestaciones: PrestacionOpcion[]
  puedeGestionar: boolean
}

export function GestionPacksClient({ packs, prestaciones, puedeGestionar }: Props) {
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [itemsForm, setItemsForm] = useState<ItemPackInput[]>([])

  const [busquedaPrest, setBusquedaPrest] = useState("")
  const [prestacionSelId, setPrestacionSelId] = useState(prestaciones[0]?.id ?? "")
  const [cantidadAdd, setCantidadAdd] = useState(1)
  const [precioPackAdd, setPrecioPackAdd] = useState("")
  const [notaAdd, setNotaAdd] = useState("")

  const [feedback, setFeedback] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  const prestacionesFiltradas = prestaciones.filter((p) => {
    if (!busquedaPrest.trim()) return true
    const q = busquedaPrest.toLowerCase()
    return p.nombre.toLowerCase().includes(q) || p.codigo_interno.toLowerCase().includes(q)
  })

  const abrirNuevo = () => {
    setEditandoId(null)
    setNombre("")
    setDescripcion("")
    setItemsForm([])
    setFeedback(null)
    setMostrarForm(true)
  }

  const abrirEdicion = (pack: PackConItems) => {
    setEditandoId(pack.id)
    setNombre(pack.nombre)
    setDescripcion(pack.descripcion ?? "")
    setItemsForm(
      pack.items.map((it) => ({
        prestacion_id: it.prestacion_id,
        cantidad: it.cantidad,
        precio_pack: it.precio_pack,
        nota: it.nota ?? "",
      }))
    )
    setFeedback(null)
    setMostrarForm(true)
  }

  const agregarPrestacionAlForm = () => {
    const idTarget = prestacionSelId || prestacionesFiltradas[0]?.id
    if (!idTarget) return

    const precioNum = precioPackAdd.replace(/[^\d]/g, "")
    setItemsForm((prev) => [
      ...prev,
      {
        prestacion_id: idTarget,
        cantidad: Math.max(1, cantidadAdd),
        precio_pack: precioNum ? Number(precioNum) : null,
        nota: notaAdd,
      },
    ])
    setCantidadAdd(1)
    setPrecioPackAdd("")
    setNotaAdd("")
  }

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    startTransition(async () => {
      const res = await guardarPackPrestaciones({
        id: editandoId ?? undefined,
        nombre,
        descripcion,
        items: itemsForm,
      })
      setFeedback({ ok: res.ok, texto: res.mensaje })
      if (res.ok) {
        setMostrarForm(false)
        setEditandoId(null)
      }
    })
  }

  const handleToggleEstado = (packId: string) => {
    startTransition(async () => {
      const res = await cambiarEstadoPack(packId)
      setFeedback({ ok: res.ok, texto: res.mensaje })
    })
  }

  const mapaPrest = new Map(prestaciones.map((p) => [p.id, p]))

  const totalReferencialForm = itemsForm.reduce((acc, it) => {
    const p = mapaPrest.get(it.prestacion_id)
    const unitario = it.precio_pack ?? p?.precio_base ?? 0
    return acc + unitario * it.cantidad
  }, 0)

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-bold ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.texto}
        </div>
      )}

      {puedeGestionar && !mostrarForm && (
        <div>
          <button
            type="button"
            onClick={abrirNuevo}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700 shadow-sm"
          >
            ➕ Nuevo pack de prestaciones
          </button>
        </div>
      )}

      {/* Formulario de Creación / Edición de Pack */}
      {puedeGestionar && mostrarForm && (
        <form onSubmit={handleGuardar} className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-lg font-extrabold text-gray-900">
              {editandoId ? "✏️ Editar pack de prestaciones" : "📦 Crear nuevo pack de prestaciones"}
            </h2>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="text-xs font-bold text-gray-500 hover:text-gray-800"
            >
              Cancelar ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Pack *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Pack Higiene + Diagnóstico Completo"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Descripción comercial (opcional)</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Incluye destartraje supragingival, profilaxis y fluoración"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Selector para agregar prestaciones al pack */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-black uppercase text-gray-600">Agregar prestación al pack</p>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              <div className="md:col-span-5">
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Prestación</label>
                <input
                  type="text"
                  value={busquedaPrest}
                  onChange={(e) => setBusquedaPrest(e.target.value)}
                  placeholder="Filtrar por código o nombre..."
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs bg-white mb-1"
                />
                <select
                  value={prestacionSelId}
                  onChange={(e) => setPrestacionSelId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs font-semibold bg-white"
                >
                  {prestacionesFiltradas.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.codigo_interno}] {p.nombre} ({formatearPesos(p.precio_base)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={cantidadAdd}
                  onChange={(e) => setCantidadAdd(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs font-bold bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Precio Pack ($)</label>
                <input
                  type="text"
                  value={precioPackAdd}
                  onChange={(e) => setPrecioPackAdd(e.target.value)}
                  placeholder="Auto (arancel)"
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs bg-white"
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="button"
                  onClick={agregarPrestacionAlForm}
                  className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                >
                  + Añadir al pack
                </button>
              </div>
            </div>
          </div>

          {/* Listado de items del pack en edición */}
          {itemsForm.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-[11px] font-bold uppercase text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Prestación</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-right">Valor Unit.</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itemsForm.map((it, idx) => {
                    const p = mapaPrest.get(it.prestacion_id)
                    const unitario = it.precio_pack ?? p?.precio_base ?? 0
                    return (
                      <tr key={`${it.prestacion_id}-${idx}`}>
                        <td className="px-3 py-2 font-bold text-gray-900">
                          [{p?.codigo_interno}] {p?.nombre}
                        </td>
                        <td className="px-3 py-2 text-center font-bold">{it.cantidad}</td>
                        <td className="px-3 py-2 text-right">
                          {it.precio_pack ? (
                            <span className="font-extrabold text-emerald-700">
                              {formatearPesos(it.precio_pack)} (Fijo)
                            </span>
                          ) : (
                            <span className="text-gray-500">{formatearPesos(unitario)} (Arancel)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-gray-900">
                          {formatearPesos(unitario * it.cantidad)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setItemsForm((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-rose-600 font-bold hover:underline"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-black text-gray-700">
                      TOTAL REFERENCIAL DEL PACK:
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-black text-blue-700">
                      {formatearPesos(totalReferencialForm)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendiente || itemsForm.length === 0}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pendiente ? "Guardando..." : "💾 Guardar Pack"}
            </button>
          </div>
        </form>
      )}

      {/* Tarjetas de Packs Creados */}
      {packs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm font-semibold text-gray-400">
          Aún no hay packs de prestaciones creados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {packs.map((pack) => {
            const totalPack = pack.items.reduce((s, it) => {
              const pBase = mapaPrest.get(it.prestacion_id)?.precio_base ?? 0
              return s + (it.precio_pack ?? pBase) * it.cantidad
            }, 0)

            return (
              <div
                key={pack.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm flex flex-col justify-between space-y-4 ${
                  pack.activo ? "border-gray-200" : "border-gray-200 opacity-60"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900">{pack.nombre}</h3>
                      {pack.descripcion && <p className="text-xs text-gray-500 mt-0.5">{pack.descripcion}</p>}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        pack.activo ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {pack.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <ul className="divide-y divide-gray-100 border-t border-b border-gray-100 py-1 text-xs">
                    {pack.items.map((it) => (
                      <li key={it.id} className="py-1.5 flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-800">
                          <strong className="text-blue-600">{it.cantidad}x</strong>{" "}
                          {it.prestacion?.nombre ?? "Prestación"}
                        </span>
                        <span className="font-mono text-[11px] text-gray-500 shrink-0">
                          {it.precio_pack
                            ? formatearPesos(it.precio_pack * it.cantidad)
                            : formatearPesos((mapaPrest.get(it.prestacion_id)?.precio_base ?? 0) * it.cantidad)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">Valor ref. base</p>
                    <p className="text-lg font-black text-gray-900">{formatearPesos(totalPack)}</p>
                  </div>

                  {puedeGestionar && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => abrirEdicion(pack)}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleEstado(pack.id)}
                        disabled={pendiente}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                      >
                        {pack.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { agregarPrestacion } from "@/app/pacientes/[id]/odontograma/actions"
import { CarasCirculo } from "@/components/odontograma/Diente"
import { IconoMuestra } from "@/lib/iconos-dentales"
import { iconoPorNombre } from "@/lib/iconos-datos"
import { formatearPesos } from "@/lib/formato"
import type { Catalogo, PrestacionCatalogo } from "@/lib/catalogo"
import { CARA_ETIQUETAS, COLORES, type Cara } from "@/types/odontograma"
import type { TratamientoOpcion } from "@/types/tratamiento"

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function PanelPrestaciones({
  pacienteId,
  pieza,
  caras,
  onCambiarCaras,
  catalogo,
  tratamientos,
  tratamientoFijo,
  onCerrar,
  onAgregada,
}: {
  pacienteId: string
  pieza: number | null
  caras: Cara[]
  onCambiarCaras: (caras: Cara[]) => void
  catalogo: Catalogo
  tratamientos: TratamientoOpcion[]
  tratamientoFijo?: TratamientoOpcion
  onCerrar: () => void
  onAgregada: (mensaje: { ok: boolean; texto: string }) => void
}) {
  const opciones = tratamientoFijo ? [tratamientoFijo] : tratamientos
  const [tratamientoId, setTratamientoId] = useState(opciones[0]?.id ?? "")
  const tratamiento = opciones.find((t) => t.id === tratamientoId)
  const precios = (tratamiento && catalogo.precios[tratamiento.arancel_id]) || {}

  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState("")
  const [elegida, setElegida] = useState<(PrestacionCatalogo & { carpeta: string }) | null>(null)
  const [nota, setNota] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()

  const q = normalizar(filtro.trim())
  const carpetas = useMemo(() => {
    if (!q) return catalogo.carpetas
    const palabras = q.split(/\s+/)
    return catalogo.carpetas
      .map((c) => ({
        ...c,
        prestaciones: c.prestaciones.filter((p) => {
          const texto = normalizar(`${p.nombre} ${p.codigo_interno} ${c.nombre}`)
          return palabras.every((w) => texto.includes(w))
        }),
      }))
      .filter((c) => c.prestaciones.length > 0)
  }, [catalogo, q])

  function alternar(id: string) {
    setAbiertas((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  function alternarCara(cara: Cara) {
    onCambiarCaras(caras.includes(cara) ? caras.filter((c) => c !== cara) : [...caras, cara])
  }

  function agregar() {
    if (!elegida || !tratamientoId) return
    setError(null)
    startTransition(async () => {
      const res = await agregarPrestacion(pacienteId, {
        tratamientoId,
        prestacionId: elegida.id,
        pieza,
        caras,
        nota,
      })
      if (res.ok) {
        onAgregada({ ok: true, texto: `${elegida.nombre}${pieza ? ` · pieza ${pieza}` : ""}: agregada al tratamiento.` })
        setElegida(null)
        setNota("")
      } else {
        setError(res.mensaje)
      }
    })
  }

  return (
    <aside className="w-full lg:w-80 shrink-0 flex flex-col rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden lg:max-h-[640px]">
      <div className="bg-slate-900 text-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agregar prestación</p>
            <p className="text-xl font-black">{pieza ? `Pieza ${pieza}` : "Prestación general"}</p>
          </div>
          <button onClick={onCerrar} className="text-slate-400 hover:text-white text-lg leading-none" title="Cerrar">
            ✕
          </button>
        </div>

        {pieza && (
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-2">
            <div className="bg-white rounded-full p-0.5">
              <CarasCirculo
                pieza={pieza}
                colores={Object.fromEntries(caras.map((c) => [c, COLORES.PENDIENTE]))}
                size={64}
                conLetras
                onClickCara={(c) => alternarCara(c)}
              />
            </div>
            <div className="text-[11px] font-semibold text-slate-300">
              {caras.length === 0 ? (
                <p>Pieza completa. Toca las caras para elegirlas.</p>
              ) : (
                caras.map((c) => <p key={c}>{c} · {CARA_ETIQUETAS[c]}</p>)
              )}
            </div>
          </div>
        )}

        {opciones.length === 0 ? (
          <p className="rounded-xl bg-amber-400/20 p-2 text-xs font-semibold text-amber-200">
            El paciente no tiene tratamientos activos.{" "}
            <Link href={`/pacientes/${pacienteId}/tratamientos`} className="underline">
              Crear tratamiento →
            </Link>
          </p>
        ) : tratamientoFijo ? (
          <p className="text-[11px] font-bold text-slate-300">
            Tratamiento N° {tratamientoFijo.numero} · {tratamientoFijo.nombre}
          </p>
        ) : (
          <select
            value={tratamientoId}
            onChange={(e) => setTratamientoId(e.target.value)}
            className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-xs font-bold text-white"
          >
            {opciones.map((t) => (
              <option key={t.id} value={t.id} className="text-gray-900">
                Tratamiento N° {t.numero} · {t.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {elegida && (
        <div className="border-b border-gray-200 bg-blue-50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <IconoMuestra tipo={elegida.icono || iconoPorNombre(elegida.nombre)} color={COLORES.PENDIENTE} size={26} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-blue-900 leading-tight">{elegida.nombre}</p>
              <p className="text-[11px] font-semibold text-blue-700">📁 {elegida.carpeta}</p>
            </div>
            <p className="text-base font-black text-blue-900 whitespace-nowrap">{formatearPesos(precios[elegida.id])}</p>
          </div>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
          {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setElegida(null)}
              className="flex-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={agregar}
              disabled={guardando}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {guardando ? "Agregando..." : "+ Agregar"}
            </button>
          </div>
        </div>
      )}

      <div className="p-3 border-b border-gray-100">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="🔍 Filtrar prestaciones..."
          className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-2 space-y-1.5">
        {carpetas.length === 0 ? (
          <p className="p-3 text-xs font-semibold text-gray-400">
            {q ? "Ninguna prestación coincide." : "No hay prestaciones activas."}
          </p>
        ) : (
          carpetas.map((c) => {
            const abierta = abiertas.has(c.id) || !!q
            return (
              <div key={c.id}>
                <button
                  onClick={() => alternar(c.id)}
                  className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    abierta ? "bg-white border-blue-300 shadow-sm" : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-base">{abierta ? "📂" : "📁"}</span>
                  <span className="flex-1 text-[11px] font-black uppercase tracking-wide text-gray-800 leading-tight">
                    {c.nombre}
                  </span>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-gray-500">{c.prestaciones.length}</span>
                </button>

                {abierta && (
                  <div className="mt-1 ml-3 space-y-1 border-l-2 border-blue-200 pl-2">
                    {c.prestaciones.map((p) => {
                      const precio = precios[p.id]
                      return (
                        <button
                          key={p.id}
                          disabled={precio === undefined || opciones.length === 0}
                          onClick={() => {
                            setElegida({ ...p, carpeta: c.nombre })
                            setError(null)
                          }}
                          className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors disabled:opacity-40 ${
                            elegida?.id === p.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-transparent bg-white hover:border-blue-300 hover:bg-blue-50"
                          }`}
                        >
                          <IconoMuestra tipo={p.icono || iconoPorNombre(p.nombre)} color={COLORES.PENDIENTE} size={16} />
                          <span className="flex-1 min-w-0 text-xs font-bold text-gray-800 leading-tight">{p.nombre}</span>
                          <span className="text-[11px] font-black text-gray-600 whitespace-nowrap">
                            {precio === undefined ? "s/p" : formatearPesos(precio)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

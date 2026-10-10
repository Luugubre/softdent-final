"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  agregarPrestacion,
  catalogoPrestaciones,
  registrarHallazgo,
  type CarpetaPrestaciones,
  type PrestacionCatalogo,
} from "@/app/pacientes/[id]/odontograma/actions"
import { SelectorCaras } from "@/components/odontograma/SelectorCaras"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import type { TratamientoOpcion } from "@/types/tratamiento"
import { IconoMuestra } from "@/lib/iconos-dentales"
import { iconoPorNombre } from "@/lib/iconos-datos"
import Link from "next/link"
import {
  COLORES,
  ESTADO_ITEM_ETIQUETAS,
  LESIONES,
  PREEXISTENCIAS,
  etiquetaHallazgo,
  type Avance,
  type Cara,
  type Hallazgo,
  type ItemTratamiento,
} from "@/types/odontograma"

const inputClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"

export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6 space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900">{titulo}</h2>
          <button onClick={onClose} className="text-sm font-bold text-gray-500 hover:text-gray-800">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

type AlTerminar = (mensaje: { ok: boolean; texto: string }) => void

// =====================================================================
// Preexistencia / Lesión
// =====================================================================
export function ModalHallazgo({
  pacienteId,
  pieza,
  tipo,
  onClose,
  onDone,
}: {
  pacienteId: string
  pieza: number
  tipo: "PREEXISTENCIA" | "LESION"
  onClose: () => void
  onDone: AlTerminar
}) {
  const catalogo = tipo === "LESION" ? LESIONES : PREEXISTENCIAS
  const [codigo, setCodigo] = useState("")
  const [caras, setCaras] = useState<Cara[]>([])
  const [nota, setNota] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()

  function guardar() {
    if (!codigo) return setError("Selecciona el tipo.")
    startTransition(async () => {
      const res = await registrarHallazgo(pacienteId, { pieza, tipo, codigo, caras, nota })
      if (res.ok) onDone({ ok: true, texto: res.mensaje })
      else setError(res.mensaje)
    })
  }

  return (
    <Modal titulo={`${tipo === "LESION" ? "Definir lesión" : "Agregar preexistencia"} · Pieza ${pieza}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(catalogo).map(([clave, v]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setCodigo(clave)}
            className={`text-left px-2 py-1.5 rounded-xl border-2 text-sm font-bold transition-colors flex items-center gap-2 ${
              codigo === clave ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700 hover:border-gray-300"
            }`}
          >
            <IconoMuestra
              tipo={v.icono}
              color={tipo === "LESION" ? COLORES.LESION : COLORES.PREEXISTENCIA}
              size={22}
              malEstado={clave === "RESTAURACION_DEFECTUOSA"}
            />
            {v.etiqueta}
          </button>
        ))}
      </div>

      <SelectorCaras pieza={pieza} valor={caras} onChange={setCaras} color={tipo === "LESION" ? COLORES.LESION : COLORES.PREEXISTENCIA} />

      <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Nota (opcional)" className={inputClass} />

      {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200">
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </Modal>
  )
}

// =====================================================================
// Agregar prestación: buscador rápido + carpetas por categoría
// =====================================================================

/** "Restauración" → "restauracion" (para buscar sin importar tildes ni mayúsculas) */
const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

// El catálogo se guarda en memoria por tratamiento, así abrir el menú otra vez es instantáneo
const cacheCatalogo = new Map<string, { arancel: string | null; carpetas: CarpetaPrestaciones[] }>()

export function ModalPrestacion({
  pacienteId,
  pieza,
  tratamientos,
  tratamientoFijo,
  carasIniciales,
  onClose,
  onDone,
}: {
  pacienteId: string
  pieza: number | null
  /** Tratamientos activos donde se puede agregar (odontograma general) */
  tratamientos: TratamientoOpcion[]
  /** Si viene, se agrega directo a este tratamiento (odontograma del tratamiento) */
  tratamientoFijo?: TratamientoOpcion
  /** Caras preseleccionadas (al hacer clic sobre una cara del diente) */
  carasIniciales?: Cara[]
  onClose: () => void
  onDone: AlTerminar
}) {
  const [tratamientoId, setTratamientoId] = useState(tratamientoFijo?.id ?? tratamientos[0]?.id ?? "")
  const [catalogo, setCatalogo] = useState<{ arancel: string | null; carpetas: CarpetaPrestaciones[] } | null>(
    () => cacheCatalogo.get(tratamientoFijo?.id ?? tratamientos[0]?.id ?? "") ?? null
  )
  const [busqueda, setBusqueda] = useState("")
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const [elegida, setElegida] = useState<(PrestacionCatalogo & { carpeta: string }) | null>(null)
  const [caras, setCaras] = useState<Cara[]>(carasIniciales ?? [])
  const [nota, setNota] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [guardando, startTransition] = useTransition()

  // Cargar el catálogo del tratamiento (con los precios de su arancel)
  useEffect(() => {
    if (!tratamientoId) return
    const enCache = cacheCatalogo.get(tratamientoId)
    if (enCache) {
      setCatalogo(enCache)
      return
    }
    let cancelado = false
    setCatalogo(null)
    catalogoPrestaciones(pacienteId, tratamientoId).then((res) => {
      cacheCatalogo.set(tratamientoId, res)
      if (!cancelado) setCatalogo(res)
    })
    return () => {
      cancelado = true
    }
  }, [pacienteId, tratamientoId])

  // Resultados del buscador (en todas las carpetas)
  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q || !catalogo) return []
    const palabras = q.split(/\s+/)
    return catalogo.carpetas
      .flatMap((c) => c.prestaciones.map((p) => ({ ...p, carpeta: c.nombre })))
      .filter((p) => {
        const texto = normalizar(`${p.nombre} ${p.codigo_interno} ${p.carpeta}`)
        return palabras.every((w) => texto.includes(w))
      })
      .slice(0, 60)
  }, [busqueda, catalogo])

  function alternarCarpeta(id: string) {
    setAbiertas((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  function guardar() {
    if (!elegida) return setError("Selecciona una prestación.")
    startTransition(async () => {
      const res = await agregarPrestacion(pacienteId, { tratamientoId, prestacionId: elegida.id, pieza, caras, nota })
      if (res.ok) onDone({ ok: true, texto: res.mensaje })
      else setError(res.mensaje)
    })
  }

  const Fila = ({ p, carpeta, mostrarCarpeta }: { p: PrestacionCatalogo; carpeta: string; mostrarCarpeta?: boolean }) => (
    <button
      type="button"
      disabled={!p.precio}
      onClick={() => {
        setElegida({ ...p, carpeta })
        setError(null)
      }}
      className="w-full text-left pl-3 pr-3 py-2 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-2"
    >
      <IconoMuestra tipo={p.icono || iconoPorNombre(p.nombre)} color={COLORES.PENDIENTE} size={18} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-gray-900 truncate">{p.nombre}</span>
        <span className="block text-[11px] font-mono text-gray-400 truncate">
          {p.codigo_interno}
          {mostrarCarpeta && ` · ${carpeta}`}
        </span>
      </span>
      <span className="text-sm font-extrabold text-gray-900 whitespace-nowrap">
        {p.precio ? formatearPesos(p.precio) : "Sin precio"}
      </span>
    </button>
  )

  return (
    <Modal titulo={pieza ? `Agregar prestación · Pieza ${pieza}` : "Agregar prestación general"} onClose={onClose}>
      {/* A qué tratamiento se agrega */}
      {tratamientoFijo ? (
        <p className="text-xs font-bold text-gray-500">
          Tratamiento N° {tratamientoFijo.numero} · {tratamientoFijo.nombre}
          {catalogo?.arancel && ` · ${catalogo.arancel}`}
        </p>
      ) : tratamientos.length === 0 ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm font-semibold text-amber-800">
          El paciente no tiene tratamientos activos. Las prestaciones se agregan dentro de un tratamiento.{" "}
          <Link href={`/pacientes/${pacienteId}/tratamientos`} className="underline">
            Crear tratamiento →
          </Link>
        </div>
      ) : (
        <label className="block">
          <span className="block text-xs font-bold text-gray-700 mb-1">Agregar al tratamiento</span>
          <select
            value={tratamientoId}
            onChange={(e) => {
              setTratamientoId(e.target.value)
              setElegida(null)
            }}
            className={inputClass}
          >
            {tratamientos.map((t) => (
              <option key={t.id} value={t.id}>
                N° {t.numero} · {t.nombre}
              </option>
            ))}
          </select>
          {catalogo?.arancel && <span className="block mt-1 text-[11px] font-semibold text-gray-500">Precios: {catalogo.arancel}</span>}
        </label>
      )}

      {!tratamientoId ? null : !elegida ? (
        <>
          {/* Buscador rápido */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar prestación o código (ej: resina, endo, DL-5228)..."
              className={`${inputClass} pl-9`}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            )}
          </div>

          <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded-xl">
            {!catalogo ? (
              <p className="p-4 text-sm text-gray-400">Cargando prestaciones...</p>
            ) : busqueda.trim() ? (
              // Resultados de búsqueda
              resultados.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Sin resultados para “{busqueda}”.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {resultados.map((p) => (
                    <Fila key={p.id} p={p} carpeta={p.carpeta} mostrarCarpeta />
                  ))}
                </div>
              )
            ) : catalogo.carpetas.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No hay prestaciones activas.</p>
            ) : (
              // Carpetas por categoría
              <ul className="divide-y divide-gray-100">
                {catalogo.carpetas.map((c) => {
                  const abierta = abiertas.has(c.id)
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => alternarCarpeta(c.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 ${abierta ? "bg-slate-50" : ""}`}
                      >
                        <span className="text-lg">{abierta ? "📂" : "📁"}</span>
                        <span className="flex-1 text-sm font-extrabold text-gray-800">{c.nombre}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                          {c.prestaciones.length}
                        </span>
                        <span className={`text-gray-400 text-xs transition-transform ${abierta ? "rotate-90" : ""}`}>▶</span>
                      </button>
                      {abierta && (
                        <div className="ml-5 border-l-2 border-slate-200 divide-y divide-gray-50">
                          {c.prestaciones.map((p) => (
                            <Fila key={p.id} p={p} carpeta={c.nombre} />
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-center justify-between gap-3">
            <IconoMuestra tipo={elegida.icono || iconoPorNombre(elegida.nombre)} color={COLORES.PENDIENTE} size={30} />
            <div className="flex-1">
              <p className="text-sm font-extrabold text-blue-900">{elegida.nombre}</p>
              <p className="text-xs font-mono text-blue-700">
                {elegida.codigo_interno} · 📁 {elegida.carpeta}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-blue-900">{formatearPesos(elegida.precio)}</p>
              <button onClick={() => setElegida(null)} className="text-xs font-bold text-blue-600 hover:underline">
                Cambiar
              </button>
            </div>
          </div>

          {pieza && <SelectorCaras pieza={pieza} valor={caras} onChange={setCaras} color={COLORES.PENDIENTE} />}

          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Nota (opcional)" className={inputClass} />
        </>
      )}

      {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200">
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando || !elegida}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {guardando ? "Agregando..." : "Agregar al tratamiento"}
        </button>
      </div>
    </Modal>
  )
}

// =====================================================================
// Ver información de la pieza
// =====================================================================
export function ModalInfo({
  pieza,
  hallazgos,
  items,
  avances,
  onClose,
}: {
  pieza: number
  hallazgos: Hallazgo[]
  items: ItemTratamiento[]
  avances: Avance[]
  onClose: () => void
}) {
  const vigentes = hallazgos.filter((h) => h.vigente)
  const historial = hallazgos.filter((h) => !h.vigente)

  return (
    <Modal titulo={`Pieza ${pieza}`} onClose={onClose}>
      <section className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">Estado actual</h3>
        {vigentes.length === 0 ? (
          <p className="text-sm font-medium text-gray-400">Sana / sin hallazgos.</p>
        ) : (
          <ul className="space-y-1">
            {vigentes.map((h) => (
              <li key={h.id} className="text-sm">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full mr-2"
                  style={{ background: h.tipo === "LESION" ? COLORES.LESION : h.tipo === "AUSENTE" ? COLORES.AUSENTE : COLORES.PREEXISTENCIA }}
                />
                <span className="font-bold text-gray-900">{etiquetaHallazgo(h.tipo, h.codigo)}</span>
                {h.caras.length > 0 && <span className="text-gray-500"> · {h.caras.join(", ")}</span>}
                {h.nota && <span className="text-gray-500"> · {h.nota}</span>}
                <span className="block ml-5 text-[11px] text-gray-400">
                  {formatearFechaHora(h.created_at)}
                  {h.creador && ` · ${h.creador.nombre_completo}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">Prestaciones</h3>
        {items.length === 0 ? (
          <p className="text-sm font-medium text-gray-400">Sin prestaciones en esta pieza.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className={`rounded-xl border border-gray-200 p-3 ${i.estado === "ANULADO" ? "opacity-50" : ""}`}>
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">
                    {i.prestacion?.nombre}
                    {i.caras.length > 0 && <span className="text-gray-500"> · {i.caras.join(", ")}</span>}
                  </p>
                  <p className="text-sm font-extrabold text-gray-900">{formatearPesos(i.precio)}</p>
                </div>
                <p className="text-xs font-semibold text-gray-500">
                  {ESTADO_ITEM_ETIQUETAS[i.estado]} · {i.progreso}%
                  {i.presupuesto && ` · Tratamiento N° ${i.presupuesto.numero} (${i.presupuesto.nombre})`}
                </p>
                {avances
                  .filter((a) => a.item_id === i.id)
                  .map((a) => (
                    <p key={a.id} className="text-[11px] text-gray-500">
                      {formatearFechaHora(a.created_at)} · {a.progreso_anterior}% → {a.progreso_nuevo}% · {formatearPesos(a.monto)}
                      {a.profesional && ` · ${a.profesional.nombre_completo}`}
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {historial.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-bold text-gray-500">Historial ({historial.length})</summary>
          <ul className="mt-2 space-y-1">
            {historial.map((h) => (
              <li key={h.id} className="text-xs text-gray-500">
                <span className="line-through">{etiquetaHallazgo(h.tipo, h.codigo)}</span>
                {h.caras.length > 0 && ` · ${h.caras.join(", ")}`} · {formatearFechaHora(h.created_at)} → baja{" "}
                {formatearFechaHora(h.fecha_baja)}
                {h.motivo_baja && ` (${h.motivo_baja})`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Modal>
  )
}

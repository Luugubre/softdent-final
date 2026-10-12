"use client"

import { useEffect, useState, useTransition } from "react"
import {
  registrarHallazgo,
} from "@/app/pacientes/[id]/odontograma/actions"
import { SelectorCaras } from "@/components/odontograma/SelectorCaras"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { IconoMuestra } from "@/lib/iconos-dentales"
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

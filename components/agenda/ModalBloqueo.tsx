"use client"

import { useState, useTransition } from "react"
import { crearBloqueo } from "@/app/agenda/actions"
import { Modal } from "@/components/odontograma/Modales"
import { TIPOS_BLOQUEO, TIPO_BLOQUEO, type Box, type ProfesionalAgenda } from "@/types/cita"

const etiqueta = "block text-xs font-black uppercase tracking-wider text-gray-500 mb-1"
const campo =
  "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"

export function ModalBloqueo({
  fecha,
  profesionales,
  boxes,
  onClose,
  onListo,
}: {
  fecha: string
  profesionales: ProfesionalAgenda[]
  boxes: Box[]
  onClose: () => void
  onListo: (mensaje: string) => void
}) {
  const [tipo, setTipo] = useState<string>("REUNION")
  const [motivo, setMotivo] = useState("")
  const [alcance, setAlcance] = useState<"CLINICA" | "PROFESIONAL" | "BOX">("PROFESIONAL")
  const [profesionalId, setProfesionalId] = useState(profesionales[0]?.id ?? "")
  const [boxId, setBoxId] = useState(boxes[0]?.id ?? "")
  const [fechaInicio, setFechaInicio] = useState(fecha)
  const [horaInicio, setHoraInicio] = useState("13:00")
  const [fechaFin, setFechaFin] = useState(fecha)
  const [horaFin, setHoraFin] = useState("14:00")
  const [todoElDia, setTodoElDia] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  function guardar() {
    setError(null)
    startTransition(async () => {
      const res = await crearBloqueo({
        tipo,
        motivo,
        fechaInicio,
        horaInicio: todoElDia ? "00:00" : horaInicio,
        fechaFin,
        horaFin: todoElDia ? "23:59" : horaFin,
        profesionalId: alcance === "PROFESIONAL" ? profesionalId : null,
        boxId: alcance === "BOX" ? boxId : null,
      })
      if (res.ok) onListo(res.mensaje)
      else setError(res.mensaje)
    })
  }

  return (
    <Modal titulo="🚫 Bloquear horario" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={etiqueta}>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
            {TIPOS_BLOQUEO.map((t) => (
              <option key={t} value={t}>
                {TIPO_BLOQUEO[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={etiqueta}>Aplica a</span>
          <select value={alcance} onChange={(e) => setAlcance(e.target.value as typeof alcance)} className={campo}>
            <option value="PROFESIONAL">Un profesional</option>
            <option value="BOX">Un box</option>
            <option value="CLINICA">Toda la clínica</option>
          </select>
        </label>
      </div>

      {alcance === "PROFESIONAL" && (
        <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} className={campo}>
          {profesionales.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre_completo}
            </option>
          ))}
        </select>
      )}
      {alcance === "BOX" && (
        <select value={boxId} onChange={(e) => setBoxId(e.target.value)} className={campo}>
          {boxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      )}

      <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
        <input type="checkbox" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} />
        Día(s) completo(s)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={etiqueta}>Desde</span>
          <div className="flex gap-1">
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={campo} />
            <input type="time" step={300} disabled={todoElDia} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={`${campo} w-28`} />
          </div>
        </label>
        <label>
          <span className={etiqueta}>Hasta</span>
          <div className="flex gap-1">
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={campo} />
            <input type="time" step={300} disabled={todoElDia} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className={`${campo} w-28`} />
          </div>
        </label>
      </div>

      <label className="block">
        <span className={etiqueta}>Motivo</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: vacaciones de invierno, reunión clínica" className={campo} />
      </label>

      {error && <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200">
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={pendiente || !motivo.trim()}
          className="px-5 py-2 rounded-xl text-sm font-black text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40"
        >
          {pendiente ? "Guardando…" : "Bloquear"}
        </button>
      </div>
    </Modal>
  )
}

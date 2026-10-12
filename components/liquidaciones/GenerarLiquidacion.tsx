"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { generarLiquidacion } from "@/app/liquidaciones/actions"
import { formatearPesos } from "@/lib/formato"

const campo = "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
const etiqueta = "block text-xs font-black uppercase tracking-wider text-gray-500 mb-1"
const numero = (v: string) => Number(v.replace(/[^\d-]/g, "")) || 0

/** Liquidación mensual: período, bonificación, ajuste (+/−) y descuento. El cálculo final lo hace la BD. */
export function GenerarLiquidacion({
  profesionalId,
  periodo,
  mesActual,
  base,
  aPagar,
  porcentaje,
  cantidad,
  sinPorcentaje,
}: {
  profesionalId: string
  periodo: string
  mesActual: string
  base: number
  aPagar: number
  porcentaje: number | null
  cantidad: number
  sinPorcentaje: boolean
}) {
  const router = useRouter()
  const [extras, setExtras] = useState({ bonificacion: "", ajuste: "", descuento: "" })
  const [nota, setNota] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  const total = aPagar + numero(extras.bonificacion) + numero(extras.ajuste) - numero(extras.descuento)
  const clinica = base - aPagar

  function generar() {
    if (!window.confirm(`¿Calcular la liquidación de ${periodo} por ${formatearPesos(total)}?`)) return
    setError(null)
    startTransition(async () => {
      const res = await generarLiquidacion(profesionalId, periodo, extras, nota)
      if (res.ok && res.id) router.push(`/liquidaciones/${res.id}`)
      else setError(res.mensaje)
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <label>
          <span className={etiqueta}>Período</span>
          <input
            type="month"
            value={periodo}
            max={mesActual}
            onChange={(e) => e.target.value && router.replace(`/liquidaciones/profesional/${profesionalId}?periodo=${e.target.value}`)}
            className={campo}
          />
        </label>
        <label>
          <span className={etiqueta}>Bonificación (+)</span>
          <input inputMode="numeric" value={extras.bonificacion} onChange={(e) => setExtras({ ...extras, bonificacion: e.target.value })} placeholder="$0" className={campo} />
        </label>
        <label>
          <span className={etiqueta}>Ajuste (+/−)</span>
          <input value={extras.ajuste} onChange={(e) => setExtras({ ...extras, ajuste: e.target.value })} placeholder="Ej: -5000" className={campo} />
        </label>
        <label>
          <span className={etiqueta}>Descuento (−)</span>
          <input inputMode="numeric" value={extras.descuento} onChange={(e) => setExtras({ ...extras, descuento: e.target.value })} placeholder="$0" className={campo} />
        </label>
        <label>
          <span className={etiqueta}>Nota</span>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" className={campo} />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <dt className="text-[11px] font-black uppercase text-gray-500">Producción</dt>
            <dd className="font-bold">{formatearPesos(base)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase text-gray-500">Profesional {porcentaje ?? "—"}%</dt>
            <dd className="font-bold">{formatearPesos(aPagar)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase text-gray-500">Clínica {porcentaje !== null ? 100 - porcentaje : "—"}%</dt>
            <dd className="font-bold">{formatearPesos(clinica)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase text-emerald-700">Total a pagar</dt>
            <dd className={`text-lg font-black ${total < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatearPesos(total)}</dd>
          </div>
        </dl>
        <button
          disabled={pendiente || sinPorcentaje || total < 0 || (cantidad === 0 && !numero(extras.bonificacion) && !numero(extras.ajuste))}
          onClick={generar}
          className="px-5 py-2.5 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
        >
          {pendiente ? "Calculando…" : "Calcular liquidación"}
        </button>
      </div>
      {sinPorcentaje && <p className="text-xs font-semibold text-rose-700">Configura primero el % de liquidación del profesional.</p>}
      {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
      <p className="text-[11px] font-semibold text-gray-400">
        Se incluyen las prestaciones terminadas y pagadas hasta el fin del mes elegido que aún no se liquidaron. Un mes ya liquidado no se modifica: las correcciones van como ajuste en el mes siguiente.
      </p>
    </div>
  )
}

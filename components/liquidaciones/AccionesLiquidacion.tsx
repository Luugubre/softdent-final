"use client"

import { useState, useTransition } from "react"
import { anularLiquidacion, aprobarLiquidacion, pagarLiquidacion } from "@/app/liquidaciones/actions"
import { METODOS_PAGO_LIQUIDACION, METODO_LIQUIDACION, type EstadoLiquidacion, type MetodoPagoLiquidacion } from "@/types/liquidacion"

export function AccionesLiquidacion({ liquidacionId, estado }: { liquidacionId: string; estado: EstadoLiquidacion }) {
  const [abierto, setAbierto] = useState(false)
  const [metodo, setMetodo] = useState<MetodoPagoLiquidacion>("TRANSFERENCIA")
  const [referencia, setReferencia] = useState("")
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje: string }>) {
    startTransition(async () => {
      const res = await accion()
      setAviso({ ok: res.ok, texto: res.mensaje })
      if (res.ok) setAbierto(false)
    })
  }

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex gap-2 justify-end flex-wrap">
        {estado === "CALCULADA" && (
          <button
            disabled={pendiente}
            onClick={() => window.confirm("¿Aprobar la liquidación? Después solo se podrá pagar o anular.") && ejecutar(() => aprobarLiquidacion(liquidacionId))}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            ✔ Aprobar
          </button>
        )}
        {estado === "APROBADA" && (
          <button
            disabled={pendiente}
            onClick={() => setAbierto(!abierto)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            💸 Registrar pago al profesional
          </button>
        )}
        <button
          disabled={pendiente}
          onClick={() => {
            const motivo = window.prompt("Motivo de la anulación (las prestaciones volverán a quedar pendientes):")
            if (motivo?.trim()) ejecutar(() => anularLiquidacion(liquidacionId, motivo))
          }}
          className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
        >
          Anular
        </button>
      </div>

      {abierto && estado === "APROBADA" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <span className="block text-xs font-black uppercase tracking-wider text-gray-500">Método</span>
            <div className="flex gap-1">
              {METODOS_PAGO_LIQUIDACION.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodo(m)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                    metodo === m ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-700"
                  }`}
                >
                  {METODO_LIQUIDACION[m]}
                </button>
              ))}
            </div>
          </div>
          {metodo !== "EFECTIVO" && (
            <label className="space-y-1">
              <span className="block text-xs font-black uppercase tracking-wider text-gray-500">
                {metodo === "CHEQUE" ? "N° de cheque *" : "N° de operación *"}
              </span>
              <input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          )}
          <button
            disabled={pendiente || (metodo !== "EFECTIVO" && !referencia.trim())}
            onClick={() => ejecutar(() => pagarLiquidacion(liquidacionId, metodo, referencia))}
            className="px-4 py-2 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
          >
            Confirmar pago
          </button>
        </div>
      )}

      {aviso && (
        <p className={`text-sm font-semibold text-right ${aviso.ok ? "text-emerald-700" : "text-rose-700"}`}>{aviso.texto}</p>
      )}
    </div>
  )
}

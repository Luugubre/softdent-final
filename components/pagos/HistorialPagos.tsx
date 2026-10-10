"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { anularPago } from "@/app/pacientes/[id]/pagos/actions"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { METODO_PAGO, type Pago } from "@/types/pago"

export function HistorialPagos({
  pacienteId,
  pagos,
  puedeAnular,
}: {
  pacienteId: string
  pagos: Pago[]
  puedeAnular: boolean
}) {
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  function anular(pago: Pago) {
    const motivo = window.prompt(`Motivo de la anulación del pago N° ${pago.numero} (${formatearPesos(pago.monto)}):`)
    if (!motivo?.trim()) return
    startTransition(async () => {
      const res = await anularPago(pacienteId, pago.id, motivo)
      setAviso({ ok: res.ok, texto: res.mensaje })
    })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold text-gray-900">Historial de pagos</h2>

      {aviso && (
        <p
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold border ${
            aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {pagos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm font-semibold text-gray-400">
          Aún no hay pagos registrados.
        </p>
      ) : (
        <ul className="space-y-2">
          {pagos.map((p) => {
            const anulado = p.estado === "ANULADO"
            return (
              <li
                key={p.id}
                className={`rounded-2xl border p-4 ${anulado ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200 shadow-sm"}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <p className={`font-extrabold ${anulado ? "text-gray-400 line-through" : "text-gray-900"}`}>
                      Pago N° {p.numero} · {formatearPesos(p.monto)}
                    </p>
                    <p className="text-xs font-semibold text-gray-500">
                      {formatearFechaHora(p.fecha)} · {METODO_PAGO[p.metodo].icono} {METODO_PAGO[p.metodo].etiqueta}
                      {p.referencia && ` · Ref. ${p.referencia}`}
                      {p.numero_boleta && ` · Boleta ${p.numero_boleta}`}
                      {p.registrador && ` · ${p.registrador.nombre_completo}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {anulado ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-gray-200 text-gray-600">ANULADO</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">VIGENTE</span>
                    )}
                    <Link
                      href={`/pacientes/${pacienteId}/pagos/${p.id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      Comprobante
                    </Link>
                    {puedeAnular && !anulado && (
                      <button
                        disabled={pendiente}
                        onClick={() => anular(p)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Anular
                      </button>
                    )}
                  </div>
                </div>

                <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                  {p.detalle.map((d) => (
                    <li key={d.id} className="flex justify-between gap-3">
                      <span>
                        {d.item?.prestacion?.nombre ?? "Prestación"}
                        {d.item?.pieza ? ` · pieza ${d.item.pieza}` : ""}
                        {d.item?.presupuesto ? ` · Trat. N° ${d.item.presupuesto.numero}` : ""}
                      </span>
                      <span className="font-bold">{formatearPesos(d.monto)}</span>
                    </li>
                  ))}
                </ul>

                {p.nota && <p className="mt-2 text-xs font-medium text-gray-500">Nota: {p.nota}</p>}
                {anulado && (
                  <p className="mt-2 text-xs font-semibold text-rose-700">
                    Anulado el {formatearFechaHora(p.fecha_anulacion)}
                    {p.anulador && ` por ${p.anulador.nombre_completo}`}: {p.motivo_anulacion}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

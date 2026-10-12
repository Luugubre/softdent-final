"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { anularBono, itemsBonificables, registrarBono, usarBono } from "@/app/fonasa-convenios/actions"
import { campo, etiqueta, SelectorPaciente, SelectorPrestacionFonasa } from "@/components/fonasa/Buscadores"
import { formatearFecha, formatearFechaHora, formatearPesos } from "@/lib/formato"
import { ESTADO_BONO, type BonoFonasa } from "@/types/admin"

type Item = Awaited<ReturnType<typeof itemsBonificables>>[number]
const soloNumero = (v: string) => v.replace(/\D/g, "")
const conPuntos = (v: string) => (v ? Number(v).toLocaleString("es-CL") : "")

export function GestionBonos({ bonos, hoy }: { bonos: BonoFonasa[]; hoy: string }) {
  const [paciente, setPaciente] = useState<{ id: string; nombres: string; apellidos: string; rut: string; prevision?: string } | null>(null)
  const [prestacion, setPrestacion] = useState<{ id: string; nombre: string; codigo_fonasa: string } | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [itemId, setItemId] = useState("")
  const [folio, setFolio] = useState("")
  const [monto, setMonto] = useState("")
  const [copago, setCopago] = useState("")
  const [fecha, setFecha] = useState(hoy)
  const [filtro, setFiltro] = useState<"" | keyof typeof ESTADO_BONO>("")
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  useEffect(() => {
    setItemId("")
    if (!paciente || !prestacion) return setItems([])
    itemsBonificables(paciente.id, prestacion.id).then(setItems)
  }, [paciente, prestacion])

  const ejecutar = (fn: () => Promise<{ ok: boolean; mensaje: string }>, alTerminar?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) alTerminar?.()
    })

  function registrar() {
    if (!paciente || !prestacion) return setAviso({ ok: false, texto: "Selecciona paciente y prestación." })
    ejecutar(
      () => registrarBono({ folio, pacienteId: paciente.id, prestacionId: prestacion.id, monto, copago, itemId: itemId || null, fecha }),
      () => {
        setFolio("")
        setMonto("")
        setCopago("")
        setItemId("")
      }
    )
  }

  const lista = filtro ? bonos.filter((b) => b.estado === filtro) : bonos
  const pendientes = bonos.filter((b) => b.estado === "PENDIENTE")

  return (
    <div className="space-y-6">
      {aviso && (
        <p className={`rounded-xl px-4 py-2.5 text-sm font-semibold border ${aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
          {aviso.texto}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* REGISTRAR */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3 h-fit">
          <h2 className="text-lg font-extrabold text-gray-900">Registrar bono FONASA</h2>
          <label className="block">
            <span className={etiqueta}>N° de folio (único)</span>
            <input value={folio} onChange={(e) => setFolio(e.target.value.toUpperCase())} placeholder="Ej: 123456789" className={`${campo} font-mono`} />
          </label>
          <SelectorPaciente valor={paciente} onCambio={setPaciente} />
          <SelectorPrestacionFonasa valor={prestacion} onCambio={setPrestacion} />
          {paciente && prestacion && (
            <label className="block">
              <span className={etiqueta}>Aplicar a prestación del plan (opcional)</span>
              <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={campo}>
                <option value="">— Sin asociar (se elige al usarlo) —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    Trat. N° {i.presupuesto?.numero} · {i.pieza ? `pieza ${i.pieza} · ` : ""}saldo {formatearPesos(i.precio - i.abonado)}
                  </option>
                ))}
              </select>
              {items.length === 0 && <span className="text-[11px] font-semibold text-gray-400">El paciente no tiene esta prestación con saldo en sus tratamientos.</span>}
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={etiqueta}>Monto bonificado</span>
              <input inputMode="numeric" value={conPuntos(monto)} onChange={(e) => setMonto(soloNumero(e.target.value))} placeholder="$0" className={campo} />
            </label>
            <label>
              <span className={etiqueta}>Copago paciente</span>
              <input inputMode="numeric" value={conPuntos(copago)} onChange={(e) => setCopago(soloNumero(e.target.value))} placeholder="$0" className={campo} />
            </label>
          </div>
          <label className="block">
            <span className={etiqueta}>Fecha de emisión</span>
            <input type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
          </label>
          <button
            disabled={pendiente || !folio.trim() || !monto || !paciente || !prestacion}
            onClick={registrar}
            className="w-full py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
          >
            Registrar bono
          </button>
        </section>

        {/* LISTA */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-gray-900">Bonos ({pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"})</h2>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-bold">
              <option value="">Todos</option>
              {Object.entries(ESTADO_BONO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.etiqueta}
                </option>
              ))}
            </select>
          </div>
          {lista.length === 0 ? (
            <p className="text-sm font-semibold text-gray-400">No hay bonos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2">Folio</th>
                    <th className="text-left py-2">Paciente</th>
                    <th className="text-left py-2">Prestación</th>
                    <th className="text-right py-2">Bonificado</th>
                    <th className="text-left py-2 pl-3">Estado</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((b) => (
                    <tr key={b.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 font-mono text-xs font-bold">
                        {b.folio}
                        <span className="block font-sans font-semibold text-gray-400">{formatearFecha(b.fecha_emision)}</span>
                      </td>
                      <td className="py-2">
                        <Link href={`/pacientes/${b.paciente_id}/pagos`} className="font-bold uppercase hover:text-blue-700">
                          {b.paciente?.nombres} {b.paciente?.apellidos}
                        </Link>
                        <span className="block text-xs text-gray-500">{b.paciente?.rut}</span>
                      </td>
                      <td className="py-2 text-xs">
                        {b.prestacion?.nombre}
                        <span className="block font-mono text-gray-400">{b.prestacion?.codigo_fonasa}</span>
                      </td>
                      <td className="py-2 text-right font-bold">
                        {formatearPesos(b.monto_bonificado)}
                        {b.copago > 0 && <span className="block text-xs font-semibold text-gray-500">copago {formatearPesos(b.copago)}</span>}
                      </td>
                      <td className="py-2 pl-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${ESTADO_BONO[b.estado].estilo}`}>{ESTADO_BONO[b.estado].etiqueta}</span>
                        {b.usado_en && <span className="block text-[10px] text-gray-400">{formatearFechaHora(b.usado_en)}</span>}
                        {b.pago_id && <span className="block text-[10px] font-bold text-emerald-700">abonado a la prestación</span>}
                        {b.motivo_anulacion && <span className="block text-[10px] font-bold text-rose-700">{b.motivo_anulacion}</span>}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {b.estado === "PENDIENTE" && (
                          <>
                            <button
                              disabled={pendiente}
                              onClick={() => {
                                const msg = b.item_id
                                  ? "¿Marcar el bono como utilizado? Se abonará a la prestación del plan."
                                  : "¿Marcar el bono como utilizado? (No está asociado a una prestación del plan, no se abonará)"
                                if (window.confirm(msg)) ejecutar(() => usarBono(b.id))
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700"
                            >
                              Usar
                            </button>
                            <button
                              disabled={pendiente}
                              onClick={() => {
                                const m = window.prompt(`Motivo de anulación del bono ${b.folio}:`)
                                if (m?.trim()) ejecutar(() => anularBono(b.id, m))
                              }}
                              className="ml-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100"
                            >
                              Anular
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] font-semibold text-gray-400">
            Un folio no se puede repetir ni reutilizar. Un bono usado queda registrado como pago “Bono FONASA” en la prestación del paciente.
          </p>
        </section>
      </div>
    </div>
  )
}

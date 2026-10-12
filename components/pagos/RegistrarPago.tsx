"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { registrarPago } from "@/app/pacientes/[id]/pagos/actions"
import { formatearPesos } from "@/lib/formato"
import { infoMetodo, type MetodoPagoOpcion } from "@/types/pago"
import { Termino } from "@/components/ui/Ayuda"

export type ItemCobrable = {
  id: string
  tratamiento: string
  nombre: string
  pieza: number | null
  progreso: number
  precio: number
  habilitado: number
  abonado: number
}

const deudaDe = (i: ItemCobrable) => Math.max(i.habilitado - i.abonado, 0)
const saldoDe = (i: ItemCobrable) => i.precio - i.abonado

function distribuir(monto: number, items: ItemCobrable[]): Record<string, number> {
  const asignado: Record<string, number> = {}
  let resto = monto
  for (const i of items) {
    if (resto <= 0) break
    const m = Math.min(resto, deudaDe(i))
    if (m > 0) {
      asignado[i.id] = m
      resto -= m
    }
  }
  for (const i of items) {
    if (resto <= 0) break
    const m = Math.min(resto, saldoDe(i) - (asignado[i.id] ?? 0))
    if (m > 0) {
      asignado[i.id] = (asignado[i.id] ?? 0) + m
      resto -= m
    }
  }
  return asignado
}

const soloNumero = (v: string) => Number(v.replace(/\D/g, "")) || 0

export function RegistrarPago({
  pacienteId,
  items,
  metodos,
  cajaAbierta,
}: {
  pacienteId: string
  items: ItemCobrable[]
  metodos: MetodoPagoOpcion[]
  cajaAbierta: boolean
}) {
  const [monto, setMonto] = useState(0)
  const [asignado, setAsignado] = useState<Record<string, number>>({})
  const [metodo, setMetodo] = useState<string>(
    (cajaAbierta ? metodos.find((m) => m.es_efectivo) : metodos.find((m) => !m.registra_en_caja))?.codigo ?? metodos[0]?.codigo ?? ""
  )
  const [referencia, setReferencia] = useState("")
  const [boleta, setBoleta] = useState("")
  const [nota, setNota] = useState("")
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string; pagoId?: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  const deudaTotal = items.reduce((s, i) => s + deudaDe(i), 0)
  const saldoTotal = items.reduce((s, i) => s + saldoDe(i), 0)
  const anticipo = items.reduce((s, i) => s + Math.max((asignado[i.id] ?? 0) - deudaDe(i), 0), 0)

  const grupos = useMemo(() => {
    const mapa = new Map<string, ItemCobrable[]>()
    for (const i of items) mapa.set(i.tratamiento, [...(mapa.get(i.tratamiento) ?? []), i])
    return [...mapa.entries()]
  }, [items])

  function cambiarMonto(valor: number) {
    const m = Math.min(valor, saldoTotal)
    setMonto(m)
    setAsignado(distribuir(m, items))
  }

  function cambiarItem(item: ItemCobrable, valor: number) {
    const nuevo = { ...asignado, [item.id]: Math.min(valor, saldoDe(item)) }
    if (!nuevo[item.id]) delete nuevo[item.id]
    setAsignado(nuevo)
    setMonto(Object.values(nuevo).reduce((s, v) => s + v, 0))
  }

  function enviar() {
    setAviso(null)
    startTransition(async () => {
      const res = await registrarPago(pacienteId, {
        monto,
        metodo,
        referencia,
        boleta,
        nota,
        detalle: Object.entries(asignado).map(([item_id, m]) => ({ item_id, monto: m })),
      })
      setAviso({ ok: res.ok, texto: res.mensaje, pagoId: res.pagoId })
      if (res.ok) {
        setMonto(0)
        setAsignado({})
        setReferencia("")
        setBoleta("")
        setNota("")
      }
    })
  }

  const elegido = metodos.find((m) => m.codigo === metodo)
  const pideReferencia = !!elegido?.pide_referencia
  const faltaCaja = !!elegido?.registra_en_caja && !cajaAbierta
  const valido = monto > 0 && !!elegido && !faltaCaja && (!pideReferencia || referencia.trim().length > 0)

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gray-900 text-white flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-extrabold">💳 Registrar pago</h2>
        <span className="text-xs font-semibold text-gray-300">
          <Termino t="deuda" abajo>Deuda actual</Termino> {formatearPesos(deudaTotal)} · <Termino t="saldo" abajo>Saldo de tratamientos</Termino>{" "}
          {formatearPesos(saldoTotal)}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="p-5 text-sm font-semibold text-gray-500">El paciente no tiene saldos pendientes.</p>
      ) : (
        <div className="p-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3 min-w-0">
            <div className="flex items-end gap-2 flex-wrap">
              <label className="space-y-1">
                <span className="block text-xs font-black uppercase tracking-wider text-gray-500">Monto a pagar</span>
                <input
                  inputMode="numeric"
                  value={monto ? monto.toLocaleString("es-CL") : ""}
                  onChange={(e) => cambiarMonto(soloNumero(e.target.value))}
                  placeholder="$0"
                  className="w-44 rounded-xl border border-gray-300 px-3 py-2 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              {deudaTotal > 0 && (
                <button
                  type="button"
                  onClick={() => cambiarMonto(deudaTotal)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-orange-100 text-orange-800 hover:bg-orange-200"
                >
                  Deuda actual {formatearPesos(deudaTotal)}
                </button>
              )}
              <button
                type="button"
                onClick={() => cambiarMonto(saldoTotal)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Saldo total {formatearPesos(saldoTotal)}
              </button>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2">Prestación</th>
                    <th className="text-right px-3 py-2">Realizado sin pagar</th>
                    <th className="text-right px-3 py-2">Saldo</th>
                    <th className="text-right px-3 py-2 w-36">Aplicar</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(([tratamiento, lista]) => (
                    <FilasGrupo
                      key={tratamiento}
                      tratamiento={tratamiento}
                      lista={lista}
                      asignado={asignado}
                      onCambiar={cambiarItem}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {anticipo > 0 && (
              <p className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                {formatearPesos(anticipo)} se aplicarán como abono anticipado a prestaciones que aún no se realizan.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <span className="block text-xs font-black uppercase tracking-wider text-gray-500">
                <Termino t="metodo_pago" />
              </span>
              <div className="grid grid-cols-2 gap-2">
                {metodos.map(({ codigo: m, nombre }) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodo(m)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
                      metodo === m
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {infoMetodo(m).icono} {nombre}
                  </button>
                ))}
              </div>
            </div>

            {faltaCaja && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800">
                🔒 No hay caja abierta: para recibir un pago con {elegido?.nombre ?? "este método"} hay que abrirla en el módulo Caja.
              </p>
            )}
            {pideReferencia && (
              <Campo etiqueta="N° de operación / voucher *" valor={referencia} onCambiar={setReferencia} />
            )}
            <Campo etiqueta="N° de boleta (opcional)" valor={boleta} onCambiar={setBoleta} />
            <Campo etiqueta="Nota (opcional)" valor={nota} onCambiar={setNota} />

            <button
              type="button"
              disabled={!valido || pendiente}
              onClick={enviar}
              className="w-full px-4 py-3 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
            >
              {pendiente ? "Registrando…" : `Registrar pago ${monto > 0 ? formatearPesos(monto) : ""}`}
            </button>

            {aviso && (
              <div
                className={`rounded-xl px-3 py-2 text-sm font-semibold border ${
                  aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {aviso.texto}
                {aviso.pagoId && (
                  <Link href={`/pacientes/${pacienteId}/pagos/${aviso.pagoId}`} className="ml-2 font-black underline">
                    Ver comprobante
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function FilasGrupo({
  tratamiento,
  lista,
  asignado,
  onCambiar,
}: {
  tratamiento: string
  lista: ItemCobrable[]
  asignado: Record<string, number>
  onCambiar: (item: ItemCobrable, valor: number) => void
}) {
  return (
    <>
      <tr className="bg-gray-100/70">
        <td colSpan={4} className="px-3 py-1.5 text-xs font-black text-gray-600">
          {tratamiento}
        </td>
      </tr>
      {lista.map((i) => (
        <tr key={i.id} className="border-t border-gray-100">
          <td className="px-3 py-2">
            <p className="font-semibold text-gray-900">{i.nombre}</p>
            <p className="text-xs text-gray-500">
              {i.pieza ? `Pieza ${i.pieza} · ` : ""}
              {i.progreso}% realizado · valor {formatearPesos(i.precio)}
            </p>
          </td>
          <td className={`px-3 py-2 text-right font-bold ${deudaDe(i) > 0 ? "text-orange-700" : "text-gray-400"}`}>
            {formatearPesos(deudaDe(i))}
          </td>
          <td className="px-3 py-2 text-right font-semibold text-gray-700">{formatearPesos(saldoDe(i))}</td>
          <td className="px-3 py-2 text-right">
            <input
              inputMode="numeric"
              value={asignado[i.id] ? asignado[i.id].toLocaleString("es-CL") : ""}
              onChange={(e) => onCambiar(i, soloNumero(e.target.value))}
              placeholder="0"
              className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-right font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </td>
        </tr>
      ))}
    </>
  )
}

function Campo({ etiqueta, valor, onCambiar }: { etiqueta: string; valor: string; onCambiar: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-black uppercase tracking-wider text-gray-500">{etiqueta}</span>
      <input
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  )
}

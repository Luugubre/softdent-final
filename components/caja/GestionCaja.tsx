"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { abrirCaja, anularMovimiento, cerrarCaja, registrarMovimiento } from "@/app/caja/actions"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { ORIGEN_MOVIMIENTO, type Caja, type MetodoPagoCatalogo, type MovimientoCaja } from "@/types/admin"

const input = "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
const etiqueta = "block text-xs font-black uppercase tracking-wider text-gray-500 mb-1"
const soloNumero = (v: string) => v.replace(/\D/g, "")
const conPuntos = (v: string) => (v ? Number(v).toLocaleString("es-CL") : "")

function Tarjeta({ titulo, valor, nota, estilo }: { titulo: string; valor: string; nota?: string; estilo: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${estilo}`}>
      <p className="text-[11px] font-black uppercase tracking-wider opacity-70">{titulo}</p>
      <p className="text-2xl font-black">{valor}</p>
      {nota && <p className="text-[11px] font-semibold opacity-70">{nota}</p>}
    </div>
  )
}

export function GestionCaja({
  caja,
  movimientos,
  esperado,
  metodos,
  usuario,
}: {
  caja: Caja | null
  movimientos: MovimientoCaja[]
  esperado: number
  metodos: MetodoPagoCatalogo[]
  usuario: string
}) {
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()
  const ejecutar = (fn: () => Promise<{ ok: boolean; mensaje: string }>, alTerminar?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) alTerminar?.()
    })

  // Apertura
  const [inicial, setInicial] = useState("")
  const [nota, setNota] = useState("")
  // Movimiento
  const efectivo = metodos.find((m) => m.es_efectivo)?.codigo ?? metodos[0]?.codigo ?? ""
  const [mov, setMov] = useState({ tipo: "EGRESO" as "INGRESO" | "EGRESO", monto: "", metodo: efectivo, descripcion: "" })
  // Cierre
  const [contado, setContado] = useState("")
  const [justificacion, setJustificacion] = useState("")

  const avisoUI = aviso && (
    <p className={`rounded-xl px-4 py-2.5 text-sm font-semibold border ${aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
      {aviso.texto}
    </p>
  )

  // ---------------- CAJA CERRADA → APERTURA ----------------
  if (!caja) {
    return (
      <div className="space-y-4">
        {avisoUI}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 max-w-lg mx-auto text-center space-y-5">
          <p className="text-5xl">🔒</p>
          <div>
            <h2 className="text-2xl font-black text-gray-900">Caja cerrada</h2>
            <p className="text-sm font-medium text-gray-500">Abre la caja con el efectivo inicial para recibir pagos en efectivo y registrar movimientos.</p>
          </div>
          <div className="text-left space-y-3">
            <label className="block">
              <span className={etiqueta}>Monto inicial en efectivo</span>
              <input inputMode="numeric" value={conPuntos(inicial)} onChange={(e) => setInicial(soloNumero(e.target.value))} placeholder="$0" className={`${input} text-lg`} />
            </label>
            <label className="block">
              <span className={etiqueta}>Nota (opcional)</span>
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: turno mañana" className={input} />
            </label>
            <p className="text-xs font-semibold text-gray-500">Responsable: {usuario}</p>
            <button
              disabled={pendiente || inicial === ""}
              onClick={() => ejecutar(() => abrirCaja(inicial, nota))}
              className="w-full py-3 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
            >
              {pendiente ? "Abriendo…" : "Abrir caja"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------- CAJA ABIERTA ----------------
  const validos = movimientos.filter((m) => !m.anulado)
  const ingresos = validos.filter((m) => m.tipo === "INGRESO").reduce((s, m) => s + m.monto, 0)
  const egresos = validos.filter((m) => m.tipo === "EGRESO").reduce((s, m) => s + m.monto, 0)
  const diferencia = contado === "" ? null : Number(contado) - esperado

  return (
    <div className="space-y-6">
      {avisoUI}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta titulo="Monto inicial" valor={formatearPesos(caja.monto_inicial)} nota={`Caja N° ${caja.numero} · ${caja.abridor?.nombre_completo ?? ""}`} estilo="bg-white border-gray-200 text-gray-900" />
        <Tarjeta titulo="Ingresos" valor={`+${formatearPesos(ingresos)}`} nota="Todos los métodos" estilo="bg-emerald-50 border-emerald-200 text-emerald-800" />
        <Tarjeta titulo="Egresos" valor={`-${formatearPesos(egresos)}`} nota="Gastos, retiros, devoluciones" estilo="bg-rose-50 border-rose-200 text-rose-800" />
        <Tarjeta titulo="Efectivo esperado" valor={formatearPesos(esperado)} nota="Base para el arqueo" estilo="bg-blue-50 border-blue-200 text-blue-900" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* MOVIMIENTO MANUAL */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h3 className="text-lg font-extrabold text-gray-900">Registrar movimiento</h3>
          <p className="text-xs font-medium text-gray-500">Los pagos de pacientes entran solos. Aquí van gastos menores, retiros u otros ingresos.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex bg-gray-100 rounded-xl p-1">
              {(["INGRESO", "EGRESO"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMov({ ...mov, tipo: t })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black ${mov.tipo === t ? (t === "INGRESO" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white") : "text-gray-600"}`}
                >
                  {t === "INGRESO" ? "+ Ingreso" : "− Egreso"}
                </button>
              ))}
            </div>
            <input inputMode="numeric" value={conPuntos(mov.monto)} onChange={(e) => setMov({ ...mov, monto: soloNumero(e.target.value) })} placeholder="Monto" className={input} />
          </div>
          <select value={mov.metodo} onChange={(e) => setMov({ ...mov, metodo: e.target.value })} className={input}>
            {metodos.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nombre}
              </option>
            ))}
          </select>
          <input value={mov.descripcion} onChange={(e) => setMov({ ...mov, descripcion: e.target.value })} placeholder="Motivo (ej: compra de insumos)" className={input} />
          <button
            disabled={pendiente || !mov.monto || mov.descripcion.trim().length < 3}
            onClick={() => ejecutar(() => registrarMovimiento(mov), () => setMov({ ...mov, monto: "", descripcion: "" }))}
            className="w-full py-2.5 rounded-xl font-black text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40"
          >
            Registrar
          </button>
        </section>

        {/* ARQUEO Y CIERRE */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h3 className="text-lg font-extrabold text-gray-900">Arqueo y cierre</h3>
          <p className="text-xs font-medium text-gray-500">
            Cuenta el efectivo de la gaveta. Debería haber <strong>{formatearPesos(esperado)}</strong>.
          </p>
          <label className="block">
            <span className={etiqueta}>Efectivo contado</span>
            <input inputMode="numeric" value={conPuntos(contado)} onChange={(e) => setContado(soloNumero(e.target.value))} placeholder="$0" className={`${input} text-lg`} />
          </label>
          {diferencia !== null && (
            <p
              className={`rounded-xl px-3 py-2 text-sm font-black ${
                diferencia === 0 ? "bg-emerald-50 text-emerald-700" : diferencia > 0 ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {diferencia === 0 ? "✔ Cuadra exacto" : diferencia > 0 ? `Sobrante de ${formatearPesos(diferencia)}` : `Faltante de ${formatearPesos(-diferencia)}`}
            </p>
          )}
          {diferencia !== null && diferencia !== 0 && (
            <input value={justificacion} onChange={(e) => setJustificacion(e.target.value)} placeholder="Justificación de la diferencia (obligatoria)" className={input} />
          )}
          <button
            disabled={pendiente || contado === "" || (diferencia !== 0 && !justificacion.trim())}
            onClick={() => {
              if (window.confirm("¿Cerrar la caja? Una caja cerrada ya no se puede modificar.")) ejecutar(() => cerrarCaja(caja.id, contado, justificacion))
            }}
            className="w-full py-2.5 rounded-xl font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40"
          >
            Cerrar caja
          </button>
        </section>
      </div>

      {/* MOVIMIENTOS */}
      <TablaMovimientos movimientos={movimientos} metodos={metodos} puedeAnular onAnular={(m) => {
        const motivo = window.prompt(`Motivo de la anulación de "${m.descripcion}":`)
        if (motivo?.trim()) ejecutar(() => anularMovimiento(m.id, motivo))
      }} pendiente={pendiente} />
    </div>
  )
}

export function TablaMovimientos({
  movimientos,
  metodos,
  puedeAnular,
  onAnular,
  pendiente,
}: {
  movimientos: MovimientoCaja[]
  metodos: { codigo: string; nombre: string }[]
  puedeAnular?: boolean
  onAnular?: (m: MovimientoCaja) => void
  pendiente?: boolean
}) {
  const nombreMetodo = (c: string) => metodos.find((m) => m.codigo === c)?.nombre ?? c
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
      <h3 className="text-lg font-extrabold text-gray-900">Movimientos ({movimientos.length})</h3>
      {movimientos.length === 0 ? (
        <p className="text-sm font-semibold text-gray-400">Sin movimientos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="text-left py-2">Hora</th>
                <th className="text-left py-2">Origen</th>
                <th className="text-left py-2">Descripción</th>
                <th className="text-left py-2">Método</th>
                <th className="text-right py-2">Monto</th>
                <th className="text-left py-2 pl-3">Responsable</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className={`border-b border-gray-100 align-top ${m.anulado ? "opacity-50" : ""}`}>
                  <td className="py-2 whitespace-nowrap text-gray-500">{formatearFechaHora(m.created_at).slice(-5)}</td>
                  <td className="py-2 text-xs font-bold text-gray-600">{ORIGEN_MOVIMIENTO[m.origen] ?? m.origen}</td>
                  <td className="py-2">
                    <span className={m.anulado ? "line-through" : ""}>{m.descripcion}</span>
                    {m.pago?.paciente_id && (
                      <Link href={`/pacientes/${m.pago.paciente_id}/pagos`} className="ml-1 text-xs font-bold text-blue-600 hover:underline">
                        ver
                      </Link>
                    )}
                    {m.anulado && <p className="text-xs font-bold text-rose-700">Anulado: {m.motivo_anulacion}</p>}
                  </td>
                  <td className="py-2 text-xs font-semibold">{nombreMetodo(m.metodo)}</td>
                  <td className={`py-2 text-right font-black whitespace-nowrap ${m.tipo === "INGRESO" ? "text-emerald-700" : "text-rose-700"}`}>
                    {m.tipo === "INGRESO" ? "+" : "−"}
                    {formatearPesos(m.monto)}
                  </td>
                  <td className="py-2 pl-3 text-xs text-gray-500">{m.registrador?.nombre_completo ?? "—"}</td>
                  <td className="py-2 text-right">
                    {puedeAnular && !m.anulado && (m.origen === "MANUAL" || m.origen === "AJUSTE") && !m.pago_id && (
                      <button disabled={pendiente} onClick={() => onAnular?.(m)} className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100">
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

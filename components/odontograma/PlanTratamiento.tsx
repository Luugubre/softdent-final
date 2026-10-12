"use client"

import Link from "next/link"
import { Fragment, useState, useTransition } from "react"
import { anularItem, evolucionarItem } from "@/app/pacientes/[id]/odontograma/actions"
import { asignarFase } from "@/app/pacientes/[id]/tratamientos/actions"
import type { Fase } from "@/types/tratamiento"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { ESTADO_ITEM_ETIQUETAS, PASOS_AVANCE, type Avance, type ItemTratamiento } from "@/types/odontograma"

const ESTILO_ESTADO = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  EN_PROCESO: "bg-blue-100 text-blue-800",
  REALIZADO: "bg-emerald-100 text-emerald-800",
  ANULADO: "bg-gray-200 text-gray-500",
} as const

function Tarjeta({ titulo, valor, destacar }: { titulo: string; valor: number; destacar?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${destacar ? "bg-orange-50 border-orange-300" : "bg-white border-gray-200"}`}>
      <p className={`text-[11px] font-black uppercase tracking-wider ${destacar ? "text-orange-700" : "text-gray-500"}`}>{titulo}</p>
      <p className={`text-xl font-black ${destacar ? "text-orange-700" : "text-gray-900"}`}>{formatearPesos(valor)}</p>
    </div>
  )
}

export function PlanTratamiento({
  pacienteId,
  items,
  avances,
  plan,
  puedeEvolucionar,
  puedeAnular,
  fases = [],
  puedeOrganizar = false,
}: {
  pacienteId: string
  items: ItemTratamiento[]
  avances: Avance[]
  plan: { nombre: string; arancel: { nombre: string } | null } | null
  puedeEvolucionar: boolean
  puedeAnular: boolean
  fases?: Fase[]
  puedeOrganizar?: boolean
}) {
  const [verAnulados, setVerAnulados] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  const activos = items.filter((i) => i.estado !== "ANULADO")
  const anulados = items.filter((i) => i.estado === "ANULADO")
  const visibles = verAnulados ? items : activos

  const total = activos.reduce((s, i) => s + i.precio, 0)
  const habilitado = activos.reduce((s, i) => s + i.monto_habilitado, 0)
  const abonado = activos.reduce((s, i) => s + i.abonado, 0)
  const porPagar = habilitado - abonado
  const porCobrar = activos.filter((i) => i.monto_habilitado - i.abonado > 0)
  const conFases = fases.length > 0
  const columnaFase = conFases && puedeOrganizar
  const grupos = conFases
    ? [
        ...fases.map((f) => ({ clave: f.id, fase: f as Fase | null, items: visibles.filter((i) => i.fase_id === f.id) })),
        { clave: "sin-fase", fase: null as Fase | null, items: visibles.filter((i) => !i.fase_id || !fases.some((f) => f.id === i.fase_id)) },
      ].filter((g) => g.fase !== null || g.items.length > 0)
    : [{ clave: "todas", fase: null as Fase | null, items: visibles }]

  function cambiarFase(item: ItemTratamiento, faseId: string) {
    startTransition(async () => {
      const res = await asignarFase(pacienteId, item.id, faseId || null)
      setAviso({ ok: res.ok, texto: res.mensaje })
    })
  }

  function evolucionar(item: ItemTratamiento, paso: number) {
    const nombre = item.prestacion?.nombre ?? "prestación"
    const monto = Math.round((item.precio * paso) / 100) - Math.round((item.precio * item.progreso) / 100)
    const nota = window.prompt(
      `Evolucionar "${nombre}"${item.pieza ? ` (pieza ${item.pieza})` : ""} de ${item.progreso}% a ${paso}%.\n` +
        `Se habilitarán ${formatearPesos(monto)} para cobrar.\n\nNota de la evolución (opcional):`
    )
    if (nota === null) return
    startTransition(async () => {
      const res = await evolucionarItem(pacienteId, item.id, paso, nota)
      setAviso({ ok: res.ok, texto: res.mensaje })
    })
  }

  function anular(item: ItemTratamiento) {
    const motivo = window.prompt(`Motivo para anular "${item.prestacion?.nombre}":`)
    if (!motivo) return
    startTransition(async () => {
      const res = await anularItem(pacienteId, item.id, motivo)
      setAviso({ ok: res.ok, texto: res.mensaje })
    })
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Prestaciones del tratamiento</h2>
          <p className="text-xs font-medium text-gray-500">
            {plan?.arancel ? `Arancel: ${plan.arancel.nombre}` : ""}
          </p>
        </div>
        {anulados.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <input type="checkbox" checked={verAnulados} onChange={(e) => setVerAnulados(e.target.checked)} />
            Ver anuladas ({anulados.length})
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta titulo="Total del plan" valor={total} />
        <Tarjeta titulo="Realizado (habilitado)" valor={habilitado} />
        <Tarjeta titulo="Abonado" valor={abonado} />
        <Tarjeta titulo="Por pagar" valor={porPagar} destacar={porPagar > 0} />
      </div>

      {porCobrar.length > 0 && (
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4 space-y-2">
          <p className="text-sm font-black text-orange-800">💳 Listo para cobrar</p>
          <ul className="divide-y divide-orange-200">
            {porCobrar.map((i) => (
              <li key={i.id} className="py-1.5 flex justify-between gap-3 text-sm">
                <span className="font-semibold text-gray-800">
                  {i.prestacion?.nombre}
                  {i.pieza && <span className="text-gray-500"> · pieza {i.pieza}</span>}
                  <span className="text-gray-500"> · {i.progreso}%</span>
                </span>
                <span className="font-extrabold text-orange-800">{formatearPesos(i.monto_habilitado - i.abonado)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] font-medium text-orange-700">
              Estos montos se habilitan a medida que se evoluciona cada prestación.
            </p>
            <Link
              href={`/pacientes/${pacienteId}/pagos`}
              className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-orange-600 hover:bg-orange-700"
            >
              Ir a Pagos →
            </Link>
          </div>
        </div>
      )}

      {aviso && (
        <p
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold border ${
            aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="py-6 text-center text-sm font-semibold text-gray-400">
          Aún no hay prestaciones. Agrégalas haciendo clic en un diente del odontograma de este tratamiento.
        </p>
      ) : (
        <div className={`overflow-x-auto ${pendiente ? "opacity-60" : ""}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-bold uppercase text-gray-500">
                {columnaFase && <th className="py-2 pr-3">Fase</th>}
                <th className="py-2 pr-3">Pieza</th>
                <th className="py-2 pr-3">Prestación</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3">Avance</th>
                <th className="py-2 pr-3 text-right">Por pagar</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grupos.map((g) => (
                <Fragment key={g.clave}>
                  {conFases && (
                    <tr className="bg-blue-50/70">
                      <td colSpan={columnaFase ? 7 : 6} className="px-2 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-blue-900">
                            {g.fase ? (
                              <>
                                <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-xs text-white">{g.fase.numero}</span>
                                {g.fase.nombre}
                                {g.fase.descripcion && <span className="ml-2 text-xs font-semibold text-blue-700">· {g.fase.descripcion}</span>}
                              </>
                            ) : (
                              <span className="text-amber-800">Sin fase asignada</span>
                            )}
                          </p>
                          <p className="text-xs font-black text-blue-900">
                            {g.items.filter((i) => i.estado !== "ANULADO").length} prestación(es) · Subtotal{" "}
                            {formatearPesos(g.items.filter((i) => i.estado !== "ANULADO").reduce((s, i) => s + i.precio, 0))}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {conFases && g.items.length === 0 && (
                    <tr>
                      <td colSpan={columnaFase ? 7 : 6} className="py-3 text-center text-xs font-semibold text-gray-400">
                        Sin prestaciones en esta fase todavía.
                      </td>
                    </tr>
                  )}
              {g.items.map((i) => {
                const historial = avances.filter((a) => a.item_id === i.id)
                const saldo = i.monto_habilitado - i.abonado
                return (
                  <tr key={i.id} className={`align-top ${i.estado === "ANULADO" ? "opacity-50" : ""}`}>
                    {columnaFase && (
                      <td className="py-3 pr-3">
                        <select
                          value={i.fase_id ?? ""}
                          disabled={pendiente || i.estado === "ANULADO"}
                          onChange={(e) => cambiarFase(i, e.target.value)}
                          className="max-w-[140px] rounded-lg border border-gray-300 px-1.5 py-1 text-xs font-bold text-gray-700"
                        >
                          <option value="">Sin fase</option>
                          {fases.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.numero}. {f.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="py-3 pr-3 font-mono font-black text-gray-900">{i.pieza ?? "—"}</td>
                    <td className="py-3 pr-3">
                      <p className="font-bold text-gray-900">{i.prestacion?.nombre}</p>
                      <p className="text-[11px] font-mono text-gray-400">
                        {i.prestacion?.codigo_interno}
                        {i.caras.length > 0 && ` · caras ${i.caras.join(", ")}`}
                      </p>
                      {i.nota && <p className="text-xs text-gray-500">{i.nota}</p>}
                      {i.motivo_anulacion && <p className="text-xs text-gray-500">Anulada: {i.motivo_anulacion}</p>}
                      {historial.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] font-bold text-blue-600">
                            {historial.length} avance{historial.length === 1 ? "" : "s"}
                          </summary>
                          {historial.map((a) => (
                            <p key={a.id} className="text-[11px] text-gray-500">
                              {formatearFechaHora(a.created_at)} · {a.progreso_anterior}% → {a.progreso_nuevo}% ·{" "}
                              {formatearPesos(a.monto)}
                              {a.profesional && ` · ${a.profesional.nombre_completo}`}
                              {a.nota && ` · ${a.nota}`}
                            </p>
                          ))}
                        </details>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right font-extrabold text-gray-900 whitespace-nowrap">{formatearPesos(i.precio)}</td>
                    <td className="py-3 pr-3 min-w-[150px]">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${ESTILO_ESTADO[i.estado]}`}>
                        {ESTADO_ITEM_ETIQUETAS[i.estado]}
                      </span>
                      <div className="mt-1.5 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full ${i.progreso === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                          style={{ width: `${i.progreso}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-bold text-gray-500 mt-0.5">{i.progreso}%</p>
                    </td>
                    <td className={`py-3 pr-3 text-right font-extrabold whitespace-nowrap ${saldo > 0 ? "text-orange-700" : "text-gray-400"}`}>
                      {formatearPesos(saldo)}
                    </td>
                    <td className="py-3">
                      {i.estado !== "ANULADO" && i.estado !== "REALIZADO" && puedeEvolucionar && (
                        <div className="flex gap-1">
                          {PASOS_AVANCE.map((paso) => (
                            <button
                              key={paso}
                              disabled={paso <= i.progreso || pendiente}
                              onClick={() => evolucionar(i, paso)}
                              title={`Evolucionar al ${paso}%`}
                              className="px-2 py-1 rounded-lg text-[11px] font-black border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-white"
                            >
                              {paso}%
                            </button>
                          ))}
                        </div>
                      )}
                      {i.estado === "PENDIENTE" && puedeAnular && (
                        <button
                          onClick={() => anular(i)}
                          disabled={pendiente}
                          className="mt-1 text-[11px] font-bold text-gray-400 hover:text-rose-600"
                        >
                          Anular
                        </button>
                      )}
                      {i.estado === "REALIZADO" && <span className="text-xs font-bold text-emerald-700">✓ Completada</span>}
                    </td>
                  </tr>
                )
              })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

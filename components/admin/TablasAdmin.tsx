"use client"

import { useState, useTransition } from "react"
import { actualizarParametro, guardarCatalogo, guardarMetodoPago } from "@/app/administracion/actions"
import { formatearFechaHora } from "@/lib/formato"
import { Termino } from "@/components/ui/Ayuda"
import { CATALOGOS, TIPOS_PREVISION, type ItemCatalogo, type MetodoPagoCatalogo, type Parametro, type TablaCatalogo } from "@/types/admin"

const input = "rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
const caja = "bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4"

function useAviso() {
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()
  const ejecutar = (fn: () => Promise<{ ok: boolean; mensaje: string }>, alTerminar?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) alTerminar?.()
    })
  const Aviso = aviso ? (
    <p className={`text-sm font-semibold ${aviso.ok ? "text-emerald-700" : "text-rose-700"}`}>{aviso.texto}</p>
  ) : null
  return { ejecutar, pendiente, Aviso }
}

export function TablaCatalogo({ tabla, items }: { tabla: TablaCatalogo; items: ItemCatalogo[] }) {
  const meta = CATALOGOS[tabla]
  const [nuevo, setNuevo] = useState({ nombre: "", descripcion: "", tipo: "OTRA", duracion_min: 30 })
  const [editando, setEditando] = useState<ItemCatalogo | null>(null)
  const { ejecutar, pendiente, Aviso } = useAviso()

  return (
    <section id={tabla} className={`${caja} scroll-mt-20`}>
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">
          <span aria-hidden className="mr-1.5">
            {meta.icono}
          </span>
          {meta.titulo}
        </h2>
        <p className="text-xs font-semibold text-gray-600">{meta.que}</p>
        <p className="text-[11px] font-bold text-blue-700">📍 Se usa en: {meta.ayuda}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nuevo nombre" className={`${input} flex-1 min-w-36`} />
        {meta.conDescripcion && (
          <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Descripción" className={`${input} flex-1 min-w-36`} />
        )}
        {tabla === "previsiones" && (
          <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} className={input}>
            {TIPOS_PREVISION.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}
        {tabla === "tipos_atencion" && (
          <input type="number" min={5} max={480} step={5} value={nuevo.duracion_min} onChange={(e) => setNuevo({ ...nuevo, duracion_min: Number(e.target.value) })} className={`${input} w-24`} title="Duración (min)" />
        )}
        <button
          disabled={pendiente || !nuevo.nombre.trim()}
          onClick={() => ejecutar(() => guardarCatalogo(tabla, nuevo), () => setNuevo({ nombre: "", descripcion: "", tipo: "OTRA", duracion_min: 30 }))}
          className="px-4 py-1.5 rounded-lg text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
      {Aviso}

      <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {items.map((it) =>
          editando?.id === it.id ? (
            <li key={it.id} className="py-2 flex flex-wrap items-center gap-2">
              <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className={`${input} flex-1 min-w-32`} />
              {meta.conDescripcion && (
                <input value={editando.descripcion ?? ""} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} placeholder="Descripción" className={`${input} flex-1 min-w-32`} />
              )}
              {tabla === "previsiones" && (
                <select value={editando.tipo ?? "OTRA"} onChange={(e) => setEditando({ ...editando, tipo: e.target.value })} className={input}>
                  {TIPOS_PREVISION.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              )}
              {tabla === "tipos_atencion" && (
                <input type="number" min={5} max={480} step={5} value={editando.duracion_min ?? 30} onChange={(e) => setEditando({ ...editando, duracion_min: Number(e.target.value) })} className={`${input} w-24`} />
              )}
              <button
                disabled={pendiente}
                onClick={() =>
                  ejecutar(
                    () =>
                      guardarCatalogo(tabla, {
                        id: it.id,
                        nombre: editando.nombre,
                        activo: it.activo,
                        descripcion: editando.descripcion ?? undefined,
                        tipo: editando.tipo ?? undefined,
                        duracion_min: editando.duracion_min ?? undefined,
                      }),
                    () => setEditando(null)
                  )
                }
                className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-emerald-600"
              >
                Guardar
              </button>
              <button onClick={() => setEditando(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 bg-gray-100">
                Cancelar
              </button>
            </li>
          ) : (
            <li key={it.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`font-bold truncate ${it.activo ? "text-gray-900" : "text-gray-400 line-through"}`}>
                  {it.nombre}
                  {it.tipo ? <span className="ml-2 text-[10px] font-black text-gray-400">{it.tipo}</span> : null}
                  {tabla === "tipos_atencion" && it.duracion_min ? <span className="ml-2 text-[10px] font-black text-gray-400">{it.duracion_min} min</span> : null}
                </p>
                {it.descripcion && <p className="text-xs text-gray-500 truncate">{it.descripcion}</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => setEditando(it)} className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100">
                  Editar
                </button>
                <button
                  disabled={pendiente}
                  onClick={() =>
                    ejecutar(() =>
                      guardarCatalogo(tabla, {
                        id: it.id,
                        nombre: it.nombre,
                        activo: !it.activo,
                        descripcion: it.descripcion ?? undefined,
                        tipo: it.tipo ?? undefined,
                        duracion_min: it.duracion_min ?? undefined,
                      })
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${it.activo ? "text-gray-600 bg-gray-100 hover:bg-gray-200" : "text-emerald-800 bg-emerald-100 hover:bg-emerald-200"}`}
                >
                  {it.activo ? "Desactivar" : "Activar"}
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </section>
  )
}

export function TablaMetodosPago({ metodos }: { metodos: MetodoPagoCatalogo[] }) {
  const vacio = { codigo: "", nombre: "", es_efectivo: false, pide_referencia: true, registra_en_caja: true, activo: true }
  const [nuevo, setNuevo] = useState(vacio)
  const { ejecutar, pendiente, Aviso } = useAviso()
  const marca = (v: boolean) => (v ? "✔" : "—")

  return (
    <section id="metodos-pago" className={`${caja} scroll-mt-20`}>
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">💳 Métodos de pago</h2>
        <p className="text-xs font-semibold text-gray-600">Las formas en que la clínica recibe dinero. Haz clic en ✔ / — para activar o desactivar cada opción.</p>
        <p className="text-[11px] font-bold text-blue-700">📍 Se usa en: Pagos del paciente, Caja y cuotas de convenios</p>
      </div>
      <dl className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 md:grid-cols-3">
        <div>
          <dt className="font-black text-gray-800">💵 Efectivo</dt>
          <dd>Es dinero físico: se cuenta en el arqueo al cerrar la caja.</dd>
        </div>
        <div>
          <dt className="font-black text-gray-800">🔢 Pide N° operación</dt>
          <dd>Obliga a escribir el N° de voucher, transferencia o cheque.</dd>
        </div>
        <div>
          <dt className="font-black text-gray-800">💰 Entra a caja</dt>
          <dd>Exige caja abierta y se registra solo como ingreso. Desmárcalo si el dinero no pasa por recepción (ej. Bono FONASA).</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 p-3">
        <input value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })} placeholder="CÓDIGO (ej: CHEQUE)" className={`${input} w-40 uppercase`} />
        <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre" className={`${input} flex-1 min-w-32`} />
        {(["es_efectivo", "pide_referencia", "registra_en_caja"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1 text-xs font-bold text-gray-600">
            <input type="checkbox" checked={nuevo[k]} onChange={(e) => setNuevo({ ...nuevo, [k]: e.target.checked })} />
            {k === "es_efectivo" ? "Efectivo" : k === "pide_referencia" ? "Pide N° operación" : "Entra a caja"}
          </label>
        ))}
        <button
          disabled={pendiente || !nuevo.codigo.trim() || !nuevo.nombre.trim()}
          onClick={() => ejecutar(() => guardarMetodoPago({ ...nuevo, nuevo: true }), () => setNuevo(vacio))}
          className="px-4 py-1.5 rounded-lg text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
      {Aviso}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
            <tr>
              <th className="text-left py-2">Código</th>
              <th className="text-left py-2">Nombre</th>
              <th className="py-2">💵 Efectivo</th>
              <th className="py-2">🔢 Pide N°</th>
              <th className="py-2">💰 Entra a caja</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {metodos.map((m) => (
              <tr key={m.codigo} className={`border-b border-gray-100 ${m.activo ? "" : "text-gray-400"}`}>
                <td className="py-2 font-mono text-xs font-bold">{m.codigo}</td>
                <td className={`py-2 font-semibold ${m.activo ? "" : "line-through"}`}>{m.nombre}</td>
                {(["es_efectivo", "pide_referencia", "registra_en_caja"] as const).map((k) => (
                  <td key={k} className="py-2 text-center">
                    <button
                      disabled={pendiente}
                      onClick={() => ejecutar(() => guardarMetodoPago({ ...m, [k]: !m[k], nuevo: false }))}
                      className="w-8 rounded hover:bg-gray-100 font-black"
                      title="Cambiar"
                    >
                      {marca(m[k])}
                    </button>
                  </td>
                ))}
                <td className="py-2 text-right">
                  <button
                    disabled={pendiente}
                    onClick={() => ejecutar(() => guardarMetodoPago({ ...m, activo: !m.activo, nuevo: false }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${m.activo ? "text-gray-600 bg-gray-100" : "text-emerald-800 bg-emerald-100"}`}
                  >
                    {m.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const USO_PARAMETRO: Record<string, { texto: string; pendiente?: boolean }> = {
  "clinica.nombre": { texto: "Comprobantes, presupuestos, hoja de ruta, caja y liquidaciones" },
  "clinica.rut": { texto: "Presupuesto impreso" },
  "clinica.direccion": { texto: "Presupuesto impreso" },
  "clinica.telefono": { texto: "Presupuesto impreso" },
  "seguridad.intentos_login": { texto: "Bloqueo del login", pendiente: true },
  "seguridad.minutos_bloqueo": { texto: "Bloqueo del login", pendiente: true },
  "seguridad.minutos_inactividad": { texto: "Cierre de sesión automático", pendiente: true },
  "agenda.horas_recordatorio": { texto: "Recordatorios automáticos", pendiente: true },
  "agenda.duracion_defecto": { texto: "Duración sugerida al agendar", pendiente: true },
  "liquidaciones.porcentaje_defecto": { texto: "% sugerido al crear un dentista", pendiente: true },
  "deudas.dias_vencimiento": { texto: "Deuda vencida del paciente", pendiente: true },
}

export function TablaParametros({ parametros }: { parametros: Parametro[] }) {
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(parametros.map((p) => [p.clave, p.valor])))
  const { ejecutar, pendiente, Aviso } = useAviso()
  const grupos = [...new Set(parametros.map((p) => p.grupo))]

  return (
    <section id="parametros" className={`${caja} scroll-mt-20`}>
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">🔧 Parámetros del sistema</h2>
        <p className="text-xs font-semibold text-gray-600">
          Valores generales. Cambia el valor y presiona <strong>Guardar</strong> (aparece al modificar). Entre paréntesis está el rango
          permitido.
        </p>
        <p className="text-[11px] font-bold text-gray-400">
          Cada cambio queda en el <Termino t="auditoria">registro de cambios</Termino> (quién, cuándo y el valor anterior).
        </p>
      </div>
      {Aviso}
      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <div key={g} className="rounded-xl border border-gray-200 p-3 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">{g}</p>
            {parametros
              .filter((p) => p.grupo === g)
              .map((p) => {
                const cambiado = valores[p.clave] !== p.valor
                return (
                  <div key={p.clave} className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">
                      {p.descripcion}
                      {p.minimo !== null && p.maximo !== null && <span className="text-gray-400 font-semibold"> ({p.minimo}–{p.maximo})</span>}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        value={valores[p.clave] ?? ""}
                        inputMode={p.tipo === "TEXTO" ? "text" : "numeric"}
                        onChange={(e) => setValores({ ...valores, [p.clave]: e.target.value })}
                        className={`${input} flex-1`}
                      />
                      {cambiado && (
                        <button
                          disabled={pendiente}
                          onClick={() => ejecutar(() => actualizarParametro(p.clave, valores[p.clave]))}
                          className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600"
                        >
                          Guardar
                        </button>
                      )}
                    </div>
                    {USO_PARAMETRO[p.clave] && (
                      <p className={`text-[11px] font-bold ${USO_PARAMETRO[p.clave].pendiente ? "text-amber-700" : "text-blue-700"}`}>
                        {USO_PARAMETRO[p.clave].pendiente ? "⏳ Se usará en: " : "📍 Se usa en: "}
                        {USO_PARAMETRO[p.clave].texto}
                        {USO_PARAMETRO[p.clave].pendiente ? " (pendiente de implementar)" : ""}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400">
                      <span className="font-mono">{p.clave}</span> · actualizado {formatearFechaHora(p.updated_at)}
                    </p>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </section>
  )
}

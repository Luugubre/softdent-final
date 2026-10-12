"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { actualizarConvenio, agregarBeneficiario, cambiarBeneficiario, crearContrato, crearConvenio, pagarCuota } from "@/app/fonasa-convenios/actions"
import { campo, etiqueta, SelectorPaciente } from "@/components/fonasa/Buscadores"
import { formatearFecha, formatearFechaHora, formatearPesos } from "@/lib/formato"
import { sumarMeses } from "@/lib/fechas-agenda"
import { convenioVigente, TIPOS_CONVENIO, type ContratoCuotas, type Convenio, type MetodoPagoCatalogo } from "@/types/admin"

const soloNumero = (v: string) => v.replace(/\D/g, "")
const conPuntos = (v: string) => (v ? Number(v).toLocaleString("es-CL") : "")
const tarjeta = "bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3"

function useAccion() {
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()
  const ejecutar = (fn: () => Promise<{ ok: boolean; mensaje: string }>, alTerminar?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) alTerminar?.()
    })
  const Aviso = aviso ? (
    <p className={`rounded-xl px-4 py-2.5 text-sm font-semibold border ${aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
      {aviso.texto}
    </p>
  ) : null
  return { ejecutar, pendiente, Aviso }
}

export function GestionConvenios({ convenios, hoy, puedeConfigurar }: { convenios: Convenio[]; hoy: string; puedeConfigurar: boolean }) {
  const vacio = { nombre: "", institucion: "", tipo: "EMPRESA", descuento: "10", inicio: hoy, fin: "", rut: "", contacto: "", condiciones: "" }
  const [nuevo, setNuevo] = useState(vacio)
  const [abierto, setAbierto] = useState<string | null>(null)
  const { ejecutar, pendiente, Aviso } = useAccion()

  return (
    <div className="space-y-6">
      {Aviso}
      {puedeConfigurar && (
        <section className={tarjeta}>
          <h2 className="text-lg font-extrabold text-gray-900">Nuevo convenio</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre (ej: Sindicato Minera Norte)" className={campo} />
            <input value={nuevo.institucion} onChange={(e) => setNuevo({ ...nuevo, institucion: e.target.value })} placeholder="Empresa / sindicato" className={campo} />
            <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} className={campo}>
              {Object.entries(TIPOS_CONVENIO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <label>
              <span className={etiqueta}>% descuento sobre arancel base</span>
              <input value={nuevo.descuento} onChange={(e) => setNuevo({ ...nuevo, descuento: e.target.value })} inputMode="decimal" className={campo} />
            </label>
            <label>
              <span className={etiqueta}>Vigente desde</span>
              <input type="date" value={nuevo.inicio} onChange={(e) => setNuevo({ ...nuevo, inicio: e.target.value })} className={campo} />
            </label>
            <label>
              <span className={etiqueta}>Hasta (opcional)</span>
              <input type="date" value={nuevo.fin} onChange={(e) => setNuevo({ ...nuevo, fin: e.target.value })} className={campo} />
            </label>
            <input value={nuevo.rut} onChange={(e) => setNuevo({ ...nuevo, rut: e.target.value })} placeholder="RUT institución (opcional)" className={campo} />
            <input value={nuevo.contacto} onChange={(e) => setNuevo({ ...nuevo, contacto: e.target.value })} placeholder="Contacto (opcional)" className={campo} />
            <input value={nuevo.condiciones} onChange={(e) => setNuevo({ ...nuevo, condiciones: e.target.value })} placeholder="Condiciones (opcional)" className={campo} />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-semibold text-gray-500">
              Se crea también el arancel “Convenio {nuevo.nombre || "…"}” en Prestaciones, con el % de descuento. Puedes fijar precios especiales ahí.
            </p>
            <button
              disabled={pendiente || !nuevo.nombre.trim() || !nuevo.institucion.trim()}
              onClick={() => ejecutar(() => crearConvenio(nuevo), () => setNuevo(vacio))}
              className="px-5 py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
            >
              Crear convenio
            </button>
          </div>
        </section>
      )}

      {convenios.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm font-semibold text-gray-400">Aún no hay convenios.</p>
      ) : (
        <div className="space-y-3">
          {convenios.map((c) => (
            <TarjetaConvenio
              key={c.id}
              convenio={c}
              hoy={hoy}
              abierto={abierto === c.id}
              onAbrir={() => setAbierto(abierto === c.id ? null : c.id)}
              puedeConfigurar={puedeConfigurar}
              ejecutar={ejecutar}
              pendiente={pendiente}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TarjetaConvenio({
  convenio: c,
  hoy,
  abierto,
  onAbrir,
  puedeConfigurar,
  ejecutar,
  pendiente,
}: {
  convenio: Convenio
  hoy: string
  abierto: boolean
  onAbrir: () => void
  puedeConfigurar: boolean
  ejecutar: ReturnType<typeof useAccion>["ejecutar"]
  pendiente: boolean
}) {
  const vigente = convenioVigente(c, hoy)
  const activos = c.beneficiarios.filter((b) => b.activo)
  const [edicion, setEdicion] = useState({ descuento: String(c.porcentaje_descuento), fin: c.fecha_fin ?? "", activo: c.activo, condiciones: c.condiciones ?? "" })
  const [paciente, setPaciente] = useState<{ id: string; nombres: string; apellidos: string; rut: string } | null>(null)

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={onAbrir} className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50">
        <div>
          <p className="text-lg font-extrabold text-gray-900">{c.nombre}</p>
          <p className="text-xs font-semibold text-gray-500">
            {TIPOS_CONVENIO[c.tipo]} · {c.institucion}
            {c.rut_institucion ? ` · ${c.rut_institucion}` : ""} · desde {formatearFecha(c.fecha_inicio)}
            {c.fecha_fin ? ` hasta ${formatearFecha(c.fecha_fin)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700">{c.porcentaje_descuento}% dcto.</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-700">{activos.length} beneficiario(s)</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${vigente ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-500"}`}>
            {vigente ? "Vigente" : c.activo ? "Fuera de vigencia" : "Inactivo"}
          </span>
          <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-gray-100 p-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-extrabold text-gray-900">Beneficiarios</h3>
            {vigente ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SelectorPaciente valor={paciente} onCambio={setPaciente} titulo="Agregar beneficiario" />
                </div>
                <button
                  disabled={pendiente || !paciente}
                  onClick={() => paciente && ejecutar(() => agregarBeneficiario(c.id, paciente.id), () => setPaciente(null))}
                  className="px-4 py-2 rounded-xl text-sm font-black text-white bg-blue-600 disabled:opacity-40"
                >
                  Agregar
                </button>
              </div>
            ) : (
              <p className="text-xs font-semibold text-amber-700">El convenio no está vigente: no se pueden agregar beneficiarios.</p>
            )}
            <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {c.beneficiarios.length === 0 && <li className="py-2 text-sm text-gray-400">Sin beneficiarios.</li>}
              {c.beneficiarios.map((b) => (
                <li key={b.id} className="py-2 flex items-center justify-between gap-2">
                  <Link href={`/pacientes/${b.paciente?.id}`} className={`text-sm font-bold uppercase hover:text-blue-700 ${b.activo ? "text-gray-900" : "text-gray-400 line-through"}`}>
                    {b.paciente?.nombres} {b.paciente?.apellidos}
                    <span className="ml-2 text-xs font-semibold normal-case text-gray-500">{b.paciente?.rut}</span>
                  </Link>
                  <button
                    disabled={pendiente}
                    onClick={() => ejecutar(() => cambiarBeneficiario(b.id, !b.activo))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${b.activo ? "text-gray-600 bg-gray-100" : "text-emerald-800 bg-emerald-100"}`}
                  >
                    {b.activo ? "Dar de baja" : "Reactivar"}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-extrabold text-gray-900">Condiciones</h3>
            {c.contacto && <p className="text-sm text-gray-600">Contacto: {c.contacto}</p>}
            {puedeConfigurar ? (
              <div className="space-y-2 rounded-xl bg-gray-50 border border-gray-200 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className={etiqueta}>% descuento</span>
                    <input value={edicion.descuento} onChange={(e) => setEdicion({ ...edicion, descuento: e.target.value })} className={campo} />
                  </label>
                  <label>
                    <span className={etiqueta}>Vigente hasta</span>
                    <input type="date" value={edicion.fin} onChange={(e) => setEdicion({ ...edicion, fin: e.target.value })} className={campo} />
                  </label>
                </div>
                <textarea value={edicion.condiciones} onChange={(e) => setEdicion({ ...edicion, condiciones: e.target.value })} rows={2} placeholder="Condiciones del convenio" className={campo} />
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <input type="checkbox" checked={edicion.activo} onChange={(e) => setEdicion({ ...edicion, activo: e.target.checked })} />
                  Convenio activo
                </label>
                <button
                  disabled={pendiente}
                  onClick={() => ejecutar(() => actualizarConvenio(c.id, edicion))}
                  className="px-4 py-2 rounded-xl text-sm font-black text-white bg-emerald-600 disabled:opacity-40"
                >
                  Guardar cambios
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-600">{c.condiciones ?? "Sin condiciones registradas."}</p>
            )}
            <Link href={`/prestaciones?arancel=${c.arancel_id}`} className="inline-block text-xs font-bold text-blue-600 hover:underline">
              Ver precios del arancel del convenio →
            </Link>
          </div>
        </div>
      )}
    </article>
  )
}

export function GestionCuotas({
  contratos,
  convenios,
  metodos,
  hoy,
}: {
  contratos: ContratoCuotas[]
  convenios: Convenio[]
  metodos: MetodoPagoCatalogo[]
  hoy: string
}) {
  const vigentes = convenios.filter((c) => convenioVigente(c, hoy))
  const [convenioId, setConvenioId] = useState(vigentes[0]?.id ?? "")
  const [pacienteId, setPacienteId] = useState("")
  const [total, setTotal] = useState("")
  const [cantidad, setCantidad] = useState(3)
  const [primer, setPrimer] = useState(hoy)
  const [cuotas, setCuotas] = useState<{ monto: string; vencimiento: string }[]>([])
  const [nota, setNota] = useState("")
  const [pago, setPago] = useState<{ cuotaId: string; metodo: string; referencia: string } | null>(null)
  const { ejecutar, pendiente, Aviso } = useAccion()

  const beneficiarios = useMemo(() => vigentes.find((c) => c.id === convenioId)?.beneficiarios.filter((b) => b.activo) ?? [], [vigentes, convenioId])
  const suma = cuotas.reduce((s, c) => s + (Number(c.monto) || 0), 0)

  function generar() {
    const t = Number(total)
    if (!(t > 0) || cantidad < 1) return
    const base = Math.floor(t / cantidad)
    const resto = t - base * cantidad
    setCuotas(
      Array.from({ length: cantidad }, (_, i) => ({
        monto: String(base + (i === cantidad - 1 ? resto : 0)),
        vencimiento: i === 0 ? primer : `${sumarMeses(primer, i).slice(0, 8)}${primer.slice(8)}`.replace(/-(29|30|31)$/, "-28"),
      }))
    )
  }

  return (
    <div className="space-y-6">
      {Aviso}
      <section className={tarjeta}>
        <h2 className="text-lg font-extrabold text-gray-900">Nuevo contrato en cuotas</h2>
        {vigentes.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">No hay convenios vigentes.</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <label>
                <span className={etiqueta}>Convenio</span>
                <select value={convenioId} onChange={(e) => { setConvenioId(e.target.value); setPacienteId("") }} className={campo}>
                  {vigentes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className={etiqueta}>Beneficiario</span>
                <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)} className={campo}>
                  <option value="">Selecciona…</option>
                  {beneficiarios.map((b) => (
                    <option key={b.id} value={b.paciente?.id}>
                      {b.paciente?.nombres} {b.paciente?.apellidos} · {b.paciente?.rut}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={etiqueta}>Monto pactado</span>
                <input inputMode="numeric" value={conPuntos(total)} onChange={(e) => setTotal(soloNumero(e.target.value))} placeholder="$0" className={campo} />
              </label>
              <label>
                <span className={etiqueta}>N° de cuotas</span>
                <input type="number" min={1} max={60} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className={campo} />
              </label>
              <label>
                <span className={etiqueta}>Primer vencimiento</span>
                <input type="date" value={primer} onChange={(e) => setPrimer(e.target.value)} className={campo} />
              </label>
            </div>
            <button onClick={generar} disabled={!total} className="px-4 py-2 rounded-xl text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40">
              Generar cuotas mensuales
            </button>

            {cuotas.length > 0 && (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {cuotas.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2">
                      <span className="text-xs font-black text-gray-500 w-6">{i + 1}</span>
                      <input
                        inputMode="numeric"
                        value={conPuntos(q.monto)}
                        onChange={(e) => setCuotas(cuotas.map((x, j) => (j === i ? { ...x, monto: soloNumero(e.target.value) } : x)))}
                        className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm font-bold"
                      />
                      <input
                        type="date"
                        value={q.vencimiento}
                        onChange={(e) => setCuotas(cuotas.map((x, j) => (j === i ? { ...x, vencimiento: e.target.value } : x)))}
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
                      />
                    </div>
                  ))}
                </div>
                <p className={`text-sm font-black ${suma === Number(total) ? "text-emerald-700" : "text-rose-700"}`}>
                  Suma de cuotas: {formatearPesos(suma)} {suma === Number(total) ? "✔ coincide con el monto pactado" : `≠ ${formatearPesos(Number(total))}`}
                </p>
                <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (ej: tratamiento de ortodoncia)" className={campo} />
                <button
                  disabled={pendiente || !pacienteId || suma !== Number(total)}
                  onClick={() => ejecutar(() => crearContrato({ convenioId, pacienteId, total, cuotas, nota }), () => { setCuotas([]); setTotal(""); setNota("") })}
                  className="px-5 py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
                >
                  Crear contrato
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className={tarjeta}>
        <h2 className="text-lg font-extrabold text-gray-900">Contratos y control de cuotas</h2>
        {contratos.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">Aún no hay contratos.</p>
        ) : (
          <div className="space-y-3">
            {contratos.map((ct) => {
              const pagado = ct.cuotas.filter((q) => q.pagada_en).reduce((s, q) => s + q.monto, 0)
              return (
                <div key={ct.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-gray-900">
                      Contrato N° {ct.numero} · <span className="uppercase">{ct.paciente?.nombres} {ct.paciente?.apellidos}</span>
                      <span className="ml-2 text-xs font-semibold text-gray-500">{ct.convenio?.nombre}</span>
                    </p>
                    <p className="text-sm font-black">
                      {formatearPesos(pagado)} <span className="text-gray-400">/ {formatearPesos(ct.monto_total)}</span>
                    </p>
                  </div>
                  {ct.nota && <p className="text-xs text-gray-500">{ct.nota}</p>}
                  <div className="flex flex-wrap gap-2">
                    {ct.cuotas.map((q) => {
                      const vencida = !q.pagada_en && q.vencimiento < hoy
                      return (
                        <div
                          key={q.id}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                            q.pagada_en ? "bg-emerald-50 border-emerald-200" : vencida ? "bg-rose-50 border-rose-300" : "bg-white border-gray-200"
                          }`}
                        >
                          <p className="font-black">
                            {q.numero}/{ct.cantidad_cuotas} · {formatearPesos(q.monto)}
                          </p>
                          <p className={vencida ? "font-bold text-rose-700" : "text-gray-500"}>
                            {q.pagada_en ? `Pagada ${formatearFechaHora(q.pagada_en)}` : `${vencida ? "Vencida" : "Vence"} ${formatearFecha(q.vencimiento)}`}
                          </p>
                          {!q.pagada_en &&
                            (pago?.cuotaId === q.id ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <select value={pago.metodo} onChange={(e) => setPago({ ...pago, metodo: e.target.value })} className="rounded border border-gray-300 px-1 py-0.5 text-xs">
                                  {metodos.map((m) => (
                                    <option key={m.codigo} value={m.codigo}>
                                      {m.nombre}
                                    </option>
                                  ))}
                                </select>
                                {metodos.find((m) => m.codigo === pago.metodo)?.pide_referencia && (
                                  <input value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} placeholder="N° op." className="w-20 rounded border border-gray-300 px-1 py-0.5 text-xs" />
                                )}
                                <button
                                  disabled={pendiente}
                                  onClick={() => ejecutar(() => pagarCuota(q.id, pago.metodo, pago.referencia), () => setPago(null))}
                                  className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black"
                                >
                                  OK
                                </button>
                                <button onClick={() => setPago(null)} className="px-1 text-gray-500">
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPago({ cuotaId: q.id, metodo: metodos[0]?.codigo ?? "", referencia: "" })}
                                className="mt-1 text-[11px] font-black text-blue-700 hover:underline"
                              >
                                Registrar pago
                              </button>
                            ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-[11px] font-semibold text-gray-400">Para pagar una cuota debe haber caja abierta; el pago entra a la caja como “Cuota convenio”.</p>
      </section>
    </div>
  )
}

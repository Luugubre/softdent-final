import Link from "next/link"
import { notFound } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { obtenerFases, obtenerItems, obtenerTratamiento } from "@/lib/tratamientos"
import { obtenerPaciente } from "@/lib/paciente"
import { obtenerParametros } from "@/lib/catalogos"
import { calcularEdad, formatearRut } from "@/lib/validaciones"
import { formatearFecha, formatearPesos, hoyChile } from "@/lib/formato"
import { BotonImprimir } from "@/components/pagos/BotonImprimir"
import { ESTADO_TRATAMIENTO, type Fase } from "@/types/tratamiento"
import type { ItemTratamiento } from "@/types/odontograma"

const DIAS_VALIDEZ = 30

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{etiqueta}</p>
      <p className="text-sm font-bold text-gray-900 break-words">{valor || "—"}</p>
    </div>
  )
}

export default async function ImprimirPresupuestoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tratamientoId: string }>
  searchParams: Promise<{ pagos?: string }>
}) {
  await requerirPermiso("pacientes.ver")
  const { id, tratamientoId } = await params
  const conPagos = (await searchParams).pagos === "1"

  const tratamiento = await obtenerTratamiento(id, tratamientoId)
  if (!tratamiento) notFound()

  const [paciente, { items }, fases, parametros] = await Promise.all([
    obtenerPaciente(id),
    obtenerItems(id, tratamientoId),
    obtenerFases(tratamientoId),
    obtenerParametros(),
  ])
  if (!paciente) notFound()

  const parametro = (clave: string, porDefecto = "") => parametros.find((p) => p.clave === clave)?.valor?.trim() || porDefecto
  const clinica = {
    nombre: parametro("clinica.nombre", "SoftDent"),
    rut: parametro("clinica.rut"),
    direccion: parametro("clinica.direccion"),
    telefono: parametro("clinica.telefono"),
  }

  const activos = items.filter((i) => i.estado !== "ANULADO")
  const grupos: { clave: string; fase: Fase | null; items: ItemTratamiento[] }[] =
    fases.length > 0
      ? [
          ...fases.map((f) => ({ clave: f.id, fase: f, items: activos.filter((i) => i.fase_id === f.id) })),
          { clave: "sin-fase", fase: null, items: activos.filter((i) => !i.fase_id || !fases.some((f) => f.id === i.fase_id)) },
        ].filter((g) => g.items.length > 0)
      : [{ clave: "todas", fase: null, items: activos }]

  const suma = (lista: ItemTratamiento[], fn: (i: ItemTratamiento) => number) => lista.reduce((s, i) => s + fn(i), 0)
  const total = suma(activos, (i) => i.precio)
  const abonado = suma(activos, (i) => i.abonado)
  const realizado = suma(activos, (i) => i.monto_habilitado)
  const hoy = hoyChile()
  const edad = calcularEdad(paciente.fecha_nacimiento)
  const estado = ESTADO_TRATAMIENTO[tratamiento.estado]
  const columnas = conPagos ? 9 : 6
  let correlativo = 0

  return (
    <div className="space-y-4">
      <style>{`@media print {
        @page { size: A4; margin: 14mm; }
        body * { visibility: hidden; }
        #presupuesto, #presupuesto * { visibility: visible; }
        #presupuesto { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; padding: 0; }
        #presupuesto tr { break-inside: avoid; }
      }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/pacientes/${id}/tratamientos/${tratamientoId}`} className="text-sm font-bold text-blue-600 hover:underline">
          ← Volver al tratamiento
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/pacientes/${id}/tratamientos/${tratamientoId}/imprimir${conPagos ? "" : "?pagos=1"}`}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            {conPagos ? "Ocultar avance y pagos" : "Incluir avance y pagos"}
          </Link>
          <BotonImprimir />
        </div>
      </div>

      {tratamiento.estado === "ANULADO" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 print:hidden">
          Este tratamiento está anulado. El documento se imprime con la marca “ANULADO”.
        </p>
      )}

      <article id="presupuesto" className="relative mx-auto max-w-4xl space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        {tratamiento.estado === "ANULADO" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 text-8xl font-black text-rose-500/20">ANULADO</span>
          </div>
        )}

        <header className="flex items-start justify-between gap-6 border-b-2 border-blue-700 pb-4">
          <div>
            <p className="text-2xl font-black text-blue-700">{clinica.nombre}</p>
            <div className="text-xs font-medium text-gray-600">
              {clinica.rut && <p>RUT {clinica.rut}</p>}
              {clinica.direccion && <p>{clinica.direccion}</p>}
              {clinica.telefono && <p>Teléfono {clinica.telefono}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-widest text-gray-500">Presupuesto dental</p>
            <p className="text-2xl font-black text-gray-900">N° {String(tratamiento.numero).padStart(4, "0")}</p>
            <p className="text-xs font-semibold text-gray-500">Emitido el {formatearFecha(hoy)}</p>
            <p className="text-xs font-semibold text-gray-500">Válido hasta el {formatearFecha(sumarDias(hoy, DIAS_VALIDEZ))}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
          <div className="col-span-2">
            <Dato etiqueta="Paciente" valor={`${paciente.nombres} ${paciente.apellidos}`} />
          </div>
          <Dato etiqueta={paciente.extranjero ? "Documento" : "RUT"} valor={paciente.extranjero ? paciente.rut : formatearRut(paciente.rut)} />
          <Dato etiqueta="Ficha" valor={`#${paciente.numero_ficha}`} />
          <Dato etiqueta="Edad" valor={edad !== null ? `${edad} años` : ""} />
          <Dato etiqueta="Previsión" valor={paciente.prevision} />
          <Dato etiqueta="Teléfono" valor={paciente.telefono} />
          <Dato etiqueta="Correo" valor={paciente.email} />
        </section>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="col-span-2">
            <Dato etiqueta="Tratamiento" valor={tratamiento.nombre} />
            {tratamiento.descripcion && <p className="text-xs text-gray-600">{tratamiento.descripcion}</p>}
          </div>
          <Dato etiqueta="Profesional tratante" valor={tratamiento.profesional ? `Dr.(a) ${tratamiento.profesional.nombre_completo}` : ""} />
          <Dato etiqueta="Arancel · Estado" valor={`${tratamiento.arancel?.nombre ?? "—"} · ${estado.etiqueta}`} />
        </section>

        {activos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm font-semibold text-gray-400">
            Este tratamiento aún no tiene prestaciones.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-[10px] font-black uppercase tracking-wider text-gray-500">
                <th className="w-8 py-2 pr-2">#</th>
                <th className="py-2 pr-2">Código</th>
                <th className="py-2 pr-2">Prestación</th>
                <th className="py-2 pr-2 text-center">Pieza</th>
                <th className="py-2 pr-2 text-center">Caras</th>
                <th className="py-2 text-right">Valor</th>
                {conPagos && <th className="py-2 pl-2 text-right">Avance</th>}
                {conPagos && <th className="py-2 pl-2 text-right">Abonado</th>}
                {conPagos && <th className="py-2 pl-2 text-right">Saldo</th>}
              </tr>
            </thead>
            {grupos.map((g) => {
              const subtotal = suma(g.items, (i) => i.precio)
              return (
                <tbody key={g.clave}>
                  {fases.length > 0 && (
                    <tr className="bg-blue-50">
                      <td colSpan={columnas} className="px-2 py-2">
                        <p className="text-sm font-black text-blue-900">
                          {g.fase ? `Fase ${g.fase.numero}: ${g.fase.nombre}` : "Otras prestaciones"}
                        </p>
                        {g.fase?.descripcion && <p className="text-xs font-medium text-blue-800">{g.fase.descripcion}</p>}
                      </td>
                    </tr>
                  )}
                  {g.items.map((i) => {
                    correlativo++
                    return (
                      <tr key={i.id} className="border-b border-gray-100 align-top">
                        <td className="py-2 pr-2 text-xs font-bold text-gray-400">{correlativo}</td>
                        <td className="py-2 pr-2 font-mono text-xs text-gray-500">{i.prestacion?.codigo_interno}</td>
                        <td className="py-2 pr-2">
                          <p className="font-semibold text-gray-900">{i.prestacion?.nombre}</p>
                          {i.nota && <p className="text-xs text-gray-500">{i.nota}</p>}
                        </td>
                        <td className="py-2 pr-2 text-center font-mono font-bold">{i.pieza ?? "—"}</td>
                        <td className="py-2 pr-2 text-center text-xs">{i.caras.length > 0 ? i.caras.join(", ") : "—"}</td>
                        <td className="py-2 text-right font-bold whitespace-nowrap">{formatearPesos(i.precio)}</td>
                        {conPagos && <td className="py-2 pl-2 text-right text-xs">{i.progreso}%</td>}
                        {conPagos && <td className="py-2 pl-2 text-right text-xs whitespace-nowrap">{formatearPesos(i.abonado)}</td>}
                        {conPagos && <td className="py-2 pl-2 text-right text-xs font-bold whitespace-nowrap">{formatearPesos(i.precio - i.abonado)}</td>}
                      </tr>
                    )
                  })}
                  {fases.length > 0 && (
                    <tr>
                      <td colSpan={5} className="py-2 pr-2 text-right text-xs font-black uppercase text-gray-500">
                        Subtotal {g.fase ? `fase ${g.fase.numero}` : "otras prestaciones"}
                      </td>
                      <td className="py-2 text-right font-black whitespace-nowrap">{formatearPesos(subtotal)}</td>
                      {conPagos && <td />}
                      {conPagos && <td className="py-2 pl-2 text-right text-xs font-bold whitespace-nowrap">{formatearPesos(suma(g.items, (i) => i.abonado))}</td>}
                      {conPagos && (
                        <td className="py-2 pl-2 text-right text-xs font-bold whitespace-nowrap">{formatearPesos(subtotal - suma(g.items, (i) => i.abonado))}</td>
                      )}
                    </tr>
                  )}
                </tbody>
              )
            })}
            <tfoot>
              <tr className="border-t-2 border-gray-900">
                <td colSpan={5} className="pt-3 text-right text-sm font-black text-gray-900">
                  TOTAL PRESUPUESTO ({activos.length} {activos.length === 1 ? "prestación" : "prestaciones"})
                </td>
                <td className="pt-3 text-right text-xl font-black text-gray-900 whitespace-nowrap">{formatearPesos(total)}</td>
                {conPagos && <td />}
                {conPagos && <td className="pt-3 pl-2 text-right text-sm font-black whitespace-nowrap">{formatearPesos(abonado)}</td>}
                {conPagos && <td className="pt-3 pl-2 text-right text-sm font-black whitespace-nowrap">{formatearPesos(total - abonado)}</td>}
              </tr>
            </tfoot>
          </table>
        )}

        {fases.length > 1 && grupos.length > 1 && (
          <section className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Resumen por fase</p>
            <table className="w-full max-w-md text-sm">
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.clave} className="border-b border-gray-100">
                    <td className="py-1 pr-2 font-semibold text-gray-700">{g.fase ? `Fase ${g.fase.numero}: ${g.fase.nombre}` : "Otras prestaciones"}</td>
                    <td className="py-1 pr-2 text-right text-xs text-gray-500">{g.items.length} prest.</td>
                    <td className="py-1 text-right font-bold">{formatearPesos(suma(g.items, (i) => i.precio))}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-2 font-black">Total</td>
                  <td />
                  <td className="pt-2 text-right font-black">{formatearPesos(total)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {conPagos && (
          <section className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Realizado</p>
              <p className="text-lg font-black">{formatearPesos(realizado)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Abonado</p>
              <p className="text-lg font-black">{formatearPesos(abonado)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] font-black uppercase text-gray-500">Saldo del tratamiento</p>
              <p className="text-lg font-black">{formatearPesos(total - abonado)}</p>
            </div>
          </section>
        )}

        <section className="space-y-1 rounded-xl border border-gray-200 p-4 text-xs text-gray-600">
          <p className="font-black uppercase tracking-wider text-gray-500">Condiciones</p>
          <p>• Presupuesto válido por {DIAS_VALIDEZ} días desde su emisión. Valores según {tratamiento.arancel?.nombre ?? "el arancel vigente"}.</p>
          <p>• El plan puede modificarse si cambia el diagnóstico durante el tratamiento; cualquier cambio se informará antes de realizarlo.</p>
          <p>• Las prestaciones se pagan a medida que se realizan. Se pueden hacer abonos anticipados.</p>
          {fases.length > 0 && <p>• El tratamiento se realizará por fases, en el orden indicado.</p>}
        </section>

        <footer className="grid grid-cols-2 gap-12 pt-14 text-center text-xs text-gray-600">
          <div className="border-t border-gray-400 pt-1">
            <p className="font-bold">{tratamiento.profesional ? `Dr.(a) ${tratamiento.profesional.nombre_completo}` : "Profesional tratante"}</p>
            <p>Firma profesional</p>
          </div>
          <div className="border-t border-gray-400 pt-1">
            <p className="font-bold">
              {paciente.nombres} {paciente.apellidos}
            </p>
            <p>Firma paciente · Acepto el presupuesto</p>
          </div>
        </footer>
      </article>
    </div>
  )
}

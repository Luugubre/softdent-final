import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerCitas, obtenerInfoPacientes } from "@/lib/agenda"
import { obtenerParametro } from "@/lib/catalogos"
import { fechaTitulo, fechaValida, hoyEnChile } from "@/lib/fechas-agenda"
import { formatearPesos } from "@/lib/formato"
import { BotonImprimir } from "@/components/pagos/BotonImprimir"
import { ESTADO_CITA, type CitaAgenda } from "@/types/cita"

const UUID = /^[0-9a-f-]{36}$/i

export default async function HojaRutaPage({ searchParams }: { searchParams: Promise<{ fecha?: string; profesional?: string }> }) {
  const usuario = await requerirPermiso("agenda.ver")
  const sp = await searchParams
  const fecha = fechaValida(sp.fecha) ? sp.fecha : hoyEnChile()
  const profesional = !puede(usuario.rol, "agenda.ver_todas") ? usuario.id : sp.profesional && UUID.test(sp.profesional) ? sp.profesional : undefined
  const finanzas = puede(usuario.rol, "pagos.ver")

  const citas = (await obtenerCitas(fecha, fecha, { profesional })).filter((c) => c.estado !== "CANCELADA" && c.estado !== "REAGENDADA")
  const info = await obtenerInfoPacientes(
    citas.map((c) => c.paciente_id),
    finanzas
  )

  const nombreClinica = await obtenerParametro("clinica.nombre", "Clínica SoftDent")
  const porProfesional = new Map<string, CitaAgenda[]>()
  for (const c of citas) porProfesional.set(c.profesional_nombre, [...(porProfesional.get(c.profesional_nombre) ?? []), c])

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-4">
      <style>{`@media print {
        body * { visibility: hidden; }
        #hoja, #hoja * { visibility: visible; }
        #hoja { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; padding: 0; }
        .salto { break-before: page; }
      }`}</style>

      <div className="flex items-center justify-between">
        <Link href={`/agenda?fecha=${fecha}${profesional ? `&profesional=${profesional}` : ""}`} className="text-sm font-bold text-blue-600 hover:underline">
          ← Volver a la agenda
        </Link>
        <BotonImprimir />
      </div>

      <article id="hoja" className="max-w-5xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
        <header className="flex items-end justify-between border-b border-gray-200 pb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">{nombreClinica}</p>
            <h1 className="text-2xl font-black text-gray-900">Hoja de ruta</h1>
          </div>
          <p className="text-lg font-bold text-gray-700 capitalize">{fechaTitulo(fecha)}</p>
        </header>

        {citas.length === 0 && <p className="text-center text-sm font-semibold text-gray-400 py-10">No hay citas este día.</p>}

        {[...porProfesional.entries()].map(([nombre, lista], i) => (
          <section key={nombre} className={i > 0 ? "salto" : ""}>
            <h2 className="text-lg font-black text-gray-900 mb-2">
              {nombre} <span className="text-sm font-semibold text-gray-400">· {lista.length} cita(s)</span>
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b-2 border-gray-300">
                  <th className="text-left py-2 w-20">Hora</th>
                  <th className="text-left py-2">Paciente</th>
                  <th className="text-left py-2">Teléfono</th>
                  <th className="text-left py-2">Motivo</th>
                  <th className="text-left py-2">Estado</th>
                  {finanzas && <th className="text-right py-2">Por cobrar</th>}
                  <th className="text-left py-2 w-28">Notas</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const pc = info[c.paciente_id]?.porCobrar ?? 0
                  const faltas = info[c.paciente_id]?.inasistencias ?? 0
                  return (
                    <tr key={c.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 font-black">
                        {c.hora_inicio}
                        <span className="block text-[10px] font-semibold text-gray-400">{c.duracion_min} min</span>
                      </td>
                      <td className="py-2">
                        <span className="font-bold uppercase">{c.paciente_nombre}</span>
                        <span className="block text-xs text-gray-500">
                          {c.paciente_rut}
                          {faltas > 0 ? ` · ${faltas} inasistencia(s)` : ""}
                          {c.sobrecupo ? " · SOBRECUPO" : ""}
                        </span>
                      </td>
                      <td className="py-2 text-xs">{c.paciente_telefono ?? "—"}</td>
                      <td className="py-2 text-xs">
                        {c.motivo ?? "—"}
                        {c.tratamiento_nombre ? <span className="block text-gray-500">Trat. N° {c.tratamiento_numero}</span> : null}
                        {c.box_nombre ? <span className="block text-gray-500">{c.box_nombre}</span> : null}
                      </td>
                      <td className="py-2 text-xs font-bold">{ESTADO_CITA[c.estado].etiqueta}</td>
                      {finanzas && <td className={`py-2 text-right font-bold ${pc > 0 ? "text-red-600" : "text-gray-300"}`}>{pc > 0 ? formatearPesos(pc) : "—"}</td>}
                      <td className="py-2 border-l border-dashed border-gray-200" />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        ))}
      </article>
    </div>
  )
}

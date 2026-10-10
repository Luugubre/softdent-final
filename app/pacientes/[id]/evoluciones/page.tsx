import { getSupabase } from "@/lib/supabase"
import { obtenerPaciente } from "@/lib/paciente"
import { formatearFecha, formatearFechaHora } from "@/lib/formato"
import { EvolucionForm } from "@/components/ficha/EvolucionForm"
import type { Evolucion } from "@/types/evolucion"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"

function Bloque({ etiqueta, texto }: { etiqueta: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div>
      <dt className="text-[11px] font-black uppercase tracking-wider text-gray-400">{etiqueta}</dt>
      <dd className="text-sm font-medium text-gray-800 whitespace-pre-line break-words">{texto}</dd>
    </div>
  )
}

export default async function EvolucionesPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("clinico.ver")
  const puedeCrear = puede(usuario.rol, "evoluciones.crear")
  const { id } = await params
  const [paciente, { data, error }] = await Promise.all([
    obtenerPaciente(id),
    getSupabase()
      .from("evoluciones")
      .select("*")
      .eq("paciente_id", id)
      .order("fecha_atencion", { ascending: false })
      .order("created_at", { ascending: false }),
  ])
  const evoluciones = (data ?? []) as Evolucion[]

  return (
    <div className="space-y-5">
      {!puedeCrear ? (
        <p className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-800">
          Solo los dentistas registran evoluciones. Tu rol puede consultarlas.
        </p>
      ) : paciente?.activo ? (
        <EvolucionForm pacienteId={id} profesionalNombre={usuario.nombre_completo} />
      ) : (
        <p className="rounded-xl bg-gray-100 border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-600">
          El paciente está deshabilitado: no se pueden registrar evoluciones.
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">
          No se pudieron cargar las evoluciones: {error.message}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-gray-900">
          Evoluciones registradas <span className="text-gray-400">({evoluciones.length})</span>
        </h2>

        {evoluciones.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">Aún no hay evoluciones.</p>
        ) : (
          evoluciones.map((ev) => (
            <article key={ev.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-extrabold text-gray-900">
                  {formatearFecha(ev.fecha_atencion)}
                  {ev.motivo && <span className="text-gray-500 font-semibold"> · {ev.motivo}</span>}
                </p>
                <p className="text-xs font-semibold text-gray-500">Dr.(a) {ev.profesional_nombre}</p>
              </div>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Bloque etiqueta="Diagnóstico" texto={ev.diagnostico} />
                <Bloque etiqueta="Procedimiento realizado" texto={ev.procedimiento} />
                <Bloque etiqueta="Observaciones" texto={ev.observaciones} />
                <Bloque etiqueta="Indicaciones al paciente" texto={ev.indicaciones} />
              </dl>
              <p className="text-[11px] font-medium text-gray-400">Registrada el {formatearFechaHora(ev.created_at)}</p>
            </article>
          ))
        )}
      </section>
    </div>
  )
}

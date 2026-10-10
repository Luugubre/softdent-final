import Link from "next/link"
import { getSupabase } from "@/lib/supabase"
import { fechaLarga, hora } from "@/lib/formato"
import { BUCKET_ARCHIVOS } from "@/types/archivo"
import { ESTILO_EVENTO, type EventoHistorial, type TipoEvento } from "@/types/historial"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"

// Eventos que puede ver un rol SIN acceso clínico (ej. recepcionista)
const TIPOS_NO_CLINICOS: TipoEvento[] = ["PACIENTE", "CITA", "PAGO", "PRESUPUESTO"]

// Página principal de la ficha: línea de tiempo de todo lo ocurrido con el paciente

const FILTROS: { clave: "TODOS" | TipoEvento; etiqueta: string; clinico?: boolean }[] = [
  { clave: "TODOS", etiqueta: "Todas" },
  { clave: "EVOLUCION", etiqueta: "Evoluciones", clinico: true },
  { clave: "ARCHIVO", etiqueta: "RX y archivos", clinico: true },
  { clave: "ANTECEDENTE", etiqueta: "Antecedentes", clinico: true },
  { clave: "PACIENTE", etiqueta: "Datos" },
]

export default async function ResumenPaciente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tipo?: string }>
}) {
  const usuario = await requerirPermiso("pacientes.ver")
  const verClinico = puede(usuario.rol, "clinico.ver")
  const filtros = FILTROS.filter((f) => verClinico || !f.clinico)

  const { id } = await params
  const { tipo } = await searchParams
  const filtro = filtros.find((f) => f.clave === tipo)?.clave ?? "TODOS"
  const supabase = getSupabase()

  let consulta = supabase
    .from("historial_paciente")
    .select("*")
    .eq("paciente_id", id)
    .order("fecha", { ascending: false })
    .limit(300)
  if (filtro !== "TODOS") consulta = consulta.eq("tipo", filtro)
  if (!verClinico) consulta = consulta.in("tipo", TIPOS_NO_CLINICOS)

  const { data, error } = await consulta
  const eventos = (data ?? []) as EventoHistorial[]

  // Miniaturas de las imágenes subidas (URLs firmadas, válidas 1 hora)
  const rutasImagen = eventos
    .filter((e) => e.tipo === "ARCHIVO" && e.datos?.tipo_mime?.startsWith("image/") && e.datos?.ruta)
    .map((e) => e.datos!.ruta as string)

  const miniaturas = new Map<string, string>()
  if (rutasImagen.length > 0) {
    const { data: firmadas } = await supabase.storage.from(BUCKET_ARCHIVOS).createSignedUrls(rutasImagen, 3600)
    firmadas?.forEach((f) => f.path && f.signedUrl && miniaturas.set(f.path, f.signedUrl))
  }

  // Agrupar por día
  const porDia = new Map<string, EventoHistorial[]>()
  for (const e of eventos) {
    const dia = fechaLarga(e.fecha)
    porDia.set(dia, [...(porDia.get(dia) ?? []), e])
  }

  const base = `/pacientes/${id}`

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">{verClinico ? "Historial clínico" : "Historial del paciente"}</h2>
          <p className="text-sm font-medium text-gray-500">
            Línea de tiempo detallada · {eventos.length} registro{eventos.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {filtros.map((f) => (
            <Link
              key={f.clave}
              href={f.clave === "TODOS" ? base : `${base}?tipo=${f.clave}`}
              scroll={false}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                filtro === f.clave
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {f.etiqueta}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">
          No se pudo cargar el historial: {error.message}
        </p>
      )}

      {eventos.length === 0 && !error ? (
        <p className="py-10 text-center text-sm font-semibold text-gray-400">
          Aún no hay registros{filtro !== "TODOS" ? " de este tipo" : ""}.
        </p>
      ) : (
        <div className="space-y-6">
          {[...porDia.entries()].map(([dia, items]) => (
            <div key={dia}>
              <h3 className="sticky top-0 z-10 bg-white py-1 text-xs font-black uppercase tracking-wider text-gray-400">
                {dia}
              </h3>

              <ol className="mt-2 relative border-l-2 border-gray-200 ml-3 space-y-4">
                {items.map((e) => {
                  const estilo = ESTILO_EVENTO[e.tipo]
                  const miniatura = e.datos?.ruta ? miniaturas.get(e.datos.ruta) : undefined
                  const enlace = estilo.seccion ? `${base}/${estilo.seccion}` : null

                  return (
                    <li key={e.id} className="ml-6">
                      <span
                        className={`absolute -left-[15px] flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white text-sm ${estilo.color}`}
                      >
                        {estilo.icono}
                      </span>

                      <div className="rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${estilo.color}`}
                            >
                              {estilo.etiqueta}
                            </span>
                            <p className="text-sm font-extrabold text-gray-900">{e.titulo}</p>
                            {e.detalle && (
                              <p className="text-sm font-medium text-gray-700 whitespace-pre-line break-words">
                                {e.detalle}
                              </p>
                            )}
                          </div>
                          {miniatura && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={miniatura}
                              alt={e.titulo}
                              className="h-20 w-20 shrink-0 rounded-lg object-cover border border-gray-200"
                            />
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-gray-400">
                          <span>
                            {e.profesional ? `Dr.(a) ${e.profesional} · ` : ""}
                            {hora(e.fecha)}
                          </span>
                          {enlace && (
                            <Link href={enlace} className="font-bold text-blue-600 hover:underline">
                              Ver →
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

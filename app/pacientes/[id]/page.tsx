import Link from "next/link"
import { getSupabase } from "@/lib/supabase"
import { fechaLarga, hora } from "@/lib/formato"
import { BUCKET_ARCHIVOS } from "@/types/archivo"
import { ESTILO_EVENTO, type EventoHistorial, type TipoEvento } from "@/types/historial"
import { ESTADOS_VIGENTES, type EstadoCita } from "@/types/cita"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { BannerCitaHoy, type CitaHoyPaciente } from "@/components/pacientes/BannerCitaHoy"

const TIPOS_NO_CLINICOS: TipoEvento[] = ["PACIENTE", "CITA", "PAGO", "PRESUPUESTO"]

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
  const puedeGestionarAgenda = puede(usuario.rol, "agenda.gestionar")
  const filtros = FILTROS.filter((f) => verClinico || !f.clinico)

  const { id } = await params
  const { tipo } = await searchParams
  const filtro = filtros.find((f) => f.clave === tipo)?.clave ?? "TODOS"
  const supabase = getSupabase()

  // Rango del día actual en Chile para buscar cita vigente del paciente
  const hoyChile = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" })
  const desdeHoy = `${hoyChile}T00:00:00-04:00`
  const hastaHoy = `${hoyChile}T23:59:59-03:00`

  let consulta = supabase
    .from("historial_paciente")
    .select("*")
    .eq("paciente_id", id)
    .order("fecha", { ascending: false })
    .limit(300)
  if (filtro !== "TODOS") consulta = consulta.eq("tipo", filtro)
  if (!verClinico) consulta = consulta.in("tipo", TIPOS_NO_CLINICOS)

  const [{ data, error }, { data: citasHoyData }] = await Promise.all([
    consulta,
    puedeGestionarAgenda
      ? supabase
          .from("citas")
          .select(`
            id,
            inicio,
            estado,
            motivo,
            box:boxes(nombre),
            profesional:perfiles!citas_profesional_id_fkey(nombre_completo)
          `)
          .eq("paciente_id", id)
          .in("estado", ESTADOS_VIGENTES)
          .gte("inicio", desdeHoy)
          .lte("inicio", hastaHoy)
          .order("inicio", { ascending: true })
          .limit(1)
      : Promise.resolve({ data: null }),
  ])

  const eventos = (data ?? []) as EventoHistorial[]

  const citaHoyRaw = citasHoyData?.[0]
  let citaHoy: CitaHoyPaciente | null = null
  if (citaHoyRaw) {
    const bx = Array.isArray(citaHoyRaw.box) ? citaHoyRaw.box[0] : citaHoyRaw.box
    const prof = Array.isArray(citaHoyRaw.profesional) ? citaHoyRaw.profesional[0] : citaHoyRaw.profesional
    const horaInicioChile = new Date(citaHoyRaw.inicio).toLocaleTimeString("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })

    citaHoy = {
      id: citaHoyRaw.id,
      hora_inicio: horaInicioChile,
      estado: citaHoyRaw.estado as EstadoCita,
      motivo: citaHoyRaw.motivo ?? null,
      box_nombre: bx?.nombre ?? null,
      profesional_nombre: prof?.nombre_completo ?? "Profesional",
    }
  }

  const rutasImagen = eventos
    .filter((e) => e.tipo === "ARCHIVO" && e.datos?.tipo_mime?.startsWith("image/") && e.datos?.ruta)
    .map((e) => e.datos!.ruta as string)

  const miniaturas = new Map<string, string>()
  if (rutasImagen.length > 0) {
    const { data: firmadas } = await supabase.storage.from(BUCKET_ARCHIVOS).createSignedUrls(rutasImagen, 3600)
    firmadas?.forEach((f) => f.path && f.signedUrl && miniaturas.set(f.path, f.signedUrl))
  }

  const porDia = new Map<string, EventoHistorial[]>()
  for (const e of eventos) {
    const dia = fechaLarga(e.fecha)
    porDia.set(dia, [...(porDia.get(dia) ?? []), e])
  }

  const base = `/pacientes/${id}`

  return (
    <div className="space-y-5">
      {citaHoy && <BannerCitaHoy cita={citaHoy} />}

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
    </div>
  )
}
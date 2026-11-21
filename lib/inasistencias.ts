import { getSupabase } from "@/lib/supabase"
import { formatearRut } from "@/lib/validaciones"

export type Inasistencia = {
  cita_id: string
  numero: number
  fecha: string
  hora: string
  paciente_id: string
  paciente_nombre: string
  paciente_rut: string
  telefono: string | null
  profesional_id: string
  profesional_nombre: string
  prestacion: string | null
  inasistencias_total: number
  proxima_cita: string | null
  ultimo_contacto: { fecha: string; nota: string; usuario: string } | null
}

export type ResumenInasistencias = {
  lista: Inasistencia[]
  atendidas: number
  profesionales: { id: string; nombre: string }[]
}

const ZONA = "America/Santiago"
const diaChile = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA })
const horaChile = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CL", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false })

export async function listarInasistencias(desde: string, hasta: string, profesionalId?: string): Promise<ResumenInasistencias> {
  const db = getSupabase()
  const inicio = new Date(`${desde}T00:00:00-03:00`)
  inicio.setHours(inicio.getHours() - 1)
  const fin = new Date(`${hasta}T23:59:59-03:00`)
  fin.setHours(fin.getHours() + 1)

  let q = db
    .from("citas")
    .select(
      "id, numero, inicio, estado, paciente_id, profesional_id, pacientes(nombres, apellidos, rut, extranjero, telefono), perfiles!citas_profesional_id_fkey(nombre_completo), prestaciones(nombre)"
    )
    .in("estado", ["NO_ASISTIO", "REALIZADA"])
    .gte("inicio", inicio.toISOString())
    .lte("inicio", fin.toISOString())
    .order("inicio", { ascending: false })
    .limit(2000)
  if (profesionalId) q = q.eq("profesional_id", profesionalId)
  const { data, error } = await q
  if (error) throw new Error(`No se pudieron cargar las inasistencias: ${error.message}`)

  type Fila = {
    id: string
    numero: number
    inicio: string
    estado: string
    paciente_id: string
    profesional_id: string
    pacientes: { nombres: string; apellidos: string; rut: string; extranjero: boolean; telefono: string | null } | null
    perfiles: { nombre_completo: string } | null
    prestaciones: { nombre: string } | null
  }
  const filas = ((data ?? []) as unknown as Fila[]).filter((c) => {
    const d = diaChile(c.inicio)
    return d >= desde && d <= hasta
  })
  const faltas = filas.filter((c) => c.estado === "NO_ASISTIO")
  const pacientes = [...new Set(faltas.map((c) => c.paciente_id))]

  const historico = new Map<string, number>()
  const proxima = new Map<string, string>()
  const contacto = new Map<string, { fecha: string; nota: string; usuario: string }>()

  for (let i = 0; i < pacientes.length; i += 200) {
    const lote = pacientes.slice(i, i + 200)
    const [{ data: todas }, { data: futuras }, { data: contactos }] = await Promise.all([
      db.from("citas").select("paciente_id").eq("estado", "NO_ASISTIO").in("paciente_id", lote).limit(10000),
      db
        .from("citas")
        .select("paciente_id, inicio")
        .in("estado", ["AGENDADA", "CONFIRMADA"])
        .gt("inicio", new Date().toISOString())
        .in("paciente_id", lote)
        .order("inicio", { ascending: true }),
      db
        .from("contactos_paciente")
        .select("paciente_id, mensaje, created_at, perfiles(nombre_completo)")
        .eq("tipo", "INASISTENCIA")
        .in("paciente_id", lote)
        .order("created_at", { ascending: false }),
    ])
    for (const c of todas ?? []) historico.set(c.paciente_id, (historico.get(c.paciente_id) ?? 0) + 1)
    for (const c of futuras ?? []) if (!proxima.has(c.paciente_id)) proxima.set(c.paciente_id, c.inicio)
    for (const c of (contactos ?? []) as unknown as {
      paciente_id: string
      mensaje: string
      created_at: string
      perfiles: { nombre_completo: string } | null
    }[]) {
      if (!contacto.has(c.paciente_id)) {
        contacto.set(c.paciente_id, { fecha: c.created_at, nota: c.mensaje, usuario: c.perfiles?.nombre_completo ?? "—" })
      }
    }
  }

  const profesionales = new Map<string, string>()
  for (const c of filas) profesionales.set(c.profesional_id, c.perfiles?.nombre_completo ?? "—")

  return {
    atendidas: filas.length - faltas.length,
    profesionales: [...profesionales].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    lista: faltas.map((c) => ({
      cita_id: c.id,
      numero: c.numero,
      fecha: diaChile(c.inicio),
      hora: horaChile(c.inicio),
      paciente_id: c.paciente_id,
      paciente_nombre: c.pacientes ? `${c.pacientes.nombres} ${c.pacientes.apellidos}` : "—",
      paciente_rut: c.pacientes ? (c.pacientes.extranjero ? c.pacientes.rut : formatearRut(c.pacientes.rut)) : "—",
      telefono: c.pacientes?.telefono ?? null,
      profesional_id: c.profesional_id,
      profesional_nombre: c.perfiles?.nombre_completo ?? "—",
      prestacion: c.prestaciones?.nombre ?? null,
      inasistencias_total: historico.get(c.paciente_id) ?? 1,
      proxima_cita: proxima.get(c.paciente_id) ?? null,
      ultimo_contacto: contacto.get(c.paciente_id) ?? null,
    })),
  }
}

import { getSupabase } from "@/lib/supabase"
import { hoyEnChile } from "@/lib/fechas-agenda"

export type CitaWeb = {
  id: string
  inicio: string
  estado: string
  motivo: string | null
  validada: boolean
  paciente_id: string
  paciente_nombre: string
  paciente_rut: string
  paciente_telefono: string | null
  paciente_email: string | null
  profesional_nombre: string
}

type Fila = {
  id: string
  inicio: string
  estado: string
  motivo: string | null
  validada_web_at: string | null
  paciente_id: string
  pacientes: { nombres: string; apellidos: string; rut: string; telefono: string | null; email: string | null } | null
  perfiles: { nombre_completo: string } | null
}

// Reservas hechas por internet desde hoy en adelante; primero las que falta validar
export async function listarCitasWeb(profesionalId?: string): Promise<CitaWeb[]> {
  let q = getSupabase()
    .from("citas")
    .select(
      "id, inicio, estado, motivo, validada_web_at, paciente_id, pacientes(nombres, apellidos, rut, telefono, email), perfiles!citas_profesional_id_fkey(nombre_completo)"
    )
    .eq("origen", "WEB")
    .gte("inicio", `${hoyEnChile()}T00:00:00-03:00`)
    .order("inicio")
    .limit(300)
  if (profesionalId) q = q.eq("profesional_id", profesionalId)
  const { data, error } = await q
  if (error) {
    console.error("No se pudieron leer las reservas web:", error.message)
    return []
  }
  return ((data ?? []) as unknown as Fila[])
    .map((c) => ({
      id: c.id,
      inicio: c.inicio,
      estado: c.estado,
      motivo: c.motivo,
      validada: Boolean(c.validada_web_at),
      paciente_id: c.paciente_id,
      paciente_nombre: c.pacientes ? `${c.pacientes.nombres} ${c.pacientes.apellidos}` : "—",
      paciente_rut: c.pacientes?.rut ?? "",
      paciente_telefono: c.pacientes?.telefono ?? null,
      paciente_email: c.pacientes?.email ?? null,
      profesional_nombre: c.perfiles?.nombre_completo ?? "—",
    }))
    .sort((a, b) => Number(a.validada) - Number(b.validada) || a.inicio.localeCompare(b.inicio))
}

export async function contarCitasWebPorValidar(profesionalId?: string): Promise<number> {
  let q = getSupabase()
    .from("citas")
    .select("id", { count: "exact", head: true })
    .eq("origen", "WEB")
    .is("validada_web_at", null)
    .in("estado", ["AGENDADA", "CONFIRMADA"])
    .gte("inicio", `${hoyEnChile()}T00:00:00-03:00`)
  if (profesionalId) q = q.eq("profesional_id", profesionalId)
  const { count, error } = await q
  return error ? 0 : (count ?? 0)
}

export async function dentistasAgendaOnline() {
  const { data } = await getSupabase()
    .from("perfiles")
    .select("id, nombre_completo, especialidad, agenda_online")
    .eq("rol", "DENTISTA")
    .eq("activo", true)
    .order("nombre_completo")
  return (data ?? []) as { id: string; nombre_completo: string; especialidad: string | null; agenda_online: boolean }[]
}

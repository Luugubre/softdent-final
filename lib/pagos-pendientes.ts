import { getSupabase } from "@/lib/supabase"

export type SaldoPaciente = {
  paciente_id: string
  rut: string | null
  nombres: string
  apellidos: string | null
  paciente_nombre: string
  telefono: string | null
  email: string | null
  total_habilitado: number
  total_abonado: number
  saldo: number
  total_tratamiento: number
  saldo_tratamiento: number
  ultimo_pago_at: string | null
  antiguedad_dias: number
  doctor_id: string | null
  doctor_ids: string[]
  doctor_nombre: string
}

export async function obtenerSaldosPacientes(doctorIdFiltro?: string): Promise<{
  saldos: SaldoPaciente[]
  doctores: { id: string; nombre_completo: string }[]
}> {
  const supabase = getSupabase()

  let query = supabase.from("v_saldos_pacientes").select("*").order("saldo", { ascending: false })
  if (doctorIdFiltro) query = query.contains("doctor_ids", [doctorIdFiltro])
  let { data, error } = await query

  // Base sin la migración 24: vista anterior, un doctor por paciente
  if (error && /doctor_ids/.test(error.message)) {
    let anterior = supabase.from("v_saldos_pacientes").select("*").order("saldo", { ascending: false })
    if (doctorIdFiltro) anterior = anterior.eq("doctor_id", doctorIdFiltro)
    ;({ data, error } = await anterior)
  }
  if (error || !data) {
    console.error("Error cargando v_saldos_pacientes:", error?.message)
    return { saldos: [], doctores: [] }
  }

  const saldos: SaldoPaciente[] = (data as Record<string, unknown>[]).map((row) => {
    const habilitado = Number(row.total_habilitado) || 0
    const abonado = Number(row.total_abonado) || 0
    const saldo = Math.max(Number(row.saldo) || 0, 0)
    return {
      ...(row as unknown as SaldoPaciente),
      total_habilitado: habilitado,
      total_abonado: abonado,
      saldo,
      total_tratamiento: row.total_tratamiento == null ? habilitado : Number(row.total_tratamiento) || 0,
      saldo_tratamiento: row.saldo_tratamiento == null ? saldo : Number(row.saldo_tratamiento) || 0,
      antiguedad_dias: Number(row.antiguedad_dias) || 0,
      doctor_ids: Array.isArray(row.doctor_ids) ? (row.doctor_ids as string[]) : row.doctor_id ? [String(row.doctor_id)] : [],
      doctor_nombre: String(row.doctor_nombre ?? "Sin doctor asignado"),
    }
  })

  const ids = [...new Set(saldos.flatMap((s) => s.doctor_ids))]
  let doctores: { id: string; nombre_completo: string }[] = []
  if (ids.length) {
    const { data: perfiles } = await supabase.from("perfiles").select("id, nombre_completo").in("id", ids)
    doctores = ((perfiles ?? []) as { id: string; nombre_completo: string }[]).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
  }
  return { saldos, doctores }
}

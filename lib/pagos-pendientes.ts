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
  ultimo_pago_at: string | null
  antiguedad_dias: number
  doctor_id: string | null
  doctor_nombre: string
}

export async function obtenerSaldosPacientes(doctorIdFiltro?: string): Promise<{
  saldos: SaldoPaciente[]
  doctores: { id: string; nombre_completo: string }[]
}> {
  const supabase = getSupabase()

  let query = supabase
    .from("v_saldos_pacientes")
    .select("*")
    .order("saldo", { ascending: false })

  if (doctorIdFiltro) {
    query = query.eq("doctor_id", doctorIdFiltro)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error("Error cargando v_saldos_pacientes:", error?.message)
    return { saldos: [], doctores: [] }
  }

  const saldos = (data as SaldoPaciente[]).map((row) => ({
    ...row,
    total_habilitado: Number(row.total_habilitado) || 0,
    total_abonado: Number(row.total_abonado) || 0,
    saldo: Number(row.saldo) || 0,
    antiguedad_dias: Number(row.antiguedad_dias) || 0,
  }))

  const doctoresMap = new Map<string, string>()
  for (const s of saldos) {
    if (s.doctor_id && s.doctor_nombre) {
      doctoresMap.set(s.doctor_id, s.doctor_nombre)
    }
  }

  const doctores = [...doctoresMap.entries()]
    .map(([id, nombre_completo]) => ({ id, nombre_completo }))
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))

  return { saldos, doctores }
}
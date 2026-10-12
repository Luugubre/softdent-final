import { getSupabase } from "@/lib/supabase"
import type { BonoFonasa, ContratoCuotas, Convenio } from "@/types/admin"

export async function obtenerBonos(estado?: string, limite = 100): Promise<BonoFonasa[]> {
  let q = getSupabase()
    .from("bonos_fonasa")
    .select("*, paciente:pacientes(nombres, apellidos, rut), prestacion:prestaciones(nombre, codigo_fonasa)")
    .order("created_at", { ascending: false })
    .limit(limite)
  if (estado) q = q.eq("estado", estado)
  const { data } = await q
  return (data ?? []) as BonoFonasa[]
}

export async function obtenerConvenios(): Promise<Convenio[]> {
  const { data } = await getSupabase()
    .from("convenios")
    .select("*, beneficiarios:convenio_beneficiarios(id, activo, desde, paciente:pacientes(id, nombres, apellidos, rut))")
    .order("activo", { ascending: false })
    .order("nombre")
  return (data ?? []) as Convenio[]
}

export async function obtenerContratos(): Promise<ContratoCuotas[]> {
  const { data } = await getSupabase()
    .from("convenio_contratos")
    .select("*, convenio:convenios(nombre), paciente:pacientes(id, nombres, apellidos, rut), cuotas:convenio_cuotas(id, numero, monto, vencimiento, pagada_en, metodo, referencia)")
    .order("created_at", { ascending: false })
    .limit(100)
  const lista = (data ?? []) as ContratoCuotas[]
  for (const c of lista) c.cuotas.sort((a, b) => a.numero - b.numero)
  return lista
}

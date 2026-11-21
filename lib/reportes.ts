import { getSupabase } from "@/lib/supabase"
import type { FilaDesempeno } from "@/lib/reportes-calculo"

export async function reporteDesempeno(desde: string, hasta: string): Promise<FilaDesempeno[]> {
  const { data, error } = await getSupabase().rpc("reporte_desempeno", { p_desde: desde, p_hasta: hasta })
  if (error) throw new Error(`No se pudo generar el reporte: ${error.message}`)
  return ((data ?? []) as FilaDesempeno[]).map((f) => ({ ...f, produccion: Number(f.produccion) || 0 }))
}

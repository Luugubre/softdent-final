export type FilaDesempeno = {
  profesional_id: string
  profesional_nombre: string
  citas_total: number
  realizadas: number
  no_asistio: number
  canceladas: number
  pacientes_atendidos: number
  minutos_agendados: number
  minutos_disponibles: number
  produccion: number
  presupuestos_creados: number
  presupuestos_aprobados: number
  recetas: number
  documentos: number
}

export type Totales = Omit<FilaDesempeno, "profesional_id" | "profesional_nombre">

export const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null)

export function indicadores(f: Totales) {
  return {
    asistencia: porcentaje(f.realizadas, f.realizadas + f.no_asistio),
    ocupacion: porcentaje(f.minutos_agendados, f.minutos_disponibles),
    aceptacion: porcentaje(f.presupuestos_aprobados, f.presupuestos_creados),
  }
}

export function sumar(filas: FilaDesempeno[]): Totales {
  const t: Totales = {
    citas_total: 0,
    realizadas: 0,
    no_asistio: 0,
    canceladas: 0,
    pacientes_atendidos: 0,
    minutos_agendados: 0,
    minutos_disponibles: 0,
    produccion: 0,
    presupuestos_creados: 0,
    presupuestos_aprobados: 0,
    recetas: 0,
    documentos: 0,
  }
  for (const f of filas) for (const k of Object.keys(t) as (keyof Totales)[]) t[k] += Number(f[k]) || 0
  return t
}

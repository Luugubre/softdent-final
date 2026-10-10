import { cache } from "react"
import { getSupabase } from "@/lib/supabase"
import { hoyChile } from "@/lib/formato"

export type PrestacionCatalogo = { id: string; codigo_interno: string; nombre: string; icono: string | null }
export type CarpetaPrestaciones = { id: string; nombre: string; prestaciones: PrestacionCatalogo[] }
export type Catalogo = {
  carpetas: CarpetaPrestaciones[]
  /** precios[arancelId][prestacionId] = precio vigente hoy */
  precios: Record<string, Record<string, number>>
}

type Respuesta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Trae TODAS las filas (la API de Supabase entrega máximo 1000 por consulta) */
async function todasLasFilas<T>(consulta: (desde: number, hasta: number) => Respuesta<T>): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999)
    if (error) throw new Error(error.message)
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return filas
}

/**
 * Catálogo de prestaciones activas agrupado por carpeta (categoría),
 * con el precio de hoy en cada arancel pedido. Se carga en el servidor.
 * Misma regla que la BD: precio del arancel → si es convenio con %, base con descuento → si no, precio base.
 */
export const obtenerCatalogo = cache(async (arancelIdsTexto: string): Promise<Catalogo> => {
  const supabase = getSupabase()
  const hoy = hoyChile()

  const { data: aranceles } = await supabase.from("aranceles").select("id, es_base, porcentaje_descuento")
  const base = aranceles?.find((a) => a.es_base)?.id
  const pedidos = arancelIdsTexto.split(",").filter(Boolean)
  const ids = [...new Set([...pedidos, base].filter(Boolean))] as string[]

  type FilaPrestacion = PrestacionCatalogo & {
    categoria_id: string
    categoria: { nombre: string; orden: number } | null
  }
  type FilaPrecio = { prestacion_id: string; arancel_id: string; precio: number }

  const [prestaciones, filasPrecio] = await Promise.all([
    todasLasFilas<FilaPrestacion>(
      (desde, hasta) =>
        supabase
          .from("prestaciones")
          .select("id, codigo_interno, nombre, icono, categoria_id, categoria:categorias_prestaciones(nombre, orden)")
          .eq("activo", true)
          .order("nombre")
          .order("id")
          .range(desde, hasta) as unknown as Respuesta<FilaPrestacion>
    ),
    ids.length === 0
      ? Promise.resolve([] as FilaPrecio[])
      : todasLasFilas<FilaPrecio>((desde, hasta) =>
          supabase
            .from("prestacion_precios")
            .select("prestacion_id, arancel_id, precio")
            .in("arancel_id", ids)
            .lte("vigente_desde", hoy)
            .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
            .order("id")
            .range(desde, hasta)
        ),
  ])

  // Precios específicos por arancel
  const especificos: Record<string, Record<string, number>> = {}
  for (const f of filasPrecio) (especificos[f.arancel_id] ??= {})[f.prestacion_id] = f.precio
  const preciosBase = (base && especificos[base]) || {}

  // Precio final por arancel pedido
  const precios: Record<string, Record<string, number>> = {}
  for (const arancelId of pedidos) {
    const descuento = Number(aranceles?.find((a) => a.id === arancelId)?.porcentaje_descuento ?? 0)
    const propios = especificos[arancelId] ?? {}
    const mapa: Record<string, number> = {}
    for (const p of prestaciones) {
      const valorBase = preciosBase[p.id]
      const valor =
        propios[p.id] ??
        (valorBase !== undefined ? (descuento > 0 ? Math.round(valorBase * (1 - descuento / 100)) : valorBase) : undefined)
      if (valor !== undefined) mapa[p.id] = valor
    }
    precios[arancelId] = mapa
  }

  // Agrupar en carpetas
  const carpetas = new Map<string, CarpetaPrestaciones & { orden: number }>()
  for (const p of prestaciones) {
    if (!carpetas.has(p.categoria_id)) {
      carpetas.set(p.categoria_id, {
        id: p.categoria_id,
        nombre: p.categoria?.nombre ?? "Sin categoría",
        orden: p.categoria?.orden ?? 999,
        prestaciones: [],
      })
    }
    carpetas.get(p.categoria_id)!.prestaciones.push({
      id: p.id,
      codigo_interno: p.codigo_interno,
      nombre: p.nombre,
      icono: p.icono,
    })
  }

  return {
    carpetas: [...carpetas.values()]
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"))
      .map(({ id, nombre, prestaciones }) => ({ id, nombre, prestaciones })),
    precios,
  }
})

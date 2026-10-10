import { cache } from "react"
import { getSupabase } from "@/lib/supabase"
import type { Arancel, ItemCatalogo } from "@/types/prestacion"

/** Catálogos que usan varias páginas del módulo */
export const obtenerCatalogos = cache(async () => {
  const supabase = getSupabase()
  const [aranceles, categorias, especialidades] = await Promise.all([
    supabase.from("aranceles").select("*").order("es_base", { ascending: false }).order("tipo").order("nombre"),
    supabase.from("categorias_prestaciones").select("id, nombre, activo").order("orden").order("nombre"),
    supabase.from("especialidades").select("id, nombre, activo").order("nombre"),
  ])
  return {
    aranceles: (aranceles.data ?? []) as Arancel[],
    categorias: (categorias.data ?? []) as ItemCatalogo[],
    especialidades: (especialidades.data ?? []) as ItemCatalogo[],
  }
})

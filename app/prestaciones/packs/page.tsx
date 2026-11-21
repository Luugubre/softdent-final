import Link from "next/link"
import { getSupabase } from "@/lib/supabase"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { Encabezado, ComoFunciona } from "@/components/ui/Ayuda"
import { GestionPacksClient, type PackConItems, type PrestacionOpcion } from "@/components/prestaciones/GestionPacksClient"

export default async function PacksPrestacionesPage() {
  const usuario = await requerirPermiso("prestaciones.ver")
  const gestionar = puede(usuario.rol, "prestaciones.gestionar")
  const supabase = getSupabase()

  const [{ data: arancelBase }, { data: prestacionesRaw }, { data: packsRaw }] = await Promise.all([
    supabase.from("aranceles").select("id").eq("es_base", true).maybeSingle(),
    supabase
      .from("prestaciones")
      .select("id, codigo_interno, nombre, duracion_min, activo")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("plantillas_prestaciones")
      .select(`
        id,
        nombre,
        descripcion,
        activo,
        items:plantilla_prestacion_items(
          id,
          prestacion_id,
          cantidad,
          precio_pack,
          nota,
          orden,
          prestacion:prestaciones(id, codigo_interno, nombre, duracion_min, activo)
        )
      `)
      .order("activo", { ascending: false })
      .order("nombre"),
  ])

  const preciosBase = new Map<string, number>()
  if (arancelBase?.id && (prestacionesRaw ?? []).length > 0) {
    const { data: vigentes } = await supabase
      .from("v_precios_vigentes")
      .select("prestacion_id, precio")
      .eq("arancel_id", arancelBase.id)
    for (const v of vigentes ?? []) {
      if (v.precio) preciosBase.set(v.prestacion_id, v.precio)
    }
  }

  const prestaciones: PrestacionOpcion[] = (prestacionesRaw ?? []).map((p) => ({
    id: p.id,
    codigo_interno: p.codigo_interno,
    nombre: p.nombre,
    duracion_min: p.duracion_min,
    precio_base: preciosBase.get(p.id) ?? 0,
  }))

  const packs = (packsRaw ?? []) as unknown as PackConItems[]

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="📦"
        titulo="Plantillas de prestaciones (Packs)"
        descripcion="Agrupa conjuntos de prestaciones frecuentes o promocionales para agregarlas en un solo clic al tratamiento del paciente."
        migas={[
          { href: "/prestaciones", etiqueta: "Prestaciones" },
          { etiqueta: "Packs de prestaciones" },
        ]}
        acciones={
          <Link
            href="/prestaciones"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
          >
            ← Volver a prestaciones
          </Link>
        }
      />

      <ComoFunciona
        pasos={[
          <>Crea un <strong>Pack</strong> (ej. <em>Pack Higiene + Destartraje</em>, <em>Pack Rehabilitación Implante</em> o <em>Pack Ortodoncia Inicial</em>).</>,
          <>Agrega las prestaciones que lo componen, su cantidad y opcionalmente un <strong>precio promocional fijo</strong> (si lo dejas vacío, tomará el precio vigente del arancel del paciente).</>,
          <>Dentro del tratamiento de cualquier paciente, presiona <strong>📦 Aplicar pack</strong> para cargar todas sus prestaciones de una vez.</>,
        ]}
        reglas={[
          <>Cada prestación del pack se inserta como un ítem independiente en el tratamiento, permitiendo evolucionar y cobrar cada una por separado.</>,
          <>Si el tratamiento tiene fases creadas, puedes elegir a qué fase asignar el pack completo.</>,
        ]}
      />

      <GestionPacksClient packs={packs} prestaciones={prestaciones} puedeGestionar={gestionar} />
    </div>
  )
}
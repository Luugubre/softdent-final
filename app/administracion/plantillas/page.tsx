import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"
import GestionPlantillasClient, { type PlantillaBD } from "./GestionPlantillasClient"

const FILTROS = [
  { valor: "", etiqueta: "Todas", titulo: "Plantillas de Documentos" },
  { valor: "documentos", etiqueta: "📄 Docs clínicos", titulo: "Plantillas de documentos clínicos" },
  { valor: "consentimientos", etiqueta: "✍️ Consentimientos", titulo: "Plantillas de consentimientos" },
]

export default async function AdministracionPlantillasPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const usuario = await requerirPermiso("plantillas.gestionar")
  const { tipo } = await searchParams
  const filtro = FILTROS.find((f) => f.valor === tipo) ?? FILTROS[0]
  const supabase = getSupabase()

  // Obtener todas las plantillas activas
  const { data: plantillas } = await supabase
    .from("plantillas_documento")
    .select("*")
    .eq("activa", true)
    .order("nombre", { ascending: true })

  const visibles = (plantillas ?? []).filter((p) =>
    filtro.valor === "consentimientos" ? p.tipo === "CONSENTIMIENTO" : filtro.valor === "documentos" ? p.tipo !== "CONSENTIMIENTO" : true
  )

  const plantillasFormateadas: PlantillaBD[] = visibles.map((p) => ({
    id: String(p.id),
    tipo: p.tipo,
    nombre: p.nombre,
    contenido: p.contenido,
    version: p.version,
    activa: p.activa,
    updated_at: p.updated_at,
  }))

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Administración</p>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{filtro.titulo}</h1>
          <p className="text-xs font-semibold text-gray-500 mt-1">
            Diseña los consentimientos e informados con variables automáticas. Guardar cambios genera una versión inmutable (v+1).
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 text-xs font-bold">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={f.valor ? `/administracion/plantillas?tipo=${f.valor}` : "/administracion/plantillas"}
            className={`rounded-full border px-3 py-1 ${
              f.valor === filtro.valor ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
            }`}
          >
            {f.etiqueta}
          </Link>
        ))}
      </nav>

      <GestionPlantillasClient
        key={filtro.valor}
        plantillas={plantillasFormateadas}
        esAdmin={usuario.rol === "ADMINISTRADOR"}
      />
    </div>
  )
}
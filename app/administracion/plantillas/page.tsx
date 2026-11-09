import { requerirUsuario } from "@/lib/auth"
import { crearClienteAuth } from "@/lib/supabase-auth"
import GestionPlantillasClient, { type PlantillaBD } from "./GestionPlantillasClient"

export default async function AdministracionPlantillasPage() {
  const usuario = await requerirUsuario()
  const supabase = await crearClienteAuth()

  // Obtener todas las plantillas activas
  const { data: plantillas } = await supabase
    .from("plantillas_documento")
    .select("*")
    .eq("activa", true)
    .order("nombre", { ascending: true })

  const plantillasFormateadas: PlantillaBD[] = (plantillas ?? []).map((p) => ({
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
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Plantillas de Documentos</h1>
          <p className="text-xs font-semibold text-gray-500 mt-1">
            Diseña los consentimientos e informados con variables automáticas. Guardar cambios genera una versión inmutable (v+1).
          </p>
        </div>
      </header>

      <GestionPlantillasClient
        plantillas={plantillasFormateadas}
        esAdmin={usuario.rol === "ADMINISTRADOR"}
      />
    </div>
  )
}
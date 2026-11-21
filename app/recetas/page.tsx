import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { listarRecetas } from "@/lib/recetas"
import { TablaRecetas } from "@/components/recetas/TablaRecetas"

export default async function RecetasPage() {
  const usuario = await requerirPermiso("clinico.ver")
  const recetas = await listarRecetas()

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📄 Recetario Médico</h1>
          <p className="text-xs text-gray-500">Gestión e historial de prescripciones clínicas emitidas.</p>
        </div>
        {puede(usuario.rol, "recetas.emitir") && (
          <Link
            href="/recetas/nueva"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md transition-all flex items-center gap-2"
          >
            <span>+</span> Nueva Receta
          </Link>
        )}
      </div>

      <TablaRecetas recetas={recetas} usuario={usuario} />
    </div>
  )
}

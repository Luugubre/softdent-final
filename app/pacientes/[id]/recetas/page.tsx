import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { listarRecetas } from "@/lib/recetas"
import { TablaRecetas } from "@/components/recetas/TablaRecetas"

export default async function RecetasPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("clinico.ver")
  const { id } = await params
  const recetas = await listarRecetas(id)

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">📄 Recetario Médico</h2>
          <p className="text-xs font-medium text-gray-500">Prescripciones clínicas emitidas para este paciente.</p>
        </div>
        {puede(usuario.rol, "recetas.emitir") && (
          <Link
            href={`/pacientes/${id}/recetas/nueva`}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
          >
            <span>+</span> Nueva Receta
          </Link>
        )}
      </div>
      <TablaRecetas recetas={recetas} usuario={usuario} mostrarPaciente={false} />
    </section>
  )
}

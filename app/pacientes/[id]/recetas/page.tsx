import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { BotonAnularReceta } from "@/components/recetas/BotonAnularReceta"

type RecetaRow = {
  id: string
  folio: number
  created_at: string
  diagnostico: string
  estado: "EMITIDA" | "ANULADA"
  paciente_id: string
}

export default async function RecetasPacientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requerirPermiso("clinico.ver")
  const { id } = await params
  const supabase = await crearClienteAuth()

  const { data: recetasRaw, error } = await supabase
    .from("recetas")
    .select("id, folio, created_at, diagnostico, estado, paciente_id")
    .eq("paciente_id", id)
    .order("folio", { ascending: false })

  if (error) {
    console.error("Error al obtener recetas del paciente:", error)
  }

  const recetas = (recetasRaw ?? []) as RecetaRow[]

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">📄 Recetario Médico</h2>
          <p className="text-xs font-medium text-gray-500">
            Prescripciones clínicas emitidas para este paciente.
          </p>
        </div>
        <Link
          href={`/pacientes/${id}/recetas/nueva`}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
        >
          <span>+</span> Nueva Receta
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-xs text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Diagnóstico</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recetas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-medium">
                  Este paciente aún no tiene recetas emitidas.
                </td>
              </tr>
            ) : (
              recetas.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-900">#{r.folio}</td>
                  <td className="px-4 py-3 font-medium">
                    {new Date(r.created_at).toLocaleDateString("es-CL")}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700 max-w-md">
                    {r.diagnostico}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        r.estado === "EMITIDA"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <a
                      href={`/recetas/${r.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-bold transition-colors"
                    >
                      🖨️ PDF
                    </a>
                    {r.estado === "EMITIDA" && (
                      <BotonAnularReceta recetaId={r.id} folio={r.folio} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
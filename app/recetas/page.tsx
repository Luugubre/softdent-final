import Link from "next/link"
import { requerirUsuario } from "@/lib/auth"
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

export default async function RecetasPage() {
  await requerirUsuario()
  const supabase = await crearClienteAuth()

  // 1. Consultar listado de recetas
  const { data: recetasRaw, error: errRecetas } = await supabase
    .from("recetas")
    .select("id, folio, created_at, diagnostico, estado, paciente_id")
    .order("folio", { ascending: false })

  if (errRecetas) {
    console.error("Error al obtener recetas:", errRecetas)
  }

  // 2. Consultar pacientes para resolver nombres
  const { data: pacientesRaw } = await supabase
    .from("pacientes")
    .select("id, nombres, apellidos, rut")

  const recetas = (recetasRaw ?? []).map((r: RecetaRow) => {
    const paciente = (pacientesRaw ?? []).find((p) => p.id === r.paciente_id)
    const pacienteNombre = paciente
      ? `${paciente.nombres ?? ""} ${paciente.apellidos ?? ""}`.trim()
      : "Paciente desconocido"

    return {
      ...r,
      pacienteNombre,
      pacienteRut: paciente?.rut || "",
    }
  })

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📄 Recetario Médico</h1>
          <p className="text-xs text-gray-500">Gestión e historial de prescripciones clínicas emitidas.</p>
        </div>
        <Link
          href="/recetas/nueva"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md transition-all flex items-center gap-2"
        >
          <span>+</span> Nueva Receta
        </Link>
      </div>

      {/* Tabla de Historial */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Diagnóstico</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recetas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No hay recetas registradas en el sistema.
                </td>
              </tr>
            ) : (
              recetas.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-900">#{r.folio}</td>
                  <td className="px-4 py-3 font-medium">
                    {new Date(r.created_at).toLocaleDateString("es-CL")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{r.pacienteNombre}</div>
                    <div className="text-[10px] text-gray-400">{r.pacienteRut}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700 max-w-xs truncate">
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
                  <td className="px-4 py-3 text-right space-x-2">
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
    </div>
  )
}
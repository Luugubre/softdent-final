import { BotonAnularReceta } from "@/components/recetas/BotonAnularReceta"
import type { RecetaListado } from "@/lib/recetas"
import type { Perfil } from "@/types/perfil"
import { puede } from "@/lib/permisos"

export function TablaRecetas({
  recetas,
  usuario,
  mostrarPaciente = true,
}: {
  recetas: RecetaListado[]
  usuario: Perfil
  mostrarPaciente?: boolean
}) {
  const puedeAnular = (r: RecetaListado) =>
    r.estado === "EMITIDA" &&
    puede(usuario.rol, "recetas.anular") &&
    (usuario.rol === "ADMINISTRADOR" || r.profesional_id === usuario.id)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-left text-xs text-gray-600">
        <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
          <tr>
            <th className="px-4 py-3">Folio</th>
            <th className="px-4 py-3">Fecha</th>
            {mostrarPaciente && <th className="px-4 py-3">Paciente</th>}
            <th className="px-4 py-3">Dentista</th>
            <th className="px-4 py-3">Diagnóstico</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {recetas.length === 0 ? (
            <tr>
              <td colSpan={mostrarPaciente ? 7 : 6} className="px-4 py-8 text-center text-gray-400">
                No hay recetas registradas.
              </td>
            </tr>
          ) : (
            recetas.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-4 py-3 font-bold text-gray-900">#{r.folio}</td>
                <td className="px-4 py-3 font-medium">{new Date(r.created_at).toLocaleDateString("es-CL")}</td>
                {mostrarPaciente && (
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{r.pacienteNombre}</div>
                    <div className="text-[10px] text-gray-400">{r.pacienteRut}</div>
                  </td>
                )}
                <td className="px-4 py-3 font-medium text-gray-700">{r.profesionalNombre}</td>
                <td className="px-4 py-3 font-medium text-gray-700 max-w-xs truncate">{r.diagnostico}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    title={r.motivo_anulacion ?? undefined}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                      r.estado === "EMITIDA" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
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
                  {puedeAnular(r) && <BotonAnularReceta recetaId={r.id} folio={r.folio} />}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

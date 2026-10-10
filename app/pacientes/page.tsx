import Link from "next/link"
import { getSupabase } from "@/lib/supabase"
import { PacienteForm } from "@/components/PacienteForm"
import { BotonEstadoPaciente } from "@/components/BotonEstadoPaciente"
import { calcularEdad, formatearRut } from "@/lib/validaciones"
import type { Paciente } from "@/types/paciente"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const usuario = await requerirPermiso("pacientes.ver")
  const puedeEditar = puede(usuario.rol, "pacientes.editar")
  const puedeDeshabilitar = puede(usuario.rol, "pacientes.deshabilitar")
  const q = ((await searchParams)?.q ?? "").trim()
  const supabase = getSupabase()

  let consulta = supabase
    .from("pacientes")
    .select("id, numero_ficha, rut, nombres, apellidos, fecha_nacimiento, prevision, telefono, email, activo")
    .order("created_at", { ascending: false })
    .limit(100)

  if (q) {
    // Quitamos caracteres que rompen el filtro .or() de Supabase
    const texto = q.replace(/[,()%]/g, " ").trim()
    const rut = q.replace(/\./g, "").toUpperCase()
    consulta = consulta.or(
      `rut.ilike.%${rut}%,nombres.ilike.%${texto}%,apellidos.ilike.%${texto}%`
    )
  }

  const { data, error } = await consulta
  const pacientes = (data ?? []) as Pick<
    Paciente,
    "id" | "numero_ficha" | "rut" | "nombres" | "apellidos" | "fecha_nacimiento" | "prevision" | "telefono" | "email" | "activo"
  >[]

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Directorio de Pacientes</h1>

      {puedeEditar && <PacienteForm />}

      {/* Buscador */}
      <form method="GET" className="flex gap-2 max-w-lg">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por RUT, nombre o apellido..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-400 font-semibold shadow-sm"
        />
        {q && (
          <Link href="/pacientes" className="px-4 py-2.5 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 flex items-center text-sm font-bold">
            Limpiar
          </Link>
        )}
      </form>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">
          Error al cargar pacientes: {error.message}
        </div>
      )}

      {/* Tabla */}
      <div className="w-full bg-white shadow-sm rounded-2xl overflow-x-auto border border-gray-200">
        <table className="w-full divide-y divide-gray-200 text-left">
          <thead className="bg-gray-100">
            <tr>
              {["Ficha", "RUT", "Nombre", "Edad", "Previsión", "Contacto", "Estado", ""].map((h) => (
                <th key={h} className="px-6 py-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pacientes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500 font-semibold">
                  {q ? "No se encontraron pacientes que coincidan con la búsqueda." : "No hay pacientes registrados aún."}
                </td>
              </tr>
            ) : (
              pacientes.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">#{p.numero_ficha}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 font-bold">{formatearRut(p.rut)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-extrabold">{p.nombres} {p.apellidos}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{calcularEdad(p.fecha_nacimiento) ?? "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">{p.prevision}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-bold text-gray-900">{p.telefono || "-"}</div>
                    <div className="text-xs text-gray-500">{p.email || ""}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <BotonEstadoPaciente pacienteId={p.id} activo={p.activo} puedeCambiar={puedeDeshabilitar} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <Link
                      href={`/pacientes/${p.id}`}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 font-bold text-xs shadow-sm"
                    >
                      Ver ficha →
                    </Link>
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

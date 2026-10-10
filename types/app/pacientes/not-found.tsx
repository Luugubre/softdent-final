import Link from "next/link"

export default function PacienteNoEncontrado() {
  return (
    <div className="w-full min-h-screen bg-gray-50 p-10 space-y-4">
      <h1 className="text-2xl font-extrabold text-gray-900">Paciente no encontrado</h1>
      <p className="text-gray-600 font-medium">El paciente que buscas no existe o el enlace es incorrecto.</p>
      <Link href="/pacientes" className="inline-block text-sm font-bold text-blue-600 hover:underline">
        ← Volver al directorio
      </Link>
    </div>
  )
}

import Link from "next/link"

export default function SinPermiso() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        <p className="text-5xl">🔒</p>
        <h1 className="text-2xl font-extrabold text-gray-900">Sin permiso</h1>
        <p className="text-sm font-medium text-gray-600">
          Tu rol no tiene acceso a esta sección. Si crees que es un error, contacta al administrador.
        </p>
        <Link href="/" className="inline-block text-sm font-bold text-blue-600 hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}

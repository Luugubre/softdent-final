import { cerrarSesion } from "@/app/login/actions"

// Se muestra cuando alguien inició sesión pero no tiene perfil activo en el sistema
export default function SinAcceso() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        <p className="text-5xl">⛔</p>
        <h1 className="text-2xl font-extrabold text-gray-900">Cuenta sin acceso</h1>
        <p className="text-sm font-medium text-gray-600">
          Tu cuenta existe, pero no tiene un perfil activo en el sistema. Pide al administrador que te asigne un rol.
        </p>
        <form action={cerrarSesion}>
          <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}

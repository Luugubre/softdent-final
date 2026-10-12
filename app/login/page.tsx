import { FormLogin } from "@/components/FormLogin"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-gray-50">
      <section className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-600 to-blue-800 p-12 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-2xl">🦷</span>
          <span className="text-2xl font-black">SoftDent</span>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-black leading-tight">La gestión de tu clínica dental, en un solo lugar.</h2>
          <ul className="space-y-2 text-sm font-semibold text-blue-100">
            <li>📅 Agenda por dentista, box y estado de cada cita</li>
            <li>🧑‍⚕️ Ficha clínica, odontograma y tratamientos</li>
            <li>💰 Pagos, caja, FONASA y convenios</li>
            <li>👩‍⚕️ Liquidaciones automáticas por porcentaje</li>
          </ul>
        </div>
        <p className="text-xs font-semibold text-blue-200">Cada usuario ve solo lo que su rol le permite.</p>
      </section>

      <section className="flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-4xl lg:hidden">🦷</p>
            <h1 className="text-2xl font-extrabold text-gray-900">Iniciar sesión</h1>
            <p className="text-sm font-medium text-gray-500">Ingresa con el correo y la contraseña que te entregó el administrador.</p>
          </div>
          <FormLogin next={next ?? ""} />
          <p className="text-center text-xs font-medium text-gray-400">¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva.</p>
        </div>
      </section>
    </main>
  )
}

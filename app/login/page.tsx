import { CalendarDays, HandCoins, ShieldCheck, Users, Wallet } from "lucide-react"
import { FormLogin } from "@/components/FormLogin"

const PUNTOS = [
  { icono: CalendarDays, texto: "Agenda por dentista, box y estado de cada cita" },
  { icono: Users, texto: "Ficha clínica, odontograma y tratamientos" },
  { icono: Wallet, texto: "Pagos, caja, FONASA y convenios" },
  { icono: HandCoins, texto: "Liquidaciones automáticas por carpeta y porcentaje" },
]

function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7.5 2.5c-2.6 0-4.5 2.2-4.5 5 0 1.9.6 3.4 1.2 5 .6 1.7 1 3.6 1.3 6 .2 1.7.9 3 2 3 1.2 0 1.6-1.2 1.9-2.7.3-1.6.6-3.3 1.6-3.3h1c1 0 1.3 1.7 1.6 3.3.3 1.5.7 2.7 1.9 2.7 1.1 0 1.8-1.3 2-3 .3-2.4.7-4.3 1.3-6 .6-1.6 1.2-3.1 1.2-5 0-2.8-1.9-5-4.5-5-1.6 0-2.5.8-3.5.8S9.1 2.5 7.5 2.5Z" />
    </svg>
  )
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams

  return (
    <main className="grid min-h-screen bg-gray-50 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 p-12 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
        />

        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Logo className="h-6 w-6" />
          </span>
          <span className="text-2xl font-bold tracking-tight">SoftDent</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">La gestión de tu clínica dental, en un solo lugar.</h2>
          <ul className="space-y-3">
            {PUNTOS.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-sm text-blue-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icono className="h-[18px] w-[18px]" aria-hidden />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-blue-200">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Cada usuario ve solo lo que su rol le permite.
        </p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <span className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-900/20 lg:hidden">
              <Logo className="h-6 w-6" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bienvenido</h1>
            <p className="text-sm text-gray-500">Ingresa con el correo y la contraseña que te entregó el administrador.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <FormLogin next={next ?? ""} />
          </div>
          <p className="text-center text-xs text-gray-400">¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva.</p>
        </div>
      </section>
    </main>
  )
}

import Link from "next/link"
import { obtenerUsuarioActual } from "@/lib/auth"
import { cerrarSesion } from "@/app/login/actions"
import { ROL_COLOR, ROL_ETIQUETAS, puede } from "@/lib/permisos"

export async function BarraSuperior() {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return null // en el login no se muestra

  const enlaces = [
    { href: "/pacientes", etiqueta: "Pacientes", visible: puede(usuario.rol, "pacientes.ver") },
    { href: "/agenda", etiqueta: "Agenda", visible: puede(usuario.rol, "agenda.ver") },
    { href: "/prestaciones", etiqueta: "Prestaciones", visible: puede(usuario.rol, "prestaciones.ver") },
    { href: "/caja", etiqueta: "Caja", visible: puede(usuario.rol, "caja.gestionar") },
    { href: "/fonasa-convenios", etiqueta: "FONASA / Convenios", visible: puede(usuario.rol, "fonasa.gestionar") },
    {
      href: "/liquidaciones",
      etiqueta: puede(usuario.rol, "liquidaciones.gestionar") ? "Liquidaciones" : "Mis liquidaciones",
      visible: puede(usuario.rol, "liquidaciones.ver"),
    },
    { href: "/usuarios", etiqueta: "Usuarios", visible: puede(usuario.rol, "usuarios.gestionar") },
    { href: "/administracion", etiqueta: "Administración", visible: puede(usuario.rol, "administracion.gestionar") },
  ].filter((e) => e.visible)

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-4 md:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/pacientes" className="text-lg font-black text-gray-900">
            🦷 SoftDent
          </Link>
          <nav className="hidden sm:flex items-center gap-1 overflow-x-auto max-w-[70vw]">
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="px-3 py-1.5 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 whitespace-nowrap"
              >
                {e.etiqueta}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight hidden md:block">
            <p className="text-sm font-extrabold text-gray-900">{usuario.nombre_completo}</p>
            <p className="text-xs font-medium text-gray-500">{usuario.email}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase ${ROL_COLOR[usuario.rol]}`}>
            {ROL_ETIQUETAS[usuario.rol]}
          </span>
          <form action={cerrarSesion}>
            <button className="text-sm font-bold text-gray-500 hover:text-rose-600">Salir</button>
          </form>
        </div>
      </div>
    </header>
  )
}

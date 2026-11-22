"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SECCIONES_ADMIN } from "@/lib/admin-secciones"

const EXTRA = [
  { href: "/administracion/plantillas", titulo: "Plantillas", icono: "📝" },
  { href: "/administracion/auditoria", titulo: "Auditoría", icono: "🛡️" },
]

export function NavAdmin() {
  const pathname = usePathname()
  const enlaces = [
    { href: "/administracion", titulo: "Resumen", icono: "⚙️" },
    ...SECCIONES_ADMIN.map((s) => ({ href: `/administracion/${s.slug}`, titulo: s.titulo, icono: s.icono })),
    ...EXTRA,
  ]

  return (
    <nav aria-label="Secciones de administración" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {enlaces.map((e) => {
        const activo = pathname === e.href
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activo ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-blue-700 hover:ring-blue-300"
            }`}
          >
            <span aria-hidden>{e.icono}</span>
            {e.titulo}
          </Link>
        )
      })}
    </nav>
  )
}

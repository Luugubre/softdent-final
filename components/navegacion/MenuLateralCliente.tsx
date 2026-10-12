"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

export type EnlaceMenu = { href: string; icono: string; etiqueta: string; ayuda: string; visible: boolean }
export type GrupoMenu = { titulo: string; enlaces: EnlaceMenu[] }

type UsuarioMenu = { nombre: string; email: string; rol: string; colorRol: string }

function enlaceActivo(grupos: GrupoMenu[], pathname: string) {
  const hrefs = grupos.flatMap((g) => g.enlaces.map((e) => e.href))
  return hrefs
    .filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0]
}

export function MenuLateralCliente({ grupos, usuario, salir }: { grupos: GrupoMenu[]; usuario: UsuarioMenu; salir: ReactNode }) {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)
  const activo = enlaceActivo(grupos, pathname)

  useEffect(() => setAbierto(false), [pathname])

  const contenido = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2 px-5 h-14 shrink-0 border-b border-gray-100">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-lg text-white shadow-sm">🦷</span>
        <span className="leading-tight">
          <span className="block text-lg font-black text-gray-900">SoftDent</span>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-400">Gestión clínica</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {grupos.map((g) => (
          <div key={g.titulo || "inicio"} className="space-y-0.5">
            {g.titulo && <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">{g.titulo}</p>}
            {g.enlaces.map((e) => {
              const esActivo = e.href === activo
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  aria-current={esActivo ? "page" : undefined}
                  className={`group flex items-start gap-3 rounded-xl px-3 py-1.5 transition-colors ${
                    esActivo ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span aria-hidden className="mt-0.5 text-base leading-none">
                    {e.icono}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-sm font-bold">{e.etiqueta}</span>
                    <span className={`block truncate text-[11px] font-medium ${esActivo ? "text-blue-100" : "text-gray-400 group-hover:text-gray-500"}`}>{e.ayuda}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-gray-100 p-3 space-y-1">
        <div className="flex items-center justify-between gap-2 px-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-gray-900">{usuario.nombre}</p>
            <p className="truncate text-[11px] font-medium text-gray-500">{usuario.email}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${usuario.colorRol}`}>{usuario.rol}</span>
        </div>
        {salir}
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:block sticky top-0 h-screen w-64 shrink-0 border-r border-gray-200 bg-white print:hidden">{contenido}</aside>

      <div className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 print:hidden">
        <button
          onClick={() => setAbierto(true)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700"
          aria-label="Abrir menú"
        >
          ☰ Menú
        </button>
        <Link href="/" className="text-lg font-black text-gray-900">
          🦷 SoftDent
        </Link>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${usuario.colorRol}`}>{usuario.rol}</span>
      </div>

      {abierto && (
        <div className="lg:hidden fixed inset-0 z-50 print:hidden">
          <button aria-label="Cerrar menú" onClick={() => setAbierto(false)} className="absolute inset-0 bg-gray-900/40" />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl">{contenido}</aside>
        </div>
      )}
    </>
  )
}

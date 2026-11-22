"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"
import {
  Banknote,
  Building2,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileSignature,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  FolderTree,
  GraduationCap,
  Handshake,
  HandCoins,
  HeartPulse,
  History,
  House,
  Landmark,
  LifeBuoy,
  Menu,
  ScanSearch,
  ScrollText,
  Settings,
  ShieldCheck,
  Stethoscope,
  Tags,
  UserX,
  Users,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"

export type EnlaceMenu = { href: string; icono: string; etiqueta: string; ayuda: string; visible: boolean }
export type GrupoMenu = { titulo: string; enlaces: EnlaceMenu[] }

type UsuarioMenu = { nombre: string; email: string; rol: string }

const ICONOS: Record<string, LucideIcon> = {
  inicio: House,
  agenda: CalendarDays,
  pacientes: Users,
  caja: Wallet,
  seguimiento: ScanSearch,
  perfil: CircleUserRound,
  inasistencias: UserX,
  firma: FileSignature,
  convenios: Handshake,
  liquidaciones: HandCoins,
  aranceles: Stethoscope,
  presupuestos: ClipboardList,
  pagos: Banknote,
  reportes: ChartColumn,
  excel: FileSpreadsheet,
  administracion: Settings,
  clinica: Building2,
  personal: UsersRound,
  especialidades: GraduationCap,
  previsiones: HeartPulse,
  box: DoorOpen,
  laboratorios: FlaskConical,
  historial: History,
  auditoria: ShieldCheck,
  carpetas: FolderTree,
  tipos: Tags,
  metodos: CreditCard,
  bancos: Landmark,
  plantillas: ScrollText,
  documentos: FileText,
  ayuda: LifeBuoy,
}

const PLEGADOS_DE_INICIO = ["Administración", "Configuración"]

function rutaDe(href: string) {
  return href.split("?")[0]
}

function enlaceActivo(grupos: GrupoMenu[], pathname: string) {
  return grupos
    .flatMap((g) => g.enlaces.map((e) => e.href))
    .filter((h) => {
      const r = rutaDe(h)
      return r === "/" ? pathname === "/" : pathname === r || pathname.startsWith(r + "/")
    })
    .sort((a, b) => rutaDe(b).length - rutaDe(a).length || a.length - b.length)[0]
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export function MenuLateralCliente({ grupos, usuario, salir }: { grupos: GrupoMenu[]; usuario: UsuarioMenu; salir: ReactNode }) {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)
  const activo = enlaceActivo(grupos, pathname)
  const grupoActivo = grupos.find((g) => g.enlaces.some((e) => e.href === activo))?.titulo
  const [plegados, setPlegados] = useState<Record<string, boolean>>({})

  const estaPlegado = (titulo: string) =>
    titulo !== grupoActivo && (plegados[titulo] ?? PLEGADOS_DE_INICIO.includes(titulo))

  const contenido = (
    <div className="flex h-full flex-col bg-blue-950 text-gray-300">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href="/" onClick={() => setAbierto(false)} className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-900/40">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M7.5 2.5c-2.6 0-4.5 2.2-4.5 5 0 1.9.6 3.4 1.2 5 .6 1.7 1 3.6 1.3 6 .2 1.7.9 3 2 3 1.2 0 1.6-1.2 1.9-2.7.3-1.6.6-3.3 1.6-3.3h1c1 0 1.3 1.7 1.6 3.3.3 1.5.7 2.7 1.9 2.7 1.1 0 1.8-1.3 2-3 .3-2.4.7-4.3 1.3-6 .6-1.6 1.2-3.1 1.2-5 0-2.8-1.9-5-4.5-5-1.6 0-2.5.8-3.5.8S9.1 2.5 7.5 2.5Z" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-white">SoftDent</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-blue-300/70">Gestión clínica</span>
          </span>
        </Link>
        <button onClick={() => setAbierto(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 lg:hidden" aria-label="Cerrar menú">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 pt-2 [scrollbar-color:rgb(255_255_255/0.15)_transparent]">
        {grupos.map((g) => {
          const plegado = g.titulo ? estaPlegado(g.titulo) : false
          return (
            <div key={g.titulo || "inicio"}>
              {g.titulo && (
                <button
                  type="button"
                  onClick={() => setPlegados((prev) => ({ ...prev, [g.titulo]: !plegado }))}
                  aria-expanded={!plegado}
                  className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 hover:text-gray-300"
                >
                  {g.titulo}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${plegado ? "-rotate-90" : ""}`} aria-hidden />
                </button>
              )}
              {!plegado && (
                <ul className="space-y-0.5">
                  {g.enlaces.map((e) => {
                    const esActivo = e.href === activo
                    const Icono = ICONOS[e.icono] ?? Settings
                    return (
                      <li key={e.href}>
                        <Link
                          href={e.href}
                          title={e.ayuda}
                          onClick={() => setAbierto(false)}
                          aria-current={esActivo ? "page" : undefined}
                          className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            esActivo ? "bg-blue-600 text-white shadow-sm shadow-black/20" : "text-gray-300 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          <Icono className={`h-[18px] w-[18px] shrink-0 ${esActivo ? "text-white" : "text-gray-400 group-hover:text-blue-300"}`} aria-hidden />
                          <span className="truncate">{e.etiqueta}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-200">
            {iniciales(usuario.nombre) || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{usuario.nombre}</p>
            <p className="truncate text-xs text-gray-400">{usuario.rol}</p>
          </div>
          {salir}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 print:hidden lg:block">{contenido}</aside>

      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur print:hidden lg:hidden">
        <button
          onClick={() => setAbierto(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700"
          aria-label="Abrir menú"
        >
          <Menu className="h-4 w-4" aria-hidden /> Menú
        </button>
        <Link href="/" className="text-base font-bold text-gray-900">
          SoftDent
        </Link>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-800" title={usuario.email}>
          {iniciales(usuario.nombre) || "?"}
        </span>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 print:hidden lg:hidden">
          <button aria-label="Cerrar menú" onClick={() => setAbierto(false)} className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] shadow-2xl">{contenido}</aside>
        </div>
      )}
    </>
  )
}

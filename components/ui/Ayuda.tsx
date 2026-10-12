import Link from "next/link"
import type { ReactNode } from "react"
import { GLOSARIO, type TerminoId } from "@/lib/glosario"

type Miga = { href?: string; etiqueta: string }

export function Encabezado({
  icono,
  titulo,
  descripcion,
  migas,
  acciones,
  children,
}: {
  icono?: string
  titulo: ReactNode
  descripcion?: ReactNode
  migas?: Miga[]
  acciones?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="space-y-3">
      {migas && migas.length > 0 && (
        <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 text-xs font-bold text-gray-400">
          <Link href="/" className="hover:text-blue-600">
            Inicio
          </Link>
          {migas.map((m, i) => (
            <span key={i} className="flex items-center gap-1">
              <span aria-hidden>›</span>
              {m.href ? (
                <Link href={m.href} className="hover:text-blue-600">
                  {m.etiqueta}
                </Link>
              ) : (
                <span className="text-gray-600">{m.etiqueta}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {icono && (
            <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white border border-gray-200 shadow-sm text-2xl">
              {icono}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{titulo}</h1>
            {descripcion && <p className="mt-0.5 text-sm font-medium text-gray-500 max-w-3xl">{descripcion}</p>}
          </div>
        </div>
        {acciones && <div className="flex items-center gap-2 flex-wrap">{acciones}</div>}
      </div>
      {children}
    </header>
  )
}

export function ComoFunciona({
  titulo = "¿Cómo funciona esta pantalla?",
  pasos,
  reglas,
  abierto = false,
}: {
  titulo?: string
  pasos?: ReactNode[]
  reglas?: ReactNode[]
  abierto?: boolean
}) {
  return (
    <details open={abierto} className="group rounded-2xl border border-blue-200 bg-blue-50/70 print:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-blue-900 select-none [&::-webkit-details-marker]:hidden">
        <span aria-hidden>💡</span>
        {titulo}
        <span className="ml-auto text-xs font-bold text-blue-600 group-open:hidden">Ver ayuda ▾</span>
        <span className="ml-auto hidden text-xs font-bold text-blue-600 group-open:inline">Ocultar ▴</span>
      </summary>
      <div className="grid gap-4 border-t border-blue-200 px-4 py-3 md:grid-cols-2">
        {pasos && pasos.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-700">Paso a paso</p>
            <ol className="space-y-1.5">
              {pasos.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-blue-950">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-[11px] font-black text-white">{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {reglas && reglas.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-700">Reglas importantes</p>
            <ul className="space-y-1.5">
              {reglas.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-blue-950">
                  <span aria-hidden className="text-blue-500">●</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}

export function SeConfigura({ items }: { items: { etiqueta: string; href: string; que?: string }[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs print:hidden">
      <span className="font-black uppercase tracking-wider text-gray-400">⚙️ Se configura en:</span>
      {items.map((it) => (
        <Link
          key={it.href + it.etiqueta}
          href={it.href}
          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-bold text-gray-700 hover:border-blue-300 hover:text-blue-700"
        >
          {it.que ? <span className="font-semibold text-gray-400">{it.que}: </span> : null}
          {it.etiqueta} →
        </Link>
      ))}
    </div>
  )
}

export function Seccion({
  id,
  icono,
  titulo,
  descripcion,
  acciones,
  children,
  className = "",
}: {
  id?: string
  icono?: string
  titulo: ReactNode
  descripcion?: ReactNode
  acciones?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`scroll-mt-20 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-gray-900">
            {icono && <span aria-hidden className="mr-1.5">{icono}</span>}
            {titulo}
          </h2>
          {descripcion && <p className="text-xs font-semibold text-gray-500 max-w-3xl">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  )
}

export function Termino({ t, children, abajo = false }: { t: TerminoId; children?: ReactNode; abajo?: boolean }) {
  const e = GLOSARIO[t]
  return (
    <span tabIndex={0} className="group/termino relative inline-flex items-baseline gap-0.5 cursor-help outline-none">
      <span className="border-b border-dotted border-current">{children ?? e.termino}</span>
      <span
        aria-hidden
        className="relative -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-gray-200 text-[9px] font-black text-gray-600 group-hover/termino:bg-blue-600 group-hover/termino:text-white"
      >
        ?
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-xl bg-gray-900 p-3 text-left text-xs font-medium normal-case tracking-normal text-gray-100 opacity-0 shadow-xl transition-opacity group-hover/termino:visible group-hover/termino:opacity-100 group-focus/termino:visible group-focus/termino:opacity-100 ${
          abajo ? "top-full mt-2" : "bottom-full mb-2"
        }`}
      >
        <span className="mb-0.5 block text-[13px] font-black text-white">{e.termino}</span>
        {e.definicion}
        {"donde" in e && e.donde ? <span className="mt-1.5 block font-bold text-blue-300">⚙️ {e.donde.etiqueta}</span> : null}
      </span>
    </span>
  )
}

export function Nota({ tipo = "info", children }: { tipo?: "info" | "atencion" | "peligro"; children: ReactNode }) {
  const estilos = {
    info: "bg-sky-50 border-sky-200 text-sky-900",
    atencion: "bg-amber-50 border-amber-200 text-amber-900",
    peligro: "bg-rose-50 border-rose-200 text-rose-900",
  }
  const icono = { info: "ℹ️", atencion: "⚠️", peligro: "⛔" }
  return (
    <p className={`flex gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${estilos[tipo]}`}>
      <span aria-hidden>{icono[tipo]}</span>
      <span>{children}</span>
    </p>
  )
}

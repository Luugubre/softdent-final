export function BotonExcel({ href, etiqueta = "Descargar Excel" }: { href: string; etiqueta?: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100 print:hidden"
    >
      <span aria-hidden>📊</span>
      {etiqueta}
    </a>
  )
}

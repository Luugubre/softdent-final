"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { EntradaGlosario } from "@/lib/glosario"
import type { EntradaGuia } from "@/lib/guia"

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function BuscadorAyuda({ guia, glosario }: { guia: EntradaGuia[]; glosario: EntradaGlosario[] }) {
  const [q, setQ] = useState("")
  const n = normalizar(q.trim())

  const guiaFiltrada = useMemo(() => (n ? guia.filter((g) => normalizar(`${g.que} ${g.donde} ${g.area}`).includes(n)) : guia), [guia, n])
  const glosarioFiltrado = useMemo(
    () => (n ? glosario.filter((g) => normalizar(`${g.termino} ${g.definicion} ${g.modulo}`).includes(n)) : glosario),
    [glosario, n]
  )

  const areas = [...new Set(guiaFiltrada.map((g) => g.area))]
  const modulos = [...new Set(glosarioFiltrado.map((g) => g.modulo))]

  return (
    <div className="space-y-6">
      <div className="sticky top-14 lg:top-0 z-20 -mx-2 bg-gray-50/95 px-2 py-2 backdrop-blur">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔎 Escribe lo que buscas: “horario”, “porcentaje”, “arqueo”, “bono”…"
          className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-3.5 text-base font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <section id="donde" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-extrabold text-gray-900">⚙️ ¿Dónde se cambia…?</h2>
        {guiaFiltrada.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">No hay configuraciones que coincidan con “{q}”.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {areas.map((a) => (
              <div key={a} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-gray-400">{a}</p>
                <ul className="divide-y divide-gray-100">
                  {guiaFiltrada
                    .filter((g) => g.area === a)
                    .map((g) => (
                      <li key={g.que}>
                        <Link href={g.href} className="flex flex-col gap-0.5 rounded-lg px-2 py-2 hover:bg-blue-50 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <span className="text-sm font-bold text-gray-800">{g.que}</span>
                          <span className="text-xs font-bold text-blue-700 sm:shrink-0 sm:text-right">{g.donde} →</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="glosario" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-extrabold text-gray-900">📖 ¿Qué significa…?</h2>
        {glosarioFiltrado.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">No hay términos que coincidan con “{q}”.</p>
        ) : (
          modulos.map((m) => (
            <div key={m} className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{m}</p>
              <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {glosarioFiltrado
                  .filter((g) => g.modulo === m)
                  .map((g) => (
                    <div key={g.termino} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <dt className="text-sm font-black text-gray-900">{g.termino}</dt>
                      <dd className="mt-1 text-sm text-gray-600">{g.definicion}</dd>
                      {g.donde && (
                        <dd className="mt-2">
                          <Link href={g.donde.href} className="text-xs font-bold text-blue-600 hover:underline">
                            ⚙️ {g.donde.etiqueta} →
                          </Link>
                        </dd>
                      )}
                    </div>
                  ))}
              </dl>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { cambiarAgendaOnlineDentista } from "@/app/agenda/web/actions"

type Dentista = { id: string; nombre_completo: string; especialidad: string | null; agenda_online: boolean }

export function DentistasAgendaOnline({ dentistas }: { dentistas: Dentista[] }) {
  const [lista, setLista] = useState(dentistas)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  const cambiar = (d: Dentista) =>
    startTransition(async () => {
      const r = await cambiarAgendaOnlineDentista(d.id, !d.agenda_online)
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) setLista((prev) => prev.map((x) => (x.id === d.id ? { ...x, agenda_online: !d.agenda_online } : x)))
    })

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Dentistas que se pueden reservar</h2>
        <p className="text-sm text-gray-500">
          Los pacientes solo ven a los dentistas marcados. Las horas salen de sus horarios de atención, horarios especiales y bloqueos.
        </p>
      </div>
      {aviso && <p className={`text-sm font-semibold ${aviso.ok ? "text-emerald-700" : "text-rose-700"}`}>{aviso.texto}</p>}
      {lista.length === 0 ? (
        <p className="text-sm text-gray-400">No hay dentistas activos.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lista.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{d.nombre_completo}</p>
                <p className="truncate text-xs text-gray-500">{d.especialidad || "Sin especialidad registrada"}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={d.agenda_online}
                aria-label={`Mostrar a ${d.nombre_completo} en la agenda online`}
                disabled={pendiente}
                onClick={() => cambiar(d)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${d.agenda_online ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${d.agenda_online ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

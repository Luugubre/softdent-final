"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { anularCitaWeb, validarCitaWeb } from "@/app/agenda/web/actions"
import { enlaceWhatsapp } from "@/lib/clinica"
import { formatearRut } from "@/lib/validaciones"
import type { CitaWeb } from "@/lib/agenda-web"

const ZONA = "America/Santiago"

function fechaHora(iso: string) {
  const d = new Date(iso)
  return {
    fecha: d.toLocaleDateString("es-CL", { timeZone: ZONA, weekday: "short", day: "2-digit", month: "short" }),
    hora: d.toLocaleTimeString("es-CL", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }),
  }
}

const ESTADO: Record<string, string> = {
  AGENDADA: "bg-amber-100 text-amber-800",
  CONFIRMADA: "bg-emerald-100 text-emerald-800",
  CANCELADA: "bg-gray-100 text-gray-500 line-through",
  REAGENDADA: "bg-gray-100 text-gray-500",
}

export function ListaCitasWeb({ citas, clinica }: { citas: CitaWeb[]; clinica: string }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [anulando, setAnulando] = useState<CitaWeb | null>(null)
  const [motivo, setMotivo] = useState("")

  const ejecutar = (fn: () => Promise<{ ok: boolean; mensaje: string }>, alTerminar?: () => void) =>
    startTransition(async () => {
      const r = await fn()
      setAviso({ ok: r.ok, texto: r.mensaje })
      if (r.ok) {
        alTerminar?.()
        router.refresh()
      }
    })

  const porValidar = citas.filter((c) => !c.validada && (c.estado === "AGENDADA" || c.estado === "CONFIRMADA"))

  if (citas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm font-semibold text-gray-500">
        No hay reservas web desde hoy en adelante.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        <strong className="text-gray-900">{porValidar.length}</strong> por validar · {citas.length} reservas web desde hoy. Al validar, la cita
        queda confirmada en la agenda.
      </p>
      {aviso && <p className={`text-sm font-semibold ${aviso.ok ? "text-emerald-700" : "text-rose-700"}`}>{aviso.texto}</p>}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Dentista</th>
              <th className="px-4 py-3">Comentario</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {citas.map((c) => {
              const { fecha, hora } = fechaHora(c.inicio)
              const vigente = c.estado === "AGENDADA" || c.estado === "CONFIRMADA"
              const whatsapp = enlaceWhatsapp(
                c.paciente_telefono,
                `Hola ${c.paciente_nombre.split(" ")[0]}, te escribimos de ${clinica}. Recibimos tu reserva para el ${fecha} a las ${hora} con ${c.profesional_nombre}. ¿Nos confirmas tu asistencia?`
              )
              return (
                <tr key={c.id} className={`border-b border-gray-100 align-top ${!c.validada && vigente ? "bg-amber-50/40" : ""}`}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-semibold capitalize text-gray-900">{fecha}</p>
                    <p className="text-gray-500">{hora}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/pacientes/${c.paciente_id}`} className="font-semibold text-blue-700 hover:underline">
                      {c.paciente_nombre}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {/^\d{7,8}-[\dK]$/.test(c.paciente_rut) ? formatearRut(c.paciente_rut) : c.paciente_rut}
                      {c.paciente_telefono ? ` · ${c.paciente_telefono}` : ""}
                    </p>
                    {c.paciente_email && <p className="text-xs text-gray-400">{c.paciente_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.profesional_nombre}</td>
                  <td className="max-w-56 px-4 py-3 text-xs text-gray-600">{c.motivo?.replace(/^AGENDA ONLINE:?\s*/, "") || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO[c.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {c.estado.replace("_", " ").toLowerCase()}
                    </span>
                    {vigente && (
                      <p className={`mt-1 text-xs font-semibold ${c.validada ? "text-emerald-700" : "text-amber-700"}`}>
                        {c.validada ? "Validada" : "Por validar"}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {whatsapp && vigente && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          WhatsApp
                        </a>
                      )}
                      {vigente && !c.validada && (
                        <button
                          type="button"
                          disabled={pendiente}
                          onClick={() => ejecutar(() => validarCitaWeb(c.id))}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Validar
                        </button>
                      )}
                      {vigente && (
                        <button
                          type="button"
                          disabled={pendiente}
                          onClick={() => {
                            setMotivo("")
                            setAnulando(c)
                          }}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {anulando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
          <button type="button" aria-label="Cerrar" onClick={() => setAnulando(null)} className="absolute inset-0 cursor-default" />
          <form
            className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault()
              ejecutar(() => anularCitaWeb(anulando.id, motivo), () => setAnulando(null))
            }}
          >
            <h2 className="text-base font-bold text-gray-900">Anular reserva de {anulando.paciente_nombre}</h2>
            <label htmlFor="motivo-anulacion-web" className="block text-xs font-semibold text-gray-600">
              Motivo (queda en el historial de la cita)
            </label>
            <textarea
              id="motivo-anulacion-web"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              required
              minLength={3}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              placeholder="Ej: el paciente no respondió, hora duplicada…"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAnulando(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
                Volver
              </button>
              <button type="submit" disabled={pendiente} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                Anular reserva
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { anularDocumento } from "@/app/documentos/actions"
import { TIPOS_DOCUMENTO, type DocumentoClinico } from "@/lib/documentos-tipos"

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })

export function TablaDocumentos({
  documentos,
  usuarioId,
  esAdmin,
  puedeAnular,
}: {
  documentos: DocumentoClinico[]
  usuarioId: string
  esAdmin: boolean
  puedeAnular: boolean
}) {
  const [anulando, setAnulando] = useState<DocumentoClinico | null>(null)

  if (documentos.length === 0) {
    return <p className="py-10 text-center text-sm font-medium text-gray-400">Este paciente aún no tiene documentos emitidos.</p>
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left text-xs text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Profesional</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documentos.map((d) => (
              <tr key={d.id} className={d.estado === "ANULADO" ? "bg-gray-50/60 text-gray-400" : "hover:bg-gray-50/80"}>
                <td className="px-4 py-3 font-mono font-bold">#{d.folio}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fecha(d.created_at)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-blue-50 border border-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    {TIPOS_DOCUMENTO[d.tipo]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold text-gray-900">{d.titulo}</div>
                  {d.destinatario && <div className="text-[11px] text-gray-500">Para: {d.destinatario}</div>}
                </td>
                <td className="px-4 py-3 font-semibold">{d.profesional_nombre}</td>
                <td className="px-4 py-3">
                  {d.estado === "EMITIDO" ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">Emitido</span>
                  ) : (
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-black text-rose-800" title={d.motivo_anulacion ?? ""}>
                      Anulado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <a
                      href={`/documentos/${d.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      🖨️ Imprimir
                    </a>
                    {puedeAnular && d.estado === "EMITIDO" && (esAdmin || d.profesional_id === usuarioId) && (
                      <button
                        type="button"
                        onClick={() => setAnulando(d)}
                        className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                      >
                        Anular
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anulando && <ModalAnular documento={anulando} onClose={() => setAnulando(null)} />}
    </>
  )
}

function ModalAnular({ documento, onClose }: { documento: DocumentoClinico; onClose: () => void }) {
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState("")
  const [pendiente, startTransition] = useTransition()

  function anular() {
    setError("")
    startTransition(async () => {
      const r = await anularDocumento(documento.id, motivo)
      if (r.error) setError(r.error)
      else onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h3 className="text-base font-extrabold text-gray-900">Anular documento folio #{documento.folio}</h3>
        <p className="text-xs text-gray-500">El documento queda en el historial marcado como anulado y puedes emitir uno nuevo corregido.</p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Motivo de la anulación"
          className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-medium"
        />
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700">
            Cancelar
          </button>
          <button
            type="button"
            onClick={anular}
            disabled={pendiente}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {pendiente ? "Anulando…" : "Anular"}
          </button>
        </div>
      </div>
    </div>
  )
}

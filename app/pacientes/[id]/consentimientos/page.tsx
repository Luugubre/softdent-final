import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"

const ESTADO: Record<string, { texto: string; clase: string }> = {
  BORRADOR: { texto: "Borrador", clase: "bg-slate-100 text-slate-700" },
  PENDIENTE_FIRMA: { texto: "Pendiente de firma", clase: "bg-amber-100 text-amber-800" },
  FIRMADO: { texto: "Firmado", clase: "bg-emerald-100 text-emerald-800" },
  REVOCADO: { texto: "Revocado", clase: "bg-rose-100 text-rose-800" },
}

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-CL", {
        timeZone: "America/Santiago",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—"

export default async function ConsentimientosPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("clinico.ver")
  const { id } = await params
  const { data } = await getSupabase()
    .from("consentimientos_paciente")
    .select(
      "id, folio, titulo, estado, created_at, firmado_at, firmante_nombre, firmante_es_apoderado, motivo_revocacion, revocado_at, pdf_base64, doctor:perfiles!consentimientos_paciente_doctor_id_fkey(nombre_completo)"
    )
    .eq("paciente_id", id)
    .order("created_at", { ascending: false })

  const consentimientos = (data ?? []).map((c) => ({
    ...c,
    tienePdf: !!c.pdf_base64,
    doctor: (Array.isArray(c.doctor) ? c.doctor[0] : c.doctor) as { nombre_completo: string } | null,
  }))

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">✍️ Consentimientos informados</h2>
          <p className="text-xs font-medium text-gray-500">
            Consentimientos enviados, firmados y revocados de este paciente. Cada firma queda en la auditoría.
          </p>
        </div>
        {puede(usuario.rol, "consentimientos.gestionar") && (
          <Link
            href="/citas-consentimiento"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
          >
            + Enviar consentimiento
          </Link>
        )}
      </div>

      {consentimientos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm font-semibold text-gray-500">
          Este paciente no tiene consentimientos registrados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="py-2 pr-3">Folio</th>
                <th className="py-2 pr-3">Documento</th>
                <th className="py-2 pr-3">Profesional</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Creado</th>
                <th className="py-2 pr-3">Firma</th>
                <th className="py-2 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {consentimientos.map((c) => {
                const estado = ESTADO[c.estado] ?? { texto: c.estado, clase: "bg-slate-100 text-slate-700" }
                return (
                  <tr key={c.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 font-bold text-gray-700">#{c.folio}</td>
                    <td className="py-2 pr-3 font-semibold text-gray-900">{c.titulo}</td>
                    <td className="py-2 pr-3 text-gray-600">{c.doctor?.nombre_completo ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${estado.clase}`}>{estado.texto}</span>
                      {c.estado === "REVOCADO" && c.motivo_revocacion && (
                        <p className="mt-1 text-xs text-rose-700">
                          {fecha(c.revocado_at)} · {c.motivo_revocacion}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600">{fecha(c.created_at)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                      {c.firmado_at ? (
                        <>
                          {fecha(c.firmado_at)}
                          <br />
                          <span className="text-xs">
                            {c.firmante_nombre}
                            {c.firmante_es_apoderado ? " (apoderado)" : ""}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {c.tienePdf ? (
                        <a
                          href={`/consentimientos/${c.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whitespace-nowrap rounded-lg border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50"
                        >
                          Ver PDF
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

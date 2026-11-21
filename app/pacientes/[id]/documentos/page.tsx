import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { listarDocumentos } from "@/lib/documentos"
import { TablaDocumentos } from "@/components/documentos/TablaDocumentos"

export default async function DocumentosPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("clinico.ver")
  const { id } = await params
  const documentos = await listarDocumentos(id)
  const puedeEmitir = puede(usuario.rol, "documentos.emitir")

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">📑 Documentos clínicos</h2>
          <p className="text-xs font-medium text-gray-500">Certificados, indicaciones y derivaciones emitidos con la firma del profesional.</p>
        </div>
        {puedeEmitir && (
          <Link
            href={`/pacientes/${id}/documentos/nuevo`}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
          >
            + Nuevo documento
          </Link>
        )}
      </div>
      <TablaDocumentos
        documentos={documentos}
        usuarioId={usuario.id}
        esAdmin={usuario.rol === "ADMINISTRADOR"}
        puedeAnular={puedeEmitir}
      />
    </section>
  )
}

import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerHallazgos, obtenerItems, obtenerTratamientos } from "@/lib/tratamientos"
import { obtenerPaciente } from "@/lib/paciente"
import { Odontograma } from "@/components/odontograma/Odontograma"
import { ListaTratamientos } from "@/components/tratamientos/ListaTratamientos"
import { obtenerCatalogo } from "@/lib/catalogo"

export default async function OdontogramaGeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("clinico.ver")
  const { id } = await params

  const [paciente, hallazgos, { items, avances }, tratamientos] = await Promise.all([
    obtenerPaciente(id),
    obtenerHallazgos(id),
    obtenerItems(id),
    obtenerTratamientos(id),
  ])

  const activo = !!paciente?.activo
  const activos = tratamientos.filter((t) => t.estado === "ACTIVO")
  const puedeAgregar = activo && puede(usuario.rol, "presupuestos.gestionar")

  const catalogo = puedeAgregar ? await obtenerCatalogo([...new Set(activos.map((t) => t.arancel_id))].sort().join(",")) : null

  return (
    <div className="space-y-5">
      {!activo && (
        <p className="rounded-xl bg-gray-100 border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-600">
          Paciente deshabilitado: el odontograma está en modo solo lectura.
        </p>
      )}

      <Odontograma
        pacienteId={id}
        hallazgos={hallazgos}
        items={items.filter((i) => i.presupuesto?.estado !== "ANULADO")}
        avances={avances}
        tratamientos={activos.map((t) => ({ id: t.id, numero: t.numero, nombre: t.nombre, arancel_id: t.arancel_id }))}
        catalogo={catalogo}
        permisos={{
          editar: activo && puede(usuario.rol, "odontograma.editar"),
          agregar: puedeAgregar,
        }}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900">Tratamientos del paciente</h2>
          <Link href={`/pacientes/${id}/tratamientos`} className="text-sm font-bold text-blue-600 hover:underline">
            Ver todos / crear →
          </Link>
        </div>
        <ListaTratamientos pacienteId={id} tratamientos={tratamientos} compacta />
      </section>
    </div>
  )
}

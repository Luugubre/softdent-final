import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerHallazgos, obtenerItems, obtenerTratamientos } from "@/lib/tratamientos"
import { obtenerPaciente } from "@/lib/paciente"
import { Odontograma } from "@/components/odontograma/Odontograma"
import { ListaTratamientos } from "@/components/tratamientos/ListaTratamientos"

// ODONTOGRAMA GENERAL: reúne los hallazgos del paciente y las prestaciones de TODOS sus tratamientos
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
        tratamientos={activos.map((t) => ({ id: t.id, numero: t.numero, nombre: t.nombre }))}
        permisos={{
          editar: activo && puede(usuario.rol, "odontograma.editar"),
          agregar: activo && puede(usuario.rol, "presupuestos.gestionar"),
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

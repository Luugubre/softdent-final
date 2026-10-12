import Link from "next/link"
import { notFound } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerFases, obtenerHallazgos, obtenerItems, obtenerTratamiento } from "@/lib/tratamientos"
import { obtenerPaciente } from "@/lib/paciente"
import { formatearFechaHora } from "@/lib/formato"
import { Odontograma } from "@/components/odontograma/Odontograma"
import { PlanTratamiento } from "@/components/odontograma/PlanTratamiento"
import { AccionesTratamiento } from "@/components/tratamientos/AccionesTratamiento"
import { FasesTratamiento } from "@/components/tratamientos/FasesTratamiento"
import { ESTADO_TRATAMIENTO } from "@/types/tratamiento"
import { obtenerCatalogo } from "@/lib/catalogo"

export default async function TratamientoPage({
  params,
}: {
  params: Promise<{ id: string; tratamientoId: string }>
}) {
  const usuario = await requerirPermiso("pacientes.ver")
  const { id, tratamientoId } = await params

  const tratamiento = await obtenerTratamiento(id, tratamientoId)
  if (!tratamiento) notFound()

  const verClinico = puede(usuario.rol, "clinico.ver")
  const [paciente, hallazgos, { items, avances }, fases] = await Promise.all([
    obtenerPaciente(id),
    verClinico ? obtenerHallazgos(id) : Promise.resolve([]),
    obtenerItems(id, tratamientoId),
    obtenerFases(tratamientoId),
  ])

  const editable = !!paciente?.activo && tratamiento.estado === "ACTIVO"
  const gestionar = editable && puede(usuario.rol, "presupuestos.gestionar")
  const organizar = !!paciente?.activo && tratamiento.estado !== "ANULADO" && puede(usuario.rol, "presupuestos.gestionar")
  const estado = ESTADO_TRATAMIENTO[tratamiento.estado]
  const opcion = { id: tratamiento.id, numero: tratamiento.numero, nombre: tratamiento.nombre, arancel_id: tratamiento.arancel_id }

  const catalogo = verClinico && gestionar ? await obtenerCatalogo(tratamiento.arancel_id) : null

  return (
    <div className="space-y-5">
      <Link href={`/pacientes/${id}/tratamientos`} className="text-sm font-bold text-blue-600 hover:underline">
        ← Todos los tratamientos
      </Link>

      <header className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Tratamiento N° {tratamiento.numero}</p>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-gray-900">{tratamiento.nombre}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${estado.estilo}`}>{estado.etiqueta}</span>
          </div>
          <p className="text-sm font-medium text-gray-600">
            {tratamiento.profesional ? `Dr.(a) ${tratamiento.profesional.nombre_completo} · ` : ""}
            {tratamiento.arancel?.nombre} · Creado el {formatearFechaHora(tratamiento.created_at)}
          </p>
          {tratamiento.descripcion && <p className="text-sm text-gray-600">{tratamiento.descripcion}</p>}
          {tratamiento.motivo_anulacion && (
            <p className="text-sm font-semibold text-gray-500">Anulado: {tratamiento.motivo_anulacion}</p>
          )}
          {tratamiento.finalizado_en && (
            <p className="text-sm font-semibold text-emerald-700">Finalizado el {formatearFechaHora(tratamiento.finalizado_en)}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href={`/pacientes/${id}/tratamientos/${tratamiento.id}/imprimir`}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            🖨 Imprimir presupuesto
          </Link>
          {gestionar && <AccionesTratamiento pacienteId={id} tratamientoId={tratamiento.id} />}
        </div>
      </header>

      {verClinico && (
        <Odontograma
          pacienteId={id}
          hallazgos={hallazgos}
          items={items}
          avances={avances}
          tratamientoFijo={opcion}
          catalogo={catalogo}
          permisos={{
            editar: !!paciente?.activo && puede(usuario.rol, "odontograma.editar"),
            agregar: gestionar,
          }}
        />
      )}

      {(organizar || fases.length > 0) && (
        <FasesTratamiento pacienteId={id} tratamientoId={tratamiento.id} fases={fases} items={items} puedeEditar={organizar} />
      )}

      <PlanTratamiento
        pacienteId={id}
        items={items}
        avances={avances}
        plan={{ nombre: tratamiento.nombre, arancel: tratamiento.arancel }}
        puedeEvolucionar={editable && puede(usuario.rol, "tratamientos.evolucionar")}
        puedeAnular={gestionar}
        fases={fases}
        puedeOrganizar={organizar}
      />
    </div>
  )
}

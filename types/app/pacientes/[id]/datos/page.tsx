import { notFound } from "next/navigation"
import { getSupabase } from "@/lib/supabase"
import { obtenerPaciente, obtenerResumenPaciente, type PacienteResumen } from "@/lib/paciente"
import { DatosPaciente } from "@/components/ficha/DatosPaciente"
import { GrupoFamiliar } from "@/components/ficha/GrupoFamiliar"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"

export default async function PerfilPaciente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("pacientes.ver")
  const puedeEditar = puede(usuario.rol, "pacientes.editar")
  const { id } = await params
  const paciente = await obtenerPaciente(id)
  if (!paciente) notFound()

  const [{ data: cargas }, titular] = await Promise.all([
    getSupabase()
      .from("pacientes")
      .select("id, rut, nombres, apellidos, fecha_nacimiento, activo")
      .eq("titular_id", id)
      .order("nombres"),
    paciente.titular_id ? obtenerResumenPaciente(paciente.titular_id) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-5">
      <DatosPaciente paciente={paciente} puedeEditar={puedeEditar} />
      <GrupoFamiliar
        pacienteId={id}
        titular={titular}
        cargas={(cargas ?? []) as PacienteResumen[]}
        puedeEditar={puedeEditar}
      />
    </div>
  )
}

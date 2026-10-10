import { obtenerAntecedentes } from "@/lib/paciente"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { AntecedentesPaciente } from "@/components/ficha/AntecedentesPaciente"

export default async function AntecedentesPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("clinico.ver")
  const { id } = await params
  const antecedentes = await obtenerAntecedentes(id)
  return (
    <AntecedentesPaciente
      pacienteId={id}
      antecedentes={antecedentes}
      puedeRegistrar={puede(usuario.rol, "antecedentes.registrar")}
    />
  )
}

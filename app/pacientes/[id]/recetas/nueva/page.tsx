import { notFound } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { obtenerAntecedentes, obtenerPaciente } from "@/lib/paciente"
import { CATALOGO_MEDICAMENTOS, dentistasEmisores } from "@/lib/recetas"
import FormNuevaReceta from "@/app/recetas/nueva/FormNuevaReceta"

export default async function NuevaRecetaPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("recetas.emitir")
  const { id } = await params

  const [paciente, antecedentes, dentistas] = await Promise.all([obtenerPaciente(id), obtenerAntecedentes(id), dentistasEmisores()])
  if (!paciente) notFound()

  const pacientes = [
    {
      id: String(paciente.id),
      nombre_completo: `${paciente.nombres ?? ""} ${paciente.apellidos ?? ""}`.trim(),
      rut: paciente.rut || "",
      antecedentes: antecedentes
        .filter((a) => a.vigente)
        .map((a) => ({ categoria: a.categoria, detalle: a.contenido })),
    },
  ]

  return (
    <FormNuevaReceta
      catalogo={CATALOGO_MEDICAMENTOS}
      pacientes={pacientes}
      dentistas={dentistas}
      rolUsuario={usuario.rol}
      pacienteFijoId={id}
    />
  )
}

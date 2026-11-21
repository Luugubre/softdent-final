import { notFound } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { obtenerPaciente } from "@/lib/paciente"
import { plantillasDocumento } from "@/lib/documentos"
import { calcularEdad, formatearRut } from "@/lib/validaciones"
import { NOMBRE_CLINICA } from "@/lib/clinica"
import { FormDocumento } from "@/components/documentos/FormDocumento"

export default async function NuevoDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("documentos.emitir")
  const { id } = await params
  const [paciente, plantillas] = await Promise.all([obtenerPaciente(id), plantillasDocumento()])
  if (!paciente) notFound()

  const edad = calcularEdad(paciente.fecha_nacimiento)
  return (
    <FormDocumento
      pacienteId={id}
      plantillas={plantillas}
      variables={{
        paciente: {
          nombre: `${paciente.nombres} ${paciente.apellidos}`,
          rut: paciente.extranjero ? paciente.rut : formatearRut(paciente.rut),
          edad: edad ?? "",
        },
        profesional: { nombre: usuario.nombre_completo, registro: usuario.registro_profesional ?? "" },
        clinica: { nombre: NOMBRE_CLINICA },
        fecha: new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" }),
      }}
      sinFirma={usuario.rol === "DENTISTA" && !usuario.firma_svg}
    />
  )
}

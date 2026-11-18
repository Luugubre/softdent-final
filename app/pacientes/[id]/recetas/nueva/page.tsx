import { requerirPermiso } from "@/lib/auth"
import { crearClienteAuth } from "@/lib/supabase-auth"
import { obtenerAntecedentes, obtenerPaciente } from "@/lib/paciente"
import FormNuevaReceta from "@/app/recetas/nueva/FormNuevaReceta"

export default async function NuevaRecetaPacientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const usuario = await requerirPermiso("clinico.ver")
  const { id } = await params
  const supabase = await crearClienteAuth()

  const [paciente, antecedentes, { data: dentistasRaw }] = await Promise.all([
    obtenerPaciente(id),
    obtenerAntecedentes(id),
    supabase.from("perfiles").select("id, nombre_completo, rut, especialidad, rol"),
  ])

  const dentistasFiltrados = (dentistasRaw ?? []).filter(
    (d) => d.rol && String(d.rol).toUpperCase().includes("DENTISTA")
  )

  const pacienteFormateado = paciente
    ? [
        {
          id: String(paciente.id),
          nombre_completo: `${paciente.nombres ?? ""} ${paciente.apellidos ?? ""}`.trim(),
          rut: paciente.rut || "",
          antecedentes: antecedentes
            .filter((a) => a.vigente)
            .map((a) => ({ categoria: a.categoria, detalle: a.contenido })),
        },
      ]
    : []

  const dentistasFormateados = dentistasFiltrados.map((d) => ({
    id: String(d.id),
    nombre_completo: d.nombre_completo || "Dr(a). Sin Nombre",
    rut: d.rut || "",
    especialidad: d.especialidad || "Odontología General",
  }))

  const catalogoMedicamentos = [
    { id: "1", medicamento: "Amoxicilina", presentacion: "Comprimidos 875 mg", dosis: "1 comprimido", frecuencia: "Cada 12 horas", duracion: "7 días", via: "Oral", cantidad: "1 caja" },
    { id: "2", medicamento: "Ibuprofeno", presentacion: "Comprimidos 600 mg", dosis: "1 comprimido", frecuencia: "Cada 8 horas", duracion: "3 días", via: "Oral", cantidad: "1 caja" },
    { id: "3", medicamento: "Paracetamol", presentacion: "Comprimidos 500 mg", dosis: "1 comprimido", frecuencia: "Cada 8 horas", duracion: "3 días", via: "Oral", cantidad: "1 caja" },
    { id: "4", medicamento: "Ketorolaco", presentacion: "Sublingual 10 mg", dosis: "1 comprimido", frecuencia: "Cada 8 horas", duracion: "2 días", via: "Sublingual", cantidad: "1 caja" },
    { id: "5", medicamento: "Cloranfenicol", presentacion: "Solución 0.5%", dosis: "2 gotas", frecuencia: "Cada 6 horas", duracion: "5 días", via: "Oftálmica/Local", cantidad: "1 frasco" },
  ]

  return (
    <FormNuevaReceta
      catalogo={catalogoMedicamentos}
      pacientes={pacienteFormateado}
      dentistas={dentistasFormateados}
      rolUsuario={usuario.rol}
      pacienteFijoId={id}
    />
  )
}
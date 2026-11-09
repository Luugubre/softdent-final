import { requerirUsuario } from "@/lib/auth"
import { crearClienteAuth } from "@/lib/supabase-auth"
import FormNuevaReceta from "./FormNuevaReceta"

export default async function NuevaRecetaPage() {
  const usuario = await requerirUsuario()
  const supabase = await crearClienteAuth()

  // 1. Obtener lista de pacientes (sin forzar relación de antecedentes para evitar fallos de RLS / FK)
  const { data: pacientesRaw, error: errPacientes } = await supabase
    .from("pacientes")
    .select("id, nombres, apellidos, rut")

  if (errPacientes) {
    console.error("Error al cargar pacientes:", errPacientes)
  }

  // 2. Obtener antecedentes de pacientes si existen
  const { data: antecedentesRaw } = await supabase
    .from("antecedentes")
    .select("paciente_id, categoria, detalle")

  // 3. Obtener lista de perfiles para dentistas (sin filtro estricto de 'activo=true' por si es null)
  const { data: dentistasRaw, error: errDentistas } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, rut, especialidad, rol")

  if (errDentistas) {
    console.error("Error al cargar dentistas:", errDentistas)
  }

  // Filtrar dentistas (tolerante a mayúsculas o minúsculas)
  const dentistasFiltrados = (dentistasRaw ?? []).filter(
    (d) => d.rol && String(d.rol).toUpperCase().includes("DENTISTA")
  )

  const pacientesFormateados = (pacientesRaw ?? []).map((p) => {
    const misAntecedentes = (antecedentesRaw ?? [])
      .filter((a) => a.paciente_id === p.id)
      .map((a) => ({ categoria: a.categoria, detalle: a.detalle }))

    return {
      id: String(p.id),
      nombre_completo: `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim(),
      rut: p.rut || "",
      antecedentes: misAntecedentes,
    }
  })

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
      pacientes={pacientesFormateados}
      dentistas={dentistasFormateados}
      rolUsuario={usuario.rol}
    />
  )
}
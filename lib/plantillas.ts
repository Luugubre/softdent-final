export type VariablesDocumento = {
  paciente: {
    nombre: string
    rut: string
    edad: string | number
  }
  profesional: {
    nombre: string
    registro: string
  }
  clinica: {
    nombre: string
  }
  fecha: string
  prestaciones?: string
}

export const VARIABLES_DISPONIBLES = [
  { clave: "{{paciente.nombre}}", descripcion: "Nombre completo del paciente" },
  { clave: "{{paciente.rut}}", descripcion: "RUT o Identificación del paciente" },
  { clave: "{{paciente.edad}}", descripcion: "Edad actual del paciente" },
  { clave: "{{fecha}}", descripcion: "Fecha de emisión del documento" },
  { clave: "{{profesional.nombre}}", descripcion: "Nombre del Cirujano Dentista" },
  { clave: "{{profesional.registro}}", descripcion: "N° de Registro Superintendencia/Profesional" },
  { clave: "{{clinica.nombre}}", descripcion: "Nombre de la clínica dental" },
  { clave: "{{prestaciones}}", descripcion: "Detalle de los procedimientos o prestaciones" },
]

/**
 * Reemplaza todas las etiquetas {{variable}} en el contenido de la plantilla
 */
export function procesarPlantilla(contenido: string, datos: VariablesDocumento): string {
  let resultado = contenido

  resultado = resultado.replace(/\{\{paciente\.nombre\}\}/g, datos.paciente.nombre || "—")
  resultado = resultado.replace(/\{\{paciente\.rut\}\}/g, datos.paciente.rut || "—")
  resultado = resultado.replace(/\{\{paciente\.edad\}\}/g, String(datos.paciente.edad || "—"))
  resultado = resultado.replace(/\{\{fecha\}\}/g, datos.fecha || new Date().toLocaleDateString("es-CL"))
  resultado = resultado.replace(/\{\{profesional\.nombre\}\}/g, datos.profesional.nombre || "—")
  resultado = resultado.replace(/\{\{profesional\.registro\}\}/g, datos.profesional.registro || "—")
  resultado = resultado.replace(/\{\{clinica\.nombre\}\}/g, datos.clinica.nombre || "Clínica Odontológica SoftDent")
  resultado = resultado.replace(/\{\{prestaciones\}\}/g, datos.prestaciones || "—")

  return resultado
}
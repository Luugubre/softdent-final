export type Paciente = {
  id: string
  numero_ficha: number
  rut: string
  extranjero: boolean
  nombres: string
  apellidos: string
  nombre_social: string | null
  fecha_nacimiento: string // "YYYY-MM-DD"
  sexo: "FEMENINO" | "MASCULINO" | "INTERSEXUAL" | "NO_INFORMA" | null
  genero: string | null
  telefono: string | null
  telefono_fijo: string | null
  email: string | null
  direccion: string | null
  comuna: string | null
  ciudad: string | null
  prevision: string
  actividad_profesion: string | null
  empleador: string | null
  referencia: string | null
  observaciones: string | null
  apoderado_nombre: string | null
  apoderado_rut: string | null
  apoderado_telefono: string | null
  titular_id: string | null
  activo: boolean
  motivo_deshabilitado: string | null
  created_at: string
  updated_at: string
}

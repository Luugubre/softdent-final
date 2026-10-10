import type { Rol } from "@/lib/permisos"

export type Perfil = {
  id: string
  nombre_completo: string
  rut: string | null
  email: string
  rol: Rol
  especialidad: string | null
  registro_profesional: string | null
  porcentaje_liquidacion: number | null
  activo: boolean
  created_at: string
  updated_at: string
}

"use server"

import { headers } from "next/headers"
import { obtenerUsuarioActual } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SECCIONES: [RegExp, string][] = [
  [/^$/, "Resumen"],
  [/^\/datos$/, "Datos personales"],
  [/^\/evoluciones$/, "Evoluciones"],
  [/^\/antecedentes$/, "Antecedentes médicos"],
  [/^\/rx-documentos$/, "RX y multimedia"],
  [/^\/odontograma$/, "Odontograma"],
  [/^\/tratamientos(\/.*)?$/, "Tratamientos"],
  [/^\/pagos(\/.*)?$/, "Pagos"],
  [/^\/recetas(\/.*)?$/, "Recetario"],
  [/^\/documentos(\/.*)?$/, "Documentos clínicos"],
  [/^\/consentimientos$/, "Consentimientos"],
]

export async function registrarAccesoFicha(pacienteId: string, subruta: string) {
  const usuario = await obtenerUsuarioActual()
  if (!usuario || !UUID.test(pacienteId)) return
  const seccion = SECCIONES.find(([re]) => re.test(subruta))?.[1]
  if (!seccion) return

  const h = await headers()
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null

  await getSupabase().rpc("registrar_acceso_ficha", {
    p_usuario: usuario.id,
    p_paciente: pacienteId,
    p_seccion: seccion,
    p_ip: ip,
  })
}

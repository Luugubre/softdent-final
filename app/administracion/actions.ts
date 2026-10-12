"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { CATALOGOS, TIPOS_PREVISION, type TablaCatalogo } from "@/types/admin"

type Resultado = { ok: boolean; mensaje: string }

const mensajeBD = (e: { message?: string } | null, d: string) =>
  e?.message && !e.message.includes("violates") && !e.message.includes("schema cache") ? e.message : d

function refrescar() {
  revalidatePath("/", "layout")
}

export async function guardarCatalogo(
  tabla: TablaCatalogo,
  datos: { id?: string; nombre: string; activo?: boolean; descripcion?: string; tipo?: string; duracion_min?: number }
): Promise<Resultado> {
  const usuario = await autorizar("administracion.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!(tabla in CATALOGOS)) return { ok: false, mensaje: "Catálogo no válido." }
  if (!datos.nombre.trim()) return { ok: false, mensaje: "El nombre es obligatorio." }

  const extra: Record<string, unknown> = {}
  if (tabla === "previsiones" && datos.tipo) {
    if (!(TIPOS_PREVISION as readonly string[]).includes(datos.tipo)) return { ok: false, mensaje: "Tipo de previsión no válido." }
    extra.tipo = datos.tipo
  }
  if (tabla === "tipos_atencion" && datos.duracion_min !== undefined) {
    const d = Math.round(Number(datos.duracion_min))
    if (!(d >= 5 && d <= 480)) return { ok: false, mensaje: "La duración debe estar entre 5 y 480 minutos." }
    extra.duracion_min = d
  }

  const { error } = await getSupabase().rpc("guardar_catalogo", {
    p_tabla: tabla,
    p_id: datos.id ?? null,
    p_nombre: datos.nombre,
    p_usuario: usuario.id,
    p_descripcion: datos.descripcion ?? null,
    p_activo: datos.activo ?? true,
    p_extra: extra,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo guardar.") }
  refrescar()
  return { ok: true, mensaje: datos.id ? "Cambios guardados." : "Registro creado." }
}

export async function guardarMetodoPago(datos: {
  codigo: string
  nombre: string
  es_efectivo: boolean
  pide_referencia: boolean
  registra_en_caja: boolean
  activo: boolean
  nuevo: boolean
}): Promise<Resultado> {
  const usuario = await autorizar("administracion.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const codigo = datos.codigo.trim().toUpperCase().replace(/\s+/g, "_")
  if (datos.nuevo && !/^[A-Z_]{3,30}$/.test(codigo)) return { ok: false, mensaje: "El código debe tener solo letras y guion bajo (ej: CHEQUE)." }

  const { error } = await getSupabase().rpc("guardar_metodo_pago", {
    p_codigo: codigo,
    p_nombre: datos.nombre,
    p_es_efectivo: datos.es_efectivo,
    p_pide_referencia: datos.pide_referencia,
    p_registra_en_caja: datos.registra_en_caja,
    p_activo: datos.activo,
    p_usuario: usuario.id,
    p_nuevo: datos.nuevo,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo guardar el método de pago.") }
  refrescar()
  return { ok: true, mensaje: datos.nuevo ? "Método de pago creado." : "Método de pago actualizado." }
}

export async function actualizarParametro(clave: string, valor: string): Promise<Resultado> {
  const usuario = await autorizar("administracion.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("actualizar_parametro", { p_clave: clave, p_valor: valor, p_usuario: usuario.id })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo guardar el parámetro.") }
  refrescar()
  return { ok: true, mensaje: "Parámetro guardado." }
}

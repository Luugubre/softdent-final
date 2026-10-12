"use server"

import { revalidatePath } from "next/cache"
import { getSupabase } from "@/lib/supabase"
import { autorizar } from "@/lib/auth"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"

type Resultado = { ok: boolean; mensaje: string; id?: string }

const UUID = /^[0-9a-f-]{36}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const mensajeBD = (e: { message?: string } | null, d: string) =>
  e?.message && !e.message.includes("violates") && !e.message.includes("schema cache") ? e.message : d
const entero = (v: string | number) => Math.round(Number(String(v).replace(/[^\d-]/g, "")))
const limpiar = (t: string) => t.trim().replace(/[,()%*\\"']/g, " ")

function refrescar(pacienteId?: string) {
  revalidatePath("/fonasa-convenios")
  if (pacienteId) revalidatePath(`/pacientes/${pacienteId}`, "layout")
}

// ---------------------------------------------------------------------
// Búsquedas
// ---------------------------------------------------------------------
export async function buscarPacientesFonasa(texto: string) {
  if (!(await autorizar("fonasa.gestionar"))) return []
  const q = limpiar(texto)
  if (q.length < 2) return []
  const grupos = q
    .split(/\s+/)
    .slice(0, 3)
    .map((p) => `or(nombres.ilike.%${p}%,apellidos.ilike.%${p}%)`)
  const filtro = /\d/.test(q)
    ? `rut.ilike.%${q.replace(/\./g, "").split("-")[0]}%`
    : grupos.length === 1
      ? grupos[0].slice(3, -1)
      : `and(${grupos.join(",")})`
  const { data } = await getSupabase().from("pacientes").select("id, nombres, apellidos, rut, prevision").eq("activo", true).or(filtro).limit(8)
  return (data ?? []) as { id: string; nombres: string; apellidos: string; rut: string; prevision: string }[]
}

/** Prestaciones con código FONASA */
export async function buscarPrestacionesFonasa(texto: string) {
  if (!(await autorizar("fonasa.gestionar"))) return []
  const q = limpiar(texto)
  if (q.length < 2) return []
  const { data } = await getSupabase()
    .from("prestaciones")
    .select("id, nombre, codigo_fonasa, codigo_interno")
    .eq("activo", true)
    .not("codigo_fonasa", "is", null)
    .or(`nombre.ilike.%${q}%,codigo_fonasa.ilike.%${q}%`)
    .limit(8)
  return (data ?? []) as { id: string; nombre: string; codigo_fonasa: string; codigo_interno: string }[]
}

/** Prestaciones del plan del paciente con saldo (para aplicar el bono) */
export async function itemsBonificables(pacienteId: string, prestacionId: string) {
  if (!(await autorizar("fonasa.gestionar")) || !UUID.test(pacienteId) || !UUID.test(prestacionId)) return []
  const { data } = await getSupabase()
    .from("presupuesto_items")
    .select("id, pieza, precio, abonado, presupuesto:presupuestos(numero, nombre, estado)")
    .eq("paciente_id", pacienteId)
    .eq("prestacion_id", prestacionId)
    .neq("estado", "ANULADO")
  return ((data ?? []) as unknown as { id: string; pieza: number | null; precio: number; abonado: number; presupuesto: { numero: number; nombre: string; estado: string } | null }[])
    .filter((i) => i.presupuesto?.estado !== "ANULADO" && i.precio > i.abonado)
}

// ---------------------------------------------------------------------
// Bonos FONASA
// ---------------------------------------------------------------------
export async function registrarBono(d: {
  folio: string
  pacienteId: string
  prestacionId: string
  monto: string
  copago: string
  itemId?: string | null
  fecha?: string
}): Promise<Resultado> {
  const usuario = await autorizar("fonasa.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!UUID.test(d.pacienteId)) return { ok: false, mensaje: "Selecciona el paciente." }
  if (!UUID.test(d.prestacionId)) return { ok: false, mensaje: "Selecciona la prestación." }
  const { data, error } = await getSupabase().rpc("registrar_bono", {
    p_folio: d.folio,
    p_paciente: d.pacienteId,
    p_prestacion: d.prestacionId,
    p_monto: entero(d.monto),
    p_usuario: usuario.id,
    p_copago: d.copago ? entero(d.copago) : 0,
    p_item: d.itemId && UUID.test(d.itemId) ? d.itemId : null,
    p_fecha: d.fecha && FECHA.test(d.fecha) ? d.fecha : null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo registrar el bono.") }
  refrescar(d.pacienteId)
  return { ok: true, mensaje: "Bono registrado.", id: data as string }
}

export async function usarBono(bonoId: string, itemId?: string | null): Promise<Resultado> {
  const usuario = await autorizar("fonasa.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { data, error } = await getSupabase().rpc("usar_bono", {
    p_bono: bonoId,
    p_usuario: usuario.id,
    p_item: itemId && UUID.test(itemId) ? itemId : null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo usar el bono.") }
  refrescar()
  revalidatePath("/pacientes", "layout")
  return { ok: true, mensaje: data ? "Bono utilizado y abonado a la prestación." : "Bono marcado como utilizado." }
}

export async function anularBono(bonoId: string, motivo: string): Promise<Resultado> {
  const usuario = await autorizar("fonasa.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("anular_bono", { p_bono: bonoId, p_usuario: usuario.id, p_motivo: motivo })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo anular el bono.") }
  refrescar()
  return { ok: true, mensaje: "Bono anulado." }
}

// ---------------------------------------------------------------------
// Convenios
// ---------------------------------------------------------------------
export async function crearConvenio(d: {
  nombre: string
  institucion: string
  tipo: string
  descuento: string
  inicio: string
  fin: string
  rut: string
  contacto: string
  condiciones: string
}): Promise<Resultado> {
  const usuario = await autorizar("convenios.configurar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!FECHA.test(d.inicio)) return { ok: false, mensaje: "Indica la fecha de inicio." }
  if (d.fin && (!FECHA.test(d.fin) || d.fin < d.inicio)) return { ok: false, mensaje: "La fecha de término debe ser posterior al inicio." }
  const { data, error } = await getSupabase().rpc("crear_convenio", {
    p_nombre: d.nombre,
    p_institucion: d.institucion,
    p_tipo: d.tipo,
    p_descuento: Number(d.descuento.replace(",", ".")) || 0,
    p_inicio: d.inicio,
    p_usuario: usuario.id,
    p_fin: d.fin || null,
    p_rut: d.rut || null,
    p_contacto: d.contacto || null,
    p_condiciones: d.condiciones || null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo crear el convenio.") }
  refrescar()
  revalidatePath("/prestaciones", "layout")
  return { ok: true, mensaje: "Convenio creado (con su arancel en Prestaciones).", id: data as string }
}

export async function actualizarConvenio(id: string, d: { descuento: string; fin: string; activo: boolean; condiciones: string }): Promise<Resultado> {
  const usuario = await autorizar("convenios.configurar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("actualizar_convenio", {
    p_convenio: id,
    p_descuento: Number(d.descuento.replace(",", ".")) || 0,
    p_fin: d.fin && FECHA.test(d.fin) ? d.fin : null,
    p_activo: d.activo,
    p_condiciones: d.condiciones || null,
    p_usuario: usuario.id,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo actualizar el convenio.") }
  refrescar()
  return { ok: true, mensaje: "Convenio actualizado." }
}

export async function agregarBeneficiario(convenioId: string, pacienteId: string): Promise<Resultado> {
  const usuario = await autorizar("fonasa.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("agregar_beneficiario", { p_convenio: convenioId, p_paciente: pacienteId, p_usuario: usuario.id })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo agregar el beneficiario.") }
  refrescar(pacienteId)
  return { ok: true, mensaje: "Beneficiario agregado." }
}

export async function cambiarBeneficiario(beneficiarioId: string, activo: boolean): Promise<Resultado> {
  if (!(await autorizar("fonasa.gestionar"))) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().from("convenio_beneficiarios").update({ activo }).eq("id", beneficiarioId)
  if (error) return { ok: false, mensaje: "No se pudo actualizar." }
  refrescar()
  return { ok: true, mensaje: activo ? "Beneficiario reactivado." : "Beneficiario dado de baja." }
}

export async function crearContrato(d: {
  convenioId: string
  pacienteId: string
  total: string
  cuotas: { monto: string; vencimiento: string }[]
  nota: string
}): Promise<Resultado> {
  const usuario = await autorizar("fonasa.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  if (!UUID.test(d.convenioId) || !UUID.test(d.pacienteId)) return { ok: false, mensaje: "Selecciona convenio y beneficiario." }
  if (d.cuotas.some((c) => !FECHA.test(c.vencimiento))) return { ok: false, mensaje: "Cada cuota necesita fecha de vencimiento." }
  const { data, error } = await getSupabase().rpc("crear_contrato_cuotas", {
    p_convenio: d.convenioId,
    p_paciente: d.pacienteId,
    p_total: entero(d.total),
    p_cuotas: d.cuotas.map((c) => ({ monto: entero(c.monto), vencimiento: c.vencimiento })),
    p_usuario: usuario.id,
    p_nota: d.nota || null,
  })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo crear el contrato.") }
  refrescar()
  return { ok: true, mensaje: "Contrato en cuotas creado.", id: data as string }
}

export async function pagarCuota(cuotaId: string, metodo: string, referencia: string): Promise<Resultado> {
  const usuario = await autorizar("fonasa.gestionar")
  if (!usuario) return { ok: false, mensaje: MENSAJE_SIN_PERMISO }
  const { error } = await getSupabase().rpc("pagar_cuota", { p_cuota: cuotaId, p_metodo: metodo, p_usuario: usuario.id, p_referencia: referencia || null })
  if (error) return { ok: false, mensaje: mensajeBD(error, "No se pudo registrar el pago de la cuota.") }
  refrescar()
  revalidatePath("/caja")
  return { ok: true, mensaje: "Cuota pagada." }
}

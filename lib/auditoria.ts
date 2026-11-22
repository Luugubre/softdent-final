import { getSupabase } from "@/lib/supabase"
import { formatearRut } from "@/lib/validaciones"

export type TipoAccion = "CREAR" | "EDITAR" | "ANULAR" | "ESTADO" | "FIRMA"
export type Modulo = "PACIENTES" | "CLINICO" | "AGENDA" | "TRATAMIENTOS" | "CAJA" | "RECETARIO" | "DOCUMENTOS" | "USUARIOS" | "CONFIGURACION"

export type EventoAuditoria = {
  id: string
  fecha: string
  usuario_nombre: string
  usuario_rol: string
  modulo: Modulo
  accion: TipoAccion
  descripcion: string
  paciente_id?: string
  paciente_nombre?: string
  paciente_rut?: string
  detalle_antes?: string
  detalle_despues?: string
}

export type AccesoFicha = {
  id: string
  fecha: string
  usuario_nombre: string
  usuario_rol: string
  paciente_id: string
  paciente_nombre: string
  paciente_rut: string
  ficha_numero: number
  seccion: string
  ip: string
}

const LIMITE = 1000
const ZONA = "America/Santiago"

const MODULO_HISTORIAL: Record<string, Modulo> = {
  PACIENTE: "PACIENTES",
  ANTECEDENTE: "CLINICO",
  EVOLUCION: "CLINICO",
  ARCHIVO: "CLINICO",
  ODONTOGRAMA: "CLINICO",
  CITA: "AGENDA",
  PRESUPUESTO: "TRATAMIENTOS",
  PAGO: "CAJA",
  RECETA: "RECETARIO",
  DOCUMENTO: "DOCUMENTOS",
  CONSENTIMIENTO: "DOCUMENTOS",
}

const ETIQUETA_TABLA: Record<string, string> = {
  especialidades: "Especialidad",
  categorias_prestaciones: "Categoría de prestaciones",
  boxes: "Box",
  previsiones: "Previsión",
  tipos_atencion: "Tipo de atención",
  metodos_pago: "Método de pago",
  parametros_sistema: "Parámetro del sistema",
  convenios: "Convenio",
  laboratorios: "Laboratorio",
  bancos: "Banco",
  perfiles: "Perfil de usuario",
  plantillas_documento: "Plantilla de documento",
}

const MODULO_TABLA: Record<string, Modulo> = {
  perfiles: "USUARIOS",
  plantillas_documento: "DOCUMENTOS",
}

function tipoAccion(accion: string): TipoAccion {
  if (accion === "FIRMADO") return "FIRMA"
  if (accion === "CREADO") return "CREAR"
  if (["MODIFICADO", "ACTUALIZADO"].includes(accion)) return "EDITAR"
  if (["ANULADO", "CANCELADA", "ELIMINADO", "REVOCADO"].includes(accion)) return "ANULAR"
  return "ESTADO"
}

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

// Rango en hora de Chile, ambos extremos incluidos
function rangoUtc(desde: string, hasta: string) {
  const inicio = new Date(`${desde}T00:00:00-03:00`)
  const fin = new Date(`${hasta}T23:59:59.999-03:00`)
  inicio.setHours(inicio.getHours() - 1)
  fin.setHours(fin.getHours() + 1)
  return { inicio: inicio.toISOString(), fin: fin.toISOString() }
}

function enRango(iso: string, desde: string, hasta: string) {
  const dia = new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA })
  return dia >= desde && dia <= hasta
}

function valorCorto(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  const s = typeof v === "object" ? JSON.stringify(v) : String(v)
  return s.length > 80 ? `${s.slice(0, 77)}…` : s
}

function diferencias(anterior: Record<string, unknown> | null, nuevo: Record<string, unknown> | null) {
  if (!anterior || !nuevo) return { antes: undefined, despues: undefined }
  const claves = Object.keys(nuevo).filter(
    (k) => !["updated_at", "created_at"].includes(k) && JSON.stringify(anterior[k]) !== JSON.stringify(nuevo[k])
  )
  if (claves.length === 0) return { antes: undefined, despues: undefined }
  return {
    antes: claves.map((k) => `${k}: ${valorCorto(anterior[k])}`).join(" · "),
    despues: claves.map((k) => `${k}: ${valorCorto(nuevo[k])}`).join(" · "),
  }
}

async function perfilesPorId(ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (unicos.length === 0) return new Map<string, { nombre: string; rol: string }>()
  const { data } = await getSupabase().from("perfiles").select("id, nombre_completo, rol").in("id", unicos)
  return new Map((data ?? []).map((p) => [p.id as string, { nombre: p.nombre_completo as string, rol: p.rol as string }]))
}

async function pacientesPorId(ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))]
  const mapa = new Map<string, { nombre: string; rut: string; ficha: number; extranjero: boolean }>()
  for (let i = 0; i < unicos.length; i += 200) {
    const { data } = await getSupabase()
      .from("pacientes")
      .select("id, nombres, apellidos, rut, numero_ficha, extranjero")
      .in("id", unicos.slice(i, i + 200))
    for (const p of data ?? []) {
      mapa.set(p.id, { nombre: `${p.nombres} ${p.apellidos}`, rut: p.rut, ficha: p.numero_ficha, extranjero: p.extranjero })
    }
  }
  return mapa
}

const rutVisible = (p?: { rut: string; extranjero: boolean }) => (p ? (p.extranjero ? p.rut : formatearRut(p.rut)) : undefined)

export async function listarEventos(desde: string, hasta: string): Promise<{ eventos: EventoAuditoria[]; truncado: boolean }> {
  const db = getSupabase()
  const { inicio, fin } = rangoUtc(desde, hasta)

  const [hist, conf] = await Promise.all([
    db
      .from("historial_paciente")
      .select("id, paciente_id, tipo, accion, titulo, detalle, profesional, usuario_id, fecha")
      .gte("fecha", inicio)
      .lte("fecha", fin)
      .order("fecha", { ascending: false })
      .limit(LIMITE),
    db
      .from("auditoria")
      .select("id, tabla, registro_id, accion, anterior, nuevo, usuario_id, fecha")
      .gte("fecha", inicio)
      .lte("fecha", fin)
      .order("fecha", { ascending: false })
      .limit(LIMITE),
  ])
  const historial = (hist.data ?? []).filter((h) => enRango(h.fecha, desde, hasta))
  const cambios = (conf.data ?? []).filter((c) => enRango(c.fecha, desde, hasta))

  const [perfiles, pacientes] = await Promise.all([
    perfilesPorId([...historial.map((h) => h.usuario_id), ...cambios.map((c) => c.usuario_id)]),
    pacientesPorId(historial.map((h) => h.paciente_id)),
  ])

  const eventos: (EventoAuditoria & { orden: string })[] = [
    ...historial.map((h) => {
      const u = h.usuario_id ? perfiles.get(h.usuario_id) : undefined
      const p = pacientes.get(h.paciente_id)
      return {
        id: `h-${h.id}`,
        orden: h.fecha,
        fecha: fechaHora(h.fecha),
        usuario_nombre: u?.nombre ?? h.profesional ?? "Sistema",
        usuario_rol: u?.rol ?? "—",
        modulo: MODULO_HISTORIAL[h.tipo] ?? "PACIENTES",
        accion: tipoAccion(h.accion),
        descripcion: h.titulo,
        paciente_id: h.paciente_id,
        paciente_nombre: p?.nombre,
        paciente_rut: rutVisible(p),
        detalle_despues: h.detalle ?? undefined,
      }
    }),
    ...cambios.map((c) => {
      const u = c.usuario_id ? perfiles.get(c.usuario_id) : undefined
      const nombre = (c.nuevo?.nombre ?? c.nuevo?.nombre_completo ?? c.nuevo?.titulo ?? c.nuevo?.descripcion ?? c.registro_id) as string
      const { antes, despues } = diferencias(c.anterior, c.nuevo)
      return {
        id: `a-${c.id}`,
        orden: c.fecha,
        fecha: fechaHora(c.fecha),
        usuario_nombre: u?.nombre ?? "Sistema",
        usuario_rol: u?.rol ?? "—",
        modulo: MODULO_TABLA[c.tabla] ?? ("CONFIGURACION" as Modulo),
        accion: tipoAccion(c.accion),
        descripcion: `${ETIQUETA_TABLA[c.tabla] ?? c.tabla} ${c.accion === "CREADO" ? "creado" : "modificado"}: ${valorCorto(nombre)}`,
        detalle_antes: antes,
        detalle_despues: despues,
      }
    }),
  ]
  eventos.sort((a, b) => b.orden.localeCompare(a.orden))

  return {
    eventos: eventos.slice(0, LIMITE).map((e) => {
      const { orden, ...resto } = e
      void orden
      return resto
    }),
    truncado: (hist.data?.length ?? 0) >= LIMITE || (conf.data?.length ?? 0) >= LIMITE,
  }
}

export async function listarAccesos(desde: string, hasta: string): Promise<{ accesos: AccesoFicha[]; truncado: boolean }> {
  const { inicio, fin } = rangoUtc(desde, hasta)
  const { data } = await getSupabase()
    .from("accesos_ficha")
    .select("id, paciente_id, usuario_id, seccion, ip, fecha")
    .gte("fecha", inicio)
    .lte("fecha", fin)
    .order("fecha", { ascending: false })
    .limit(LIMITE)
  const filas = (data ?? []).filter((a) => enRango(a.fecha, desde, hasta))
  const [perfiles, pacientes] = await Promise.all([
    perfilesPorId(filas.map((a) => a.usuario_id)),
    pacientesPorId(filas.map((a) => a.paciente_id)),
  ])
  return {
    accesos: filas.map((a) => {
      const u = perfiles.get(a.usuario_id)
      const p = pacientes.get(a.paciente_id)
      return {
        id: String(a.id),
        fecha: fechaHora(a.fecha),
        usuario_nombre: u?.nombre ?? "—",
        usuario_rol: u?.rol ?? "—",
        paciente_id: a.paciente_id,
        paciente_nombre: p?.nombre ?? "—",
        paciente_rut: rutVisible(p) ?? "—",
        ficha_numero: p?.ficha ?? 0,
        seccion: a.seccion,
        ip: a.ip ?? "—",
      }
    }),
    truncado: (data?.length ?? 0) >= LIMITE,
  }
}

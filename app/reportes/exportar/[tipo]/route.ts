import { obtenerUsuarioActual } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { getSupabase } from "@/lib/supabase"
import { crearExcel, respuestaExcel, type Hoja } from "@/lib/excel"
import { formatearFechaHora, hoyChile } from "@/lib/formato"
import { formatearRut } from "@/lib/validaciones"

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const PAGINA = 1000
const MAXIMO = 20000

type Fila = Record<string, unknown>

async function todas(consulta: (desde: number, hasta: number) => PromiseLike<{ data: Fila[] | null }>) {
  const filas: Fila[] = []
  for (let i = 0; i < MAXIMO; i += PAGINA) {
    const { data } = await consulta(i, i + PAGINA - 1)
    filas.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }
  return filas
}

async function nombres(tabla: "pacientes" | "perfiles", ids: unknown[]) {
  const unicos = [...new Set(ids.filter((v): v is string => typeof v === "string"))]
  const mapa = new Map<string, Fila>()
  const columnas = tabla === "pacientes" ? "id, nombres, apellidos, rut, extranjero, numero_ficha" : "id, nombre_completo"
  for (let i = 0; i < unicos.length; i += 200) {
    const { data } = await getSupabase().from(tabla).select(columnas).in("id", unicos.slice(i, i + 200))
    for (const f of (data ?? []) as unknown as Fila[]) mapa.set(f.id as string, f)
  }
  return mapa
}

const rut = (p?: Fila) => (p ? (p.extranjero ? String(p.rut) : formatearRut(String(p.rut))) : "")
const nombrePaciente = (p?: Fila) => (p ? `${p.nombres} ${p.apellidos}` : "")
const fechaHora = (v: unknown) => (typeof v === "string" ? formatearFechaHora(v) : "")

export async function GET(request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return new Response("Debes iniciar sesión.", { status: 401 })
  if (!puede(usuario.rol, "reportes.ver")) return new Response("No tienes permiso para exportar reportes.", { status: 403 })

  const { tipo } = await params
  const url = new URL(request.url)
  const hoy = hoyChile()
  const desde = FECHA.test(url.searchParams.get("desde") ?? "") ? url.searchParams.get("desde")! : `${hoy.slice(0, 8)}01`
  const hasta = FECHA.test(url.searchParams.get("hasta") ?? "") ? url.searchParams.get("hasta")! : hoy
  if (desde > hasta) return new Response("La fecha inicial no puede ser posterior a la final.", { status: 400 })
  const inicio = `${desde}T00:00:00-03:00`
  const fin = `${hasta}T23:59:59.999-03:00`
  const subtitulo = `Del ${desde} al ${hasta} · Descargado el ${formatearFechaHora(new Date().toISOString())} por ${usuario.nombre_completo}`
  const db = getSupabase()
  let hoja: Hoja

  if (tipo === "pacientes") {
    const filas = await todas((a, b) =>
      db
        .from("pacientes")
        .select("numero_ficha, rut, extranjero, nombres, apellidos, fecha_nacimiento, telefono, email, comuna, prevision, activo, created_at")
        .order("numero_ficha")
        .range(a, b)
    )
    hoja = {
      nombre: "Pacientes",
      titulo: "Listado de pacientes",
      subtitulo: `Descargado el ${formatearFechaHora(new Date().toISOString())} por ${usuario.nombre_completo}`,
      filtro: true,
      columnas: [
        { titulo: "Ficha", ancho: 8, tipo: "numero" },
        { titulo: "RUT", ancho: 14 },
        { titulo: "Nombre", ancho: 32 },
        { titulo: "Nacimiento", ancho: 12 },
        { titulo: "Teléfono", ancho: 15 },
        { titulo: "Correo", ancho: 28 },
        { titulo: "Comuna", ancho: 16 },
        { titulo: "Previsión", ancho: 14 },
        { titulo: "Estado", ancho: 12 },
        { titulo: "Registrado", ancho: 18 },
      ],
      filas: filas.map((p) => [
        p.numero_ficha as number,
        rut(p),
        nombrePaciente(p),
        p.fecha_nacimiento as string,
        p.telefono as string,
        p.email as string,
        p.comuna as string,
        p.prevision as string,
        p.activo ? "Habilitado" : "Deshabilitado",
        fechaHora(p.created_at),
      ]),
    }
  } else if (tipo === "citas") {
    const filas = await todas((a, b) =>
      db
        .from("citas")
        .select("numero, inicio, duracion_min, estado, motivo, sobrecupo, motivo_cancelacion, paciente_id, profesional_id")
        .gte("inicio", inicio)
        .lte("inicio", fin)
        .order("inicio")
        .range(a, b)
    )
    const [pacientes, perfiles] = await Promise.all([
      nombres("pacientes", filas.map((c) => c.paciente_id)),
      nombres("perfiles", filas.map((c) => c.profesional_id)),
    ])
    hoja = {
      nombre: "Citas",
      titulo: "Citas de la agenda",
      subtitulo,
      filtro: true,
      columnas: [
        { titulo: "N°", ancho: 8, tipo: "numero" },
        { titulo: "Fecha y hora", ancho: 18 },
        { titulo: "Minutos", ancho: 9, tipo: "numero" },
        { titulo: "Paciente", ancho: 30 },
        { titulo: "RUT", ancho: 14 },
        { titulo: "Profesional", ancho: 26 },
        { titulo: "Estado", ancho: 14 },
        { titulo: "Motivo", ancho: 30 },
        { titulo: "Sobrecupo", ancho: 10 },
        { titulo: "Motivo cancelación", ancho: 28 },
      ],
      filas: filas.map((c) => {
        const p = pacientes.get(c.paciente_id as string)
        return [
          c.numero as number,
          fechaHora(c.inicio),
          c.duracion_min as number,
          nombrePaciente(p),
          rut(p),
          (perfiles.get(c.profesional_id as string)?.nombre_completo as string) ?? "",
          String(c.estado).replace("_", " "),
          c.motivo as string,
          c.sobrecupo ? "Sí" : "",
          c.motivo_cancelacion as string,
        ]
      }),
    }
  } else if (tipo === "pagos") {
    const filas = await todas((a, b) =>
      db
        .from("pagos")
        .select("numero, fecha, monto, metodo, referencia, numero_boleta, estado, motivo_anulacion, paciente_id, registrado_por")
        .gte("fecha", inicio)
        .lte("fecha", fin)
        .order("fecha")
        .range(a, b)
    )
    const [pacientes, perfiles] = await Promise.all([
      nombres("pacientes", filas.map((p) => p.paciente_id)),
      nombres("perfiles", filas.map((p) => p.registrado_por)),
    ])
    const vigentes = filas.filter((p) => p.estado === "VIGENTE")
    hoja = {
      nombre: "Pagos",
      titulo: "Pagos recibidos",
      subtitulo,
      filtro: true,
      columnas: [
        { titulo: "N°", ancho: 8, tipo: "numero" },
        { titulo: "Fecha", ancho: 18 },
        { titulo: "Paciente", ancho: 30 },
        { titulo: "RUT", ancho: 14 },
        { titulo: "Monto", ancho: 14, tipo: "pesos" },
        { titulo: "Método", ancho: 14 },
        { titulo: "Referencia", ancho: 18 },
        { titulo: "Boleta", ancho: 12 },
        { titulo: "Estado", ancho: 11 },
        { titulo: "Motivo anulación", ancho: 26 },
        { titulo: "Registrado por", ancho: 24 },
      ],
      filas: filas.map((p) => {
        const pac = pacientes.get(p.paciente_id as string)
        return [
          p.numero as number,
          fechaHora(p.fecha),
          nombrePaciente(pac),
          rut(pac),
          p.monto as number,
          p.metodo as string,
          p.referencia as string,
          p.numero_boleta as string,
          p.estado as string,
          p.motivo_anulacion as string,
          (perfiles.get(p.registrado_por as string)?.nombre_completo as string) ?? "",
        ]
      }),
      totales: ["Total vigente", `${vigentes.length} pago(s)`, "", "", vigentes.reduce((s, p) => s + Number(p.monto), 0)],
    }
  } else {
    return new Response("Reporte no encontrado.", { status: 404 })
  }

  const archivo = tipo === "pacientes" ? `pacientes-${hoy}.xlsx` : `${tipo}-${desde}-a-${hasta}.xlsx`
  return respuestaExcel(crearExcel([hoja]), archivo)
}

import Link from "next/link"
import { requerirUsuario } from "@/lib/auth"
import { puede, ROL_DESCRIPCION, ROL_ETIQUETAS, type Permiso } from "@/lib/permisos"
import { obtenerCitas } from "@/lib/agenda"
import { obtenerCajaAbierta } from "@/lib/caja"
import { obtenerLiquidaciones } from "@/lib/liquidaciones"
import { fechaTitulo, hoyEnChile } from "@/lib/fechas-agenda"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { GUIA } from "@/lib/guia"
import { Termino } from "@/components/ui/Ayuda"
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleUserRound,
  FileText,
  Handshake,
  HandCoins,
  LifeBuoy,
  Search,
  Settings,
  Stethoscope,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

type Modulo = {
  href: string
  icono: LucideIcon
  titulo: string
  descripcion: string
  puedes: string[]
  permiso: Permiso
  color: string
}

const MODULOS: Modulo[] = [
  {
    href: "/perfil",
    icono: CircleUserRound,
    titulo: "Mi Perfil",
    descripcion: "Tus datos personales, firma digital y preferencias.",
    puedes: [
      "Actualizar tu teléfono y datos",
      "Cambiar tu contraseña de acceso",
      "Dibujar y actualizar tu firma digital SVG",
      "Configurar preferencias de interfaz",
    ],
    permiso: "agenda.ver",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    href: "/agenda",
    icono: CalendarDays,
    titulo: "Agenda",
    descripcion: "Las citas del día y de la semana de cada dentista.",
    puedes: ["Agendar y reprogramar citas", "Marcar llegada, atención y término", "Enviar recordatorios por WhatsApp", "Imprimir la hoja de ruta"],
    permiso: "agenda.ver",
    color: "bg-sky-50 text-sky-600",
  },
  {
    href: "/pacientes",
    icono: Users,
    titulo: "Pacientes",
    descripcion: "La ficha completa de cada paciente.",
    puedes: ["Registrar pacientes nuevos", "Odontograma y tratamientos", "Evoluciones, antecedentes y RX", "Registrar pagos y ver su deuda"],
    permiso: "pacientes.ver",
    color: "bg-blue-50 text-blue-600",
  },
  {
    href: "/recetas",
    icono: FileText,
    titulo: "Recetario Médico",
    descripcion: "Prescripciones electrónicas e historial imprimible.",
    puedes: [
      "Emitir recetas con folio correlativo",
      "Validación automática de alergias del paciente",
      "Autocompletado de posología y catálogo de fármacos",
      "Generación e impresión de PDF con firma digital",
    ],
    permiso: "clinico.ver",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/caja",
    icono: Wallet,
    titulo: "Caja",
    descripcion: "El dinero que entra y sale cada día.",
    puedes: ["Abrir la caja con el sencillo", "Registrar ingresos y egresos", "Hacer el arqueo y cerrar", "Ver resúmenes por período"],
    permiso: "caja.gestionar",
    color: "bg-amber-50 text-amber-600",
  },
  {
    href: "/fonasa-convenios",
    icono: Handshake,
    titulo: "FONASA y convenios",
    descripcion: "Bonos FONASA y acuerdos con empresas o sindicatos.",
    puedes: ["Registrar y usar bonos por folio", "Crear convenios con descuento", "Agregar beneficiarios", "Controlar cuotas y vencimientos"],
    permiso: "fonasa.gestionar",
    color: "bg-rose-50 text-rose-600",
  },
  {
    href: "/liquidaciones",
    icono: HandCoins,
    titulo: "Liquidaciones",
    descripcion: "Lo que se le paga a cada dentista por su trabajo.",
    puedes: ["Definir el % de cada dentista", "Calcular el mes", "Aprobar y registrar el pago", "Imprimir el detalle"],
    permiso: "liquidaciones.ver",
    color: "bg-violet-50 text-violet-600",
  },
  {
    href: "/prestaciones",
    icono: Stethoscope,
    titulo: "Prestaciones y precios",
    descripcion: "El catálogo de procedimientos y sus precios.",
    puedes: ["Crear prestaciones", "Fijar precios por arancel", "Asignar código FONASA", "Habilitar profesionales"],
    permiso: "prestaciones.ver",
    color: "bg-cyan-50 text-cyan-700",
  },
  {
    href: "/administracion",
    icono: Settings,
    titulo: "Administración",
    descripcion: "Opciones generales del sistema.",
    puedes: ["Nombre y datos de la clínica", "Métodos de pago", "Previsiones, tipos de atención, boxes…", "Ver el registro de cambios"],
    permiso: "administracion.gestionar",
    color: "bg-gray-100 text-gray-600",
  },
]

export default async function InicioPage() {
  const usuario = await requerirUsuario()
  const p = (permiso: Permiso) => puede(usuario.rol, permiso)
  const hoy = hoyEnChile()

  const [citasHoy, caja, liquidaciones] = await Promise.all([
    p("agenda.ver") ? obtenerCitas(hoy, hoy, { profesional: p("agenda.ver_todas") ? undefined : usuario.id }) : Promise.resolve([]),
    p("caja.gestionar") ? obtenerCajaAbierta() : Promise.resolve(null),
    p("liquidaciones.gestionar") ? obtenerLiquidaciones() : Promise.resolve([]),
  ])

  const vigentes = citasHoy.filter((c) => c.estado !== "CANCELADA" && c.estado !== "REAGENDADA")
  const porConfirmar = vigentes.filter((c) => c.estado === "AGENDADA").length
  const enEspera = vigentes.filter((c) => c.estado === "EN_ESPERA").length
  const atendidas = vigentes.filter((c) => c.estado === "REALIZADA").length
  const liqPendientes = liquidaciones.filter((l) => l.estado === "CALCULADA" || l.estado === "APROBADA")

  const modulos = MODULOS.filter((m) => p(m.permiso))
  const guia = GUIA.filter((g) => p(g.permiso)).slice(0, 8)
  const nombre = usuario.nombre_completo.split(" ")[0]

  return (
    <div className="w-full min-h-screen p-6 md:p-10 space-y-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-6 text-white shadow-lg md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-blue-200 first-letter:uppercase">{fechaTitulo(hoy)}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Hola, {nombre}</h1>
            <p className="mt-1 max-w-2xl text-sm text-blue-100/90">
              Entraste como <strong className="font-semibold text-white">{ROL_ETIQUETAS[usuario.rol]}</strong>: {ROL_DESCRIPCION[usuario.rol]}
            </p>
          </div>
          {p("pacientes.ver") && (
            <form action="/pacientes" method="GET" className="flex w-full max-w-md items-center gap-2 rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur">
              <Search className="ml-2 h-4 w-4 shrink-0 text-blue-100" aria-hidden />
              <input
                name="q"
                placeholder="Buscar paciente por nombre o RUT…"
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white placeholder:text-blue-100/70 focus:!shadow-none focus:outline-none"
              />
              <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">Buscar</button>
            </form>
          )}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {p("agenda.ver") && (
          <Link href="/agenda" className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{p("agenda.ver_todas") ? "Citas de hoy" : "Mis citas de hoy"}</p>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><CalendarDays className="h-5 w-5" aria-hidden /></span>
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{vigentes.length}</p>
            <p className="mt-1 text-xs font-medium text-gray-500">
              {porConfirmar > 0 ? <span className="text-amber-700">{porConfirmar} sin confirmar</span> : "Todas confirmadas"}
              {enEspera > 0 && <span className="text-blue-700"> · {enEspera} en sala de espera</span>}
              {atendidas > 0 && <span> · {atendidas} atendidas</span>}
            </p>
          </Link>
        )}

        {p("caja.gestionar") && (
          <Link href="/caja" className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Caja</p>
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${caja ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
            </div>
            {caja ? (
              <>
                <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" aria-hidden />
                  Abierta · N° {caja.numero}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Desde {formatearFechaHora(caja.abierta_en)} por {caja.abridor?.nombre_completo ?? "—"}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" aria-hidden />
                  Cerrada
                </p>
                <p className="mt-1 text-xs font-medium text-amber-700">Ábrela para poder recibir pagos →</p>
              </>
            )}
          </Link>
        )}

        {p("liquidaciones.gestionar") && (
          <Link href="/liquidaciones" className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Liquidaciones por pagar</p>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><HandCoins className="h-5 w-5" aria-hidden /></span>
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{liqPendientes.length}</p>
            <p className="mt-1 text-xs font-medium text-gray-500">
              {liqPendientes.length > 0 ? `Total ${formatearPesos(liqPendientes.reduce((s, l) => s + l.total, 0))}` : "Nada pendiente"}
            </p>
          </Link>
        )}

        <Link href="/ayuda" className="group rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700/80">¿Perdido?</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-600"><LifeBuoy className="h-5 w-5" aria-hidden /></span>
          </div>
          <p className="mt-2 text-lg font-bold text-blue-900">Centro de ayuda</p>
          <p className="mt-1 text-xs font-medium text-blue-800/80">Dónde se cambia cada cosa y qué significa cada término →</p>
        </Link>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">¿Qué quieres hacer?</h2>
          <p className="text-sm text-gray-500">Cada módulo y lo que puedes hacer en él. Solo ves los que tu rol puede usar.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modulos.map((m) => {
            const Icono = m.icono
            return (
              <Link
                key={m.href}
                href={m.href}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${m.color}`}>
                    <Icono className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">{m.titulo}</p>
                    <p className="text-sm text-gray-500">{m.descripcion}</p>
                  </div>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {m.puedes.map((x) => (
                    <li key={x} className="flex gap-2 text-sm text-gray-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
                      {x}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-blue-700">
                  Ir a {m.titulo}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      {guia.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">¿Dónde se cambia…?</h2>
              <p className="text-sm text-gray-500">Las configuraciones más usadas. Haz clic para ir directo.</p>
            </div>
            <Link href="/ayuda" className="text-sm font-semibold text-blue-700 hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {guia.map((g) => (
              <Link
                key={g.que}
                href={g.href}
                className="flex flex-col gap-0.5 rounded-xl border border-gray-100 px-3 py-2.5 transition hover:border-blue-200 hover:bg-blue-50/60 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="text-sm font-medium text-gray-800">{g.que}</span>
                <span className="text-xs font-semibold text-blue-700 sm:shrink-0 sm:text-right">{g.donde}</span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            ¿No entiendes una palabra? Las que tienen un “?” al lado (por ejemplo <Termino t="arqueo" />) muestran su significado al pasar el
            mouse o al tocarlas.
          </p>
        </section>
      )}
    </div>
  )
}
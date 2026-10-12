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

type Modulo = {
  href: string
  icono: string
  titulo: string
  descripcion: string
  puedes: string[]
  permiso: Permiso
  color: string
}

const MODULOS: Modulo[] = [
  {
    href: "/agenda",
    icono: "📅",
    titulo: "Agenda",
    descripcion: "Las citas del día y de la semana de cada dentista.",
    puedes: ["Agendar y reprogramar citas", "Marcar llegada, atención y término", "Enviar recordatorios por WhatsApp", "Imprimir la hoja de ruta"],
    permiso: "agenda.ver",
    color: "from-sky-500 to-blue-600",
  },
  {
    href: "/pacientes",
    icono: "🧑‍⚕️",
    titulo: "Pacientes",
    descripcion: "La ficha completa de cada paciente.",
    puedes: ["Registrar pacientes nuevos", "Odontograma y tratamientos", "Evoluciones, antecedentes y RX", "Registrar pagos y ver su deuda"],
    permiso: "pacientes.ver",
    color: "from-teal-500 to-emerald-600",
  },
  {
    href: "/caja",
    icono: "💰",
    titulo: "Caja",
    descripcion: "El dinero que entra y sale cada día.",
    puedes: ["Abrir la caja con el sencillo", "Registrar ingresos y egresos", "Hacer el arqueo y cerrar", "Ver resúmenes por período"],
    permiso: "caja.gestionar",
    color: "from-amber-500 to-orange-600",
  },
  {
    href: "/fonasa-convenios",
    icono: "🏥",
    titulo: "FONASA y convenios",
    descripcion: "Bonos FONASA y acuerdos con empresas o sindicatos.",
    puedes: ["Registrar y usar bonos por folio", "Crear convenios con descuento", "Agregar beneficiarios", "Controlar cuotas y vencimientos"],
    permiso: "fonasa.gestionar",
    color: "from-rose-500 to-pink-600",
  },
  {
    href: "/liquidaciones",
    icono: "👩‍⚕️",
    titulo: "Liquidaciones",
    descripcion: "Lo que se le paga a cada dentista por su trabajo.",
    puedes: ["Definir el % de cada dentista", "Calcular el mes", "Aprobar y registrar el pago", "Imprimir el detalle"],
    permiso: "liquidaciones.ver",
    color: "from-violet-500 to-purple-600",
  },
  {
    href: "/prestaciones",
    icono: "🦷",
    titulo: "Prestaciones y precios",
    descripcion: "El catálogo de procedimientos y sus precios.",
    puedes: ["Crear prestaciones", "Fijar precios por arancel", "Asignar código FONASA", "Habilitar profesionales"],
    permiso: "prestaciones.ver",
    color: "from-cyan-500 to-sky-600",
  },
  {
    href: "/administracion",
    icono: "⚙️",
    titulo: "Administración",
    descripcion: "Opciones generales del sistema.",
    puedes: ["Nombre y datos de la clínica", "Métodos de pago", "Previsiones, tipos de atención, boxes…", "Ver el registro de cambios"],
    permiso: "administracion.gestionar",
    color: "from-gray-600 to-gray-800",
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
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-gray-400 first-letter:uppercase">{fechaTitulo(hoy)}</p>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Hola, {nombre} 👋</h1>
          <p className="text-sm font-medium text-gray-500">
            Entraste como <strong className="text-gray-700">{ROL_ETIQUETAS[usuario.rol]}</strong>: {ROL_DESCRIPCION[usuario.rol]}
          </p>
        </div>
        {p("pacientes.ver") && (
          <form action="/pacientes" method="GET" className="flex w-full max-w-sm gap-2">
            <input
              name="q"
              placeholder="Buscar paciente por nombre o RUT…"
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700">Buscar</button>
          </form>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {p("agenda.ver") && (
          <Link href="/agenda" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">📅 {p("agenda.ver_todas") ? "Citas de hoy" : "Mis citas de hoy"}</p>
            <p className="mt-1 text-3xl font-black text-gray-900">{vigentes.length}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {porConfirmar > 0 ? <span className="text-amber-700">{porConfirmar} sin confirmar</span> : "Todas confirmadas"}
              {enEspera > 0 && <span className="text-blue-700"> · {enEspera} en sala de espera</span>}
              {atendidas > 0 && <span> · {atendidas} atendidas</span>}
            </p>
          </Link>
        )}

        {p("caja.gestionar") && (
          <Link
            href="/caja"
            className={`rounded-2xl border p-5 shadow-sm hover:shadow ${caja ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">💰 Caja</p>
            {caja ? (
              <>
                <p className="mt-1 text-2xl font-black text-emerald-800">Abierta · N° {caja.numero}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Desde {formatearFechaHora(caja.abierta_en)} por {caja.abridor?.nombre_completo ?? "—"}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-2xl font-black text-amber-800">Cerrada</p>
                <p className="mt-1 text-xs font-semibold text-amber-700">Ábrela para poder recibir pagos →</p>
              </>
            )}
          </Link>
        )}

        {p("liquidaciones.gestionar") && (
          <Link href="/liquidaciones" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">👩‍⚕️ Liquidaciones por pagar</p>
            <p className="mt-1 text-3xl font-black text-gray-900">{liqPendientes.length}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {liqPendientes.length > 0 ? `Total ${formatearPesos(liqPendientes.reduce((s, l) => s + l.total, 0))}` : "Nada pendiente"}
            </p>
          </Link>
        )}

        <Link href="/ayuda" className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm hover:shadow">
          <p className="text-[11px] font-black uppercase tracking-wider text-blue-500">❓ ¿Perdido?</p>
          <p className="mt-1 text-lg font-black text-blue-900">Centro de ayuda</p>
          <p className="mt-1 text-xs font-semibold text-blue-700">Dónde se cambia cada cosa y qué significa cada término →</p>
        </Link>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">¿Qué quieres hacer?</h2>
          <p className="text-xs font-semibold text-gray-500">Cada módulo y lo que puedes hacer en él. Solo ves los que tu rol puede usar.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modulos.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`flex items-center gap-3 bg-gradient-to-r ${m.color} px-5 py-3 text-white`}>
                <span aria-hidden className="text-2xl">
                  {m.icono}
                </span>
                <div>
                  <p className="text-base font-black">{m.titulo}</p>
                  <p className="text-xs font-medium text-white/85">{m.descripcion}</p>
                </div>
              </div>
              <ul className="space-y-1 px-5 py-3">
                {m.puedes.map((x) => (
                  <li key={x} className="flex gap-2 text-sm text-gray-600">
                    <span aria-hidden className="text-emerald-500">✓</span>
                    {x}
                  </li>
                ))}
              </ul>
              <p className="px-5 pb-3 text-xs font-black text-blue-600 group-hover:underline">Ir a {m.titulo} →</p>
            </Link>
          ))}
        </div>
      </section>

      {guia.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">⚙️ ¿Dónde se cambia…?</h2>
              <p className="text-xs font-semibold text-gray-500">Las configuraciones más usadas. Haz clic para ir directo.</p>
            </div>
            <Link href="/ayuda" className="text-sm font-bold text-blue-600 hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {guia.map((g) => (
              <Link key={g.que} href={g.href} className="flex flex-col gap-0.5 rounded-xl border border-gray-100 px-3 py-2 hover:border-blue-200 hover:bg-blue-50 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-sm font-bold text-gray-800">{g.que}</span>
                <span className="text-[11px] font-bold text-blue-700 sm:shrink-0 sm:text-right">{g.donde}</span>
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

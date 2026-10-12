import Link from "next/link"
import { requerirUsuario } from "@/lib/auth"
import { puede, ROLES, ROL_COLOR, ROL_DESCRIPCION, ROL_ETIQUETAS, type Permiso } from "@/lib/permisos"
import { GUIA } from "@/lib/guia"
import { GLOSARIO, type EntradaGlosario } from "@/lib/glosario"
import { Encabezado } from "@/components/ui/Ayuda"
import { BuscadorAyuda } from "@/components/ayuda/BuscadorAyuda"

type Flujo = { titulo: string; icono: string; permiso: Permiso; pasos: { texto: string; href?: string }[] }

const FLUJOS: Flujo[] = [
  {
    titulo: "Agendar una cita",
    icono: "📅",
    permiso: "agenda.gestionar",
    pasos: [
      { texto: "Ve a Agenda y presiona “+ Agendar”.", href: "/agenda" },
      { texto: "Busca al paciente (o créalo rápido con nombre y teléfono)." },
      { texto: "Elige motivo, dentista y tipo de atención." },
      { texto: "Haz clic en un horario libre de la semana y confirma." },
      { texto: "Envía el comprobante por WhatsApp con el botón verde." },
    ],
  },
  {
    titulo: "Recibir un pago",
    icono: "💳",
    permiso: "pagos.registrar",
    pasos: [
      { texto: "Revisa que la caja esté abierta (si no, ábrela en Caja).", href: "/caja" },
      { texto: "Abre la ficha del paciente › pestaña Pagos.", href: "/pacientes" },
      { texto: "Escribe el monto: se reparte solo entre las prestaciones con deuda (puedes ajustarlo)." },
      { texto: "Elige el método y, si lo pide, el N° de operación." },
      { texto: "Presiona “Registrar pago” e imprime el comprobante si lo piden." },
    ],
  },
  {
    titulo: "Armar e imprimir un presupuesto por fases",
    icono: "🧾",
    permiso: "presupuestos.gestionar",
    pasos: [
      { texto: "Abre la ficha del paciente › Tratamientos y entra al tratamiento.", href: "/pacientes" },
      { texto: "En “Fases del presupuesto”, crea las etapas (ej. Fase 1: Higiene)." },
      { texto: "En la tabla de prestaciones, elige la fase de cada una en la columna “Fase”." },
      { texto: "Presiona “🖨 Imprimir presupuesto” y luego Imprimir (o guarda como PDF)." },
    ],
  },
  {
    titulo: "Cerrar la caja al final del día",
    icono: "💰",
    permiso: "caja.gestionar",
    pasos: [
      { texto: "Ve a Caja.", href: "/caja" },
      { texto: "Cuenta el efectivo físico y escríbelo en “Arqueo y cierre”." },
      { texto: "El sistema calcula la diferencia con lo esperado." },
      { texto: "Si hay diferencia, escribe por qué (es obligatorio)." },
      { texto: "Cierra la caja e imprime el detalle si lo necesitas." },
    ],
  },
  {
    titulo: "Usar un bono FONASA",
    icono: "🏥",
    permiso: "fonasa.gestionar",
    pasos: [
      { texto: "La prestación debe tener código FONASA (Prestaciones › Datos).", href: "/prestaciones" },
      { texto: "En FONASA y convenios › Bonos, registra el folio, el paciente y la prestación.", href: "/fonasa-convenios" },
      { texto: "En “Aplicar a prestación del plan”, elige la prestación del tratamiento que cubre." },
      { texto: "Cuando se use, presiona “Usar”: el monto del bono se abona solo a esa prestación." },
    ],
  },
  {
    titulo: "Liquidar a un dentista",
    icono: "👩‍⚕️",
    permiso: "liquidaciones.gestionar",
    pasos: [
      { texto: "Revisa que el dentista tenga su % en Liquidaciones.", href: "/liquidaciones" },
      { texto: "Entra al dentista y elige el mes." },
      { texto: "Agrega bonificación, ajuste o descuento si corresponde y presiona Calcular." },
      { texto: "Revisa el detalle y presiona Aprobar." },
      { texto: "Registra el pago (si es en efectivo, sale de la caja abierta)." },
    ],
  },
  {
    titulo: "Configurar el horario de un dentista",
    icono: "🕘",
    permiso: "agenda.configurar",
    pasos: [
      { texto: "Ve a Horarios y boxes.", href: "/agenda/configuracion" },
      { texto: "En “Horarios de atención”, elige el dentista y marca los días." },
      { texto: "Pon la hora de inicio y término y presiona Agregar. Para jornada partida, agrega dos tramos." },
      { texto: "Para vacaciones usa el botón “🔒 Bloquear” en la Agenda.", href: "/agenda" },
    ],
  },
]

export default async function AyudaPage() {
  const usuario = await requerirUsuario()
  const p = (permiso: Permiso) => puede(usuario.rol, permiso)

  const flujos = FLUJOS.filter((f) => p(f.permiso))
  const guia = GUIA.filter((g) => p(g.permiso))
  const glosario = Object.values(GLOSARIO) as EntradaGlosario[]

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-8">
      <Encabezado
        icono="❓"
        titulo="Centro de ayuda"
        descripcion="Cómo hacer las tareas más comunes, dónde se cambia cada configuración y qué significa cada término del sistema."
        migas={[{ etiqueta: "Centro de ayuda" }]}
      >
        <nav className="flex flex-wrap gap-2 text-sm font-bold">
          {flujos.length > 0 && (
            <a href="#tareas" className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-blue-300">
              🧭 Paso a paso
            </a>
          )}
          <a href="#donde" className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-blue-300">
            ⚙️ ¿Dónde se cambia…?
          </a>
          <a href="#glosario" className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-blue-300">
            📖 Glosario
          </a>
          <a href="#roles" className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-blue-300">
            🔐 Roles
          </a>
        </nav>
      </Encabezado>

      {flujos.length > 0 && (
        <section id="tareas" className="scroll-mt-6 space-y-3">
          <h2 className="text-xl font-extrabold text-gray-900">🧭 Paso a paso de las tareas más comunes</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {flujos.map((f) => (
              <div key={f.titulo} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="mb-3 text-base font-black text-gray-900">
                  <span aria-hidden className="mr-1.5">
                    {f.icono}
                  </span>
                  {f.titulo}
                </p>
                <ol className="space-y-2">
                  {f.pasos.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-[11px] font-black text-white">{i + 1}</span>
                      <span>
                        {s.texto}
                        {s.href && (
                          <Link href={s.href} className="ml-1 font-bold text-blue-600 hover:underline">
                            Ir →
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      <BuscadorAyuda guia={guia} glosario={glosario} />

      <section id="roles" className="scroll-mt-6 space-y-3">
        <h2 className="text-xl font-extrabold text-gray-900">🔐 ¿Qué puede hacer cada rol?</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r} className={`rounded-2xl border bg-white p-4 shadow-sm ${r === usuario.rol ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}`}>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase ${ROL_COLOR[r]}`}>{ROL_ETIQUETAS[r]}</span>
              {r === usuario.rol && <span className="ml-2 text-[11px] font-black text-blue-600">← tú</span>}
              <p className="mt-2 text-sm text-gray-600">{ROL_DESCRIPCION[r]}</p>
            </div>
          ))}
        </div>
        {p("usuarios.gestionar") && (
          <Link href="/usuarios" className="inline-block text-sm font-bold text-blue-600 hover:underline">
            Ver la matriz completa de permisos en Usuarios y roles →
          </Link>
        )}
      </section>
    </div>
  )
}

import { obtenerUsuarioActual } from "@/lib/auth"
import { cerrarSesion } from "@/app/login/actions"
import { ROL_COLOR, ROL_ETIQUETAS, puede } from "@/lib/permisos"
import { MenuLateralCliente, type GrupoMenu } from "./MenuLateralCliente"

export async function MenuLateral() {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return null

  const p = (permiso: Parameters<typeof puede>[1]) => puede(usuario.rol, permiso)

  const grupos: GrupoMenu[] = [
    {
      titulo: "",
      enlaces: [{ href: "/", icono: "🏠", etiqueta: "Inicio", ayuda: "Resumen del día y accesos rápidos", visible: true }],
    },
 {
      titulo: "Atención",
      enlaces: [
        { href: "/agenda", icono: "📅", etiqueta: "Agenda", ayuda: "Citas, llegadas y recordatorios", visible: p("agenda.ver") },
        { href: "/pacientes", icono: "🧑‍⚕️", etiqueta: "Pacientes", ayuda: "Fichas, tratamientos y pagos", visible: p("pacientes.ver") },
        { href: "/agenda/inasistencias", icono: "🚫", etiqueta: "Inasistencias", ayuda: "Pacientes que faltaron: contacto y reagendamiento", visible: p("agenda.gestionar") },
        { href: "/citas-consentimiento", icono: "✍️", etiqueta: "Consentimientos", ayuda: "Enviar a firma por correo o WhatsApp", visible: p("consentimientos.gestionar") },
        { href: "/presupuestos-pendientes", icono: "📋", etiqueta: "Presupuestos", ayuda: "Planes activos sin aprobar y seguimiento", visible: p("presupuestos.gestionar") || p("agenda.gestionar") },
      ],
    },
    {
      titulo: "Finanzas",
      enlaces: [
        { href: "/caja", icono: "💰", etiqueta: "Caja", ayuda: "Abrir, movimientos, arqueo y cierre", visible: p("caja.gestionar") },
        { href: "/fonasa-convenios", icono: "🏥", etiqueta: "FONASA y convenios", ayuda: "Bonos, convenios y cuotas", visible: p("fonasa.gestionar") },
        {
          href: "/pagos-pendientes",
          icono: "💳",
          etiqueta: "Pagos pendientes",
          ayuda: "Saldos por cobrar y recordatorios por WhatsApp",
          visible: p("pagos.registrar") || p("caja.gestionar") || usuario.rol === "DENTISTA",
        },
        {
          href: "/liquidaciones",
          icono: "👩‍⚕️",
          etiqueta: p("liquidaciones.gestionar") ? "Liquidaciones" : "Mis liquidaciones",
          ayuda: "Pago a dentistas según su %",
          visible: p("liquidaciones.ver"),
        },
        {
          href: "/reportes/desempeno",
          icono: "📊",
          etiqueta: p("reportes.ver") ? "Reporte de desempeño" : "Mi desempeño",
          ayuda: "Asistencia, ocupación y producción por dentista",
          visible: p("reportes.ver") || usuario.rol === "DENTISTA",
        },
      ],
    },
    {
      titulo: "Configuración",
      enlaces: [
        { href: "/perfil", icono: "👤", etiqueta: "Mi Perfil", ayuda: "Datos personales, firma y contraseña", visible: true },
        { href: "/prestaciones", icono: "🦷", etiqueta: "Prestaciones y precios", ayuda: "Catálogo, aranceles y códigos", visible: p("prestaciones.ver") },
        { href: "/agenda/configuracion", icono: "🕘", etiqueta: "Horarios y boxes", ayuda: "Cuándo atiende cada dentista", visible: p("agenda.configurar") },
        { href: "/usuarios", icono: "🔐", etiqueta: "Usuarios y roles", ayuda: "Cuentas y permisos", visible: p("usuarios.gestionar") },
        { href: "/administracion", icono: "⚙️", etiqueta: "Administración", ayuda: "Catálogos, métodos de pago y parámetros", visible: p("administracion.gestionar") },
        { href: "/administracion/plantillas", icono: "📋", etiqueta: "Plantillas y Consentimientos", ayuda: "Consentimientos informados y plantillas con variables", visible: p("plantillas.gestionar") },
        { href: "/administracion/auditoria", icono: "🛡️", etiqueta: "Auditoría y accesos", ayuda: "Bitácora de cambios y accesos a fichas", visible: p("auditoria.ver") },
      ],
    },
    {
      titulo: "Ayuda",
      enlaces: [{ href: "/ayuda", icono: "❓", etiqueta: "Centro de ayuda", ayuda: "¿Dónde se cambia…? y glosario", visible: true }],
    },
  ]
    .map((g) => ({ ...g, enlaces: g.enlaces.filter((e) => e.visible) }))
    .filter((g) => g.enlaces.length > 0)

  return (
    <MenuLateralCliente
      grupos={grupos}
      usuario={{ nombre: usuario.nombre_completo, email: usuario.email, rol: ROL_ETIQUETAS[usuario.rol], colorRol: ROL_COLOR[usuario.rol] }}
      salir={
        <form action={cerrarSesion}>
          <button className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-bold text-gray-500 hover:bg-rose-50 hover:text-rose-600">↩ Cerrar sesión</button>
        </form>
      }
    />
  )
}
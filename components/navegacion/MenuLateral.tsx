import { obtenerUsuarioActual } from "@/lib/auth"
import { cerrarSesion } from "@/app/login/actions"
import { ROL_COLOR, ROL_ETIQUETAS, puede } from "@/lib/permisos"
import { MenuLateralCliente, type GrupoMenu } from "./MenuLateralCliente"

export async function MenuLateral() {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return null

  const p = (permiso: Parameters<typeof puede>[1]) => puede(usuario.rol, permiso)

  const admin = usuario.rol === "ADMINISTRADOR"
  const verPagosPendientes = p("pagos.registrar") || p("caja.gestionar") || usuario.rol === "DENTISTA"

  const grupos: GrupoMenu[] = [
    {
      titulo: "",
      enlaces: [
        { href: "/", icono: "🏠", etiqueta: "Inicio", ayuda: "Resumen del día y accesos rápidos", visible: true },
        { href: "/agenda", icono: "📅", etiqueta: "Agenda", ayuda: "Citas, llegadas, bloqueos y recordatorios", visible: p("agenda.ver") },
        { href: "/pacientes", icono: "🧑‍⚕️", etiqueta: "Pacientes", ayuda: "Fichas, tratamientos y pagos", visible: p("pacientes.ver") },
        { href: "/caja", icono: "💰", etiqueta: "Cajas", ayuda: "Abrir, movimientos, arqueo y cierre", visible: p("caja.gestionar") },
        { href: "/seguimiento", icono: "🔎", etiqueta: "Seguimiento", ayuda: "Inasistencias, presupuestos y saldos por contactar", visible: true },
        { href: "/perfil", icono: "👤", etiqueta: "Perfil", ayuda: "Datos personales, firma y contraseña", visible: true },
      ],
    },
    {
      titulo: "Mi menú",
      enlaces: [
        { href: "/agenda/inasistencias", icono: "🚫", etiqueta: "Inasistencias", ayuda: "Pacientes que faltaron: contacto y reagendamiento", visible: p("agenda.gestionar") },
        { href: "/citas-consentimiento", icono: "✍️", etiqueta: "Enviar consentimientos", ayuda: "Firma presencial o por correo y WhatsApp", visible: p("consentimientos.gestionar") },
        { href: "/fonasa-convenios", icono: "🏥", etiqueta: "FONASA y convenios", ayuda: "Bonos, convenios y cuotas", visible: p("fonasa.gestionar") && !admin },
        { href: "/liquidaciones", icono: "👩‍⚕️", etiqueta: "Mis liquidaciones", ayuda: "Pago según tu porcentaje", visible: p("liquidaciones.ver") && !admin },
        { href: "/prestaciones", icono: "🦷", etiqueta: "Ver aranceles", ayuda: "Prestaciones y precios por arancel", visible: p("prestaciones.ver") && !admin },
        { href: "/presupuestos-pendientes", icono: "📋", etiqueta: "Presupuestos sin aprobar", ayuda: "Planes pendientes y seguimiento", visible: p("presupuestos.gestionar") || p("agenda.gestionar") },
        { href: "/pagos-pendientes", icono: "💳", etiqueta: "Pagos pendientes", ayuda: "Saldos por cobrar y recordatorios por WhatsApp", visible: verPagosPendientes && !admin },
      ],
    },
    {
      titulo: "Reportes",
      enlaces: [
        {
          href: "/reportes/desempeno",
          icono: "📊",
          etiqueta: p("reportes.ver") ? "Desempeño" : "Mi desempeño",
          ayuda: "Asistencia, ocupación y producción por dentista",
          visible: p("reportes.ver") || usuario.rol === "DENTISTA",
        },
        { href: "/reportes/exportar", icono: "📥", etiqueta: "Exportar Excel", ayuda: "Citas, pagos y pacientes en planilla", visible: p("reportes.ver") },
      ],
    },
    {
      titulo: "Administración",
      enlaces: [
        { href: "/administracion", icono: "🏢", etiqueta: "Clínica", ayuda: "Datos de la clínica y parámetros", visible: p("administracion.gestionar") },
        { href: "/usuarios", icono: "🔐", etiqueta: "Personal", ayuda: "Cuentas, roles y permisos", visible: p("usuarios.gestionar") },
        { href: "/administracion#especialidades", icono: "🎓", etiqueta: "Especialidades", ayuda: "Especialidades de los profesionales", visible: p("administracion.gestionar") },
        { href: "/fonasa-convenios", icono: "🏥", etiqueta: "Convenios", ayuda: "FONASA, convenios y cuotas", visible: admin && (p("fonasa.gestionar") || p("convenios.configurar")) },
        { href: "/agenda/configuracion", icono: "🚪", etiqueta: "Gestión de box", ayuda: "Boxes, horarios y bloqueos", visible: p("agenda.configurar") },
        { href: "/administracion#laboratorios", icono: "🧪", etiqueta: "Laboratorios", ayuda: "Laboratorios dentales externos", visible: p("administracion.gestionar") },
        { href: "/liquidaciones", icono: "👩‍⚕️", etiqueta: "Liquidaciones", ayuda: "Pago a dentistas según su %", visible: admin && p("liquidaciones.ver") },
        { href: "/pagos-pendientes", icono: "💳", etiqueta: "Pagos pendientes", ayuda: "Saldos por cobrar de todos los pacientes", visible: admin && verPagosPendientes },
        { href: "/administracion/auditoria", icono: "🛡️", etiqueta: "Auditoría y accesos", ayuda: "Bitácora de cambios, firmas y accesos a fichas", visible: p("auditoria.ver") },
      ],
    },
    {
      titulo: "Configuración",
      enlaces: [
        { href: "/prestaciones", icono: "🦷", etiqueta: "Aranceles y precios", ayuda: "Catálogo de prestaciones, aranceles y códigos", visible: admin && p("prestaciones.ver") },
        { href: "/administracion/plantillas", icono: "📝", etiqueta: "Plantillas", ayuda: "Plantillas de documentos con variables", visible: p("plantillas.gestionar") },
        { href: "/administracion#bancos", icono: "🏦", etiqueta: "Bancos", ayuda: "Bancos para transferencias y cheques", visible: p("administracion.gestionar") },
        { href: "/administracion#metodos-pago", icono: "💳", etiqueta: "Métodos de pago", ayuda: "Formas de pago aceptadas en caja", visible: p("administracion.gestionar") },
        { href: "/administracion/plantillas?tipo=documentos", icono: "📄", etiqueta: "Docs clínicos", ayuda: "Certificados, indicaciones y derivaciones", visible: p("plantillas.gestionar") },
        { href: "/administracion/plantillas?tipo=consentimientos", icono: "✍️", etiqueta: "Consentimientos", ayuda: "Textos de los consentimientos informados", visible: p("plantillas.gestionar") },
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
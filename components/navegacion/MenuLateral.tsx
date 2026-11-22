import { obtenerUsuarioActual } from "@/lib/auth"
import { cerrarSesion } from "@/app/login/actions"
import { ROL_ETIQUETAS, puede } from "@/lib/permisos"
import { MenuLateralCliente, type GrupoMenu } from "./MenuLateralCliente"

export async function MenuLateral() {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return null

  const p = (permiso: Parameters<typeof puede>[1]) => puede(usuario.rol, permiso)
  const admin = usuario.rol === "ADMINISTRADOR"
  const verPagosPendientes = p("pagos.registrar") || p("caja.gestionar") || usuario.rol === "DENTISTA"
  const gestionarAdmin = p("administracion.gestionar")

  const grupos: GrupoMenu[] = [
    {
      titulo: "",
      enlaces: [
        { href: "/", icono: "inicio", etiqueta: "Inicio", ayuda: "Resumen del día y accesos rápidos", visible: true },
        { href: "/agenda", icono: "agenda", etiqueta: "Agenda", ayuda: "Citas, llegadas, bloqueos y recordatorios", visible: p("agenda.ver") },
        { href: "/pacientes", icono: "pacientes", etiqueta: "Pacientes", ayuda: "Fichas, tratamientos y pagos", visible: p("pacientes.ver") },
        { href: "/caja", icono: "caja", etiqueta: "Cajas", ayuda: "Abrir, movimientos, arqueo y cierre", visible: p("caja.gestionar") },
        { href: "/seguimiento", icono: "seguimiento", etiqueta: "Seguimiento", ayuda: "Inasistencias, presupuestos y saldos por contactar", visible: true },
        { href: "/perfil", icono: "perfil", etiqueta: "Perfil", ayuda: "Datos personales, firma y contraseña", visible: true },
      ],
    },
    {
      titulo: "Mi menú",
      enlaces: [
        { href: "/agenda/inasistencias", icono: "inasistencias", etiqueta: "Inasistencias", ayuda: "Pacientes que faltaron: contacto y reagendamiento", visible: p("agenda.gestionar") },
        { href: "/citas-consentimiento", icono: "firma", etiqueta: "Enviar consentimientos", ayuda: "Firma presencial o por correo y WhatsApp", visible: p("consentimientos.gestionar") },
        { href: "/fonasa-convenios", icono: "convenios", etiqueta: "FONASA y convenios", ayuda: "Bonos, convenios y cuotas", visible: p("fonasa.gestionar") && !admin },
        { href: "/liquidaciones", icono: "liquidaciones", etiqueta: "Mis liquidaciones", ayuda: "Pago según tu porcentaje", visible: p("liquidaciones.ver") && !admin },
        { href: "/prestaciones", icono: "aranceles", etiqueta: "Ver aranceles", ayuda: "Prestaciones y precios por arancel", visible: p("prestaciones.ver") && !admin },
        { href: "/presupuestos-pendientes", icono: "presupuestos", etiqueta: "Presupuestos sin aprobar", ayuda: "Planes pendientes y seguimiento", visible: p("presupuestos.gestionar") || p("agenda.gestionar") },
        { href: "/pagos-pendientes", icono: "pagos", etiqueta: "Pagos pendientes", ayuda: "Saldos por cobrar y recordatorios por WhatsApp", visible: verPagosPendientes && !admin },
      ],
    },
    {
      titulo: "Reportes",
      enlaces: [
        {
          href: "/reportes/desempeno",
          icono: "reportes",
          etiqueta: p("reportes.ver") ? "Desempeño" : "Mi desempeño",
          ayuda: "Asistencia, ocupación y producción por dentista",
          visible: p("reportes.ver") || usuario.rol === "DENTISTA",
        },
        { href: "/reportes/exportar", icono: "excel", etiqueta: "Exportar Excel", ayuda: "Citas, pagos y pacientes en planilla", visible: p("reportes.ver") },
      ],
    },
    {
      titulo: "Administración",
      enlaces: [
        { href: "/administracion", icono: "administracion", etiqueta: "Resumen", ayuda: "Todas las secciones de administración", visible: gestionarAdmin },
        { href: "/administracion/parametros", icono: "clinica", etiqueta: "Clínica", ayuda: "Datos de la clínica y parámetros", visible: gestionarAdmin },
        { href: "/usuarios", icono: "personal", etiqueta: "Personal", ayuda: "Cuentas, roles y permisos", visible: p("usuarios.gestionar") },
        { href: "/administracion/especialidades", icono: "especialidades", etiqueta: "Especialidades", ayuda: "Especialidades de los profesionales", visible: gestionarAdmin },
        { href: "/administracion/previsiones", icono: "previsiones", etiqueta: "Previsiones", ayuda: "FONASA, Isapres y otras", visible: gestionarAdmin },
        { href: "/fonasa-convenios", icono: "convenios", etiqueta: "Convenios", ayuda: "FONASA, convenios y cuotas", visible: admin && (p("fonasa.gestionar") || p("convenios.configurar")) },
        { href: "/agenda/configuracion", icono: "box", etiqueta: "Gestión de box", ayuda: "Horarios de atención y bloqueos", visible: p("agenda.configurar") },
        { href: "/administracion/laboratorios", icono: "laboratorios", etiqueta: "Laboratorios", ayuda: "Laboratorios dentales externos", visible: gestionarAdmin },
        { href: "/liquidaciones", icono: "liquidaciones", etiqueta: "Liquidaciones", ayuda: "Pago a dentistas", visible: admin && p("liquidaciones.ver") },
        { href: "/pagos-pendientes", icono: "pagos", etiqueta: "Pagos pendientes", ayuda: "Saldos por cobrar de todos los pacientes", visible: admin && verPagosPendientes },
        { href: "/administracion/registro-cambios", icono: "historial", etiqueta: "Registro de cambios", ayuda: "Quién cambió cada configuración", visible: gestionarAdmin },
        { href: "/administracion/auditoria", icono: "auditoria", etiqueta: "Auditoría y accesos", ayuda: "Bitácora clínica, firmas y accesos a fichas", visible: p("auditoria.ver") },
      ],
    },
    {
      titulo: "Configuración",
      enlaces: [
        { href: "/prestaciones", icono: "aranceles", etiqueta: "Aranceles y precios", ayuda: "Catálogo de prestaciones, aranceles y códigos", visible: admin && p("prestaciones.ver") },
        { href: "/administracion/categorias", icono: "carpetas", etiqueta: "Carpetas de prestaciones", ayuda: "Categorías y su pago: 100% doctor, 100% clínica o x%", visible: gestionarAdmin },
        { href: "/administracion/tipos-atencion", icono: "tipos", etiqueta: "Tipos de atención", ayuda: "Clasificación y duración de las citas", visible: gestionarAdmin },
        { href: "/administracion/boxes", icono: "box", etiqueta: "Boxes", ayuda: "Salas o sillones de atención", visible: gestionarAdmin },
        { href: "/administracion/metodos-pago", icono: "metodos", etiqueta: "Métodos de pago", ayuda: "Formas de pago aceptadas en caja", visible: gestionarAdmin },
        { href: "/administracion/bancos", icono: "bancos", etiqueta: "Bancos", ayuda: "Bancos para transferencias y cheques", visible: gestionarAdmin },
        { href: "/administracion/plantillas", icono: "plantillas", etiqueta: "Plantillas", ayuda: "Plantillas de documentos con variables", visible: p("plantillas.gestionar") },
        { href: "/administracion/plantillas?tipo=documentos", icono: "documentos", etiqueta: "Docs clínicos", ayuda: "Certificados, indicaciones y derivaciones", visible: p("plantillas.gestionar") },
        { href: "/administracion/plantillas?tipo=consentimientos", icono: "firma", etiqueta: "Consentimientos", ayuda: "Textos de los consentimientos informados", visible: p("plantillas.gestionar") },
      ],
    },
    {
      titulo: "Ayuda",
      enlaces: [{ href: "/ayuda", icono: "ayuda", etiqueta: "Centro de ayuda", ayuda: "¿Dónde se cambia…? y glosario", visible: true }],
    },
  ]
    .map((g) => ({ ...g, enlaces: g.enlaces.filter((e) => e.visible) }))
    .filter((g) => g.enlaces.length > 0)

  return (
    <MenuLateralCliente
      grupos={grupos}
      usuario={{ nombre: usuario.nombre_completo, email: usuario.email, rol: ROL_ETIQUETAS[usuario.rol] }}
      salir={
        <form action={cerrarSesion}>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </button>
        </form>
      }
    />
  )
}

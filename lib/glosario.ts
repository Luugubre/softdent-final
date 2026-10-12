export type EntradaGlosario = {
  termino: string
  definicion: string
  modulo: string
  donde?: { etiqueta: string; href: string }
}

export const GLOSARIO = {
  ficha: {
    termino: "Ficha",
    modulo: "Pacientes",
    definicion: "Registro completo del paciente: datos personales, antecedentes, evoluciones, RX, tratamientos y pagos. Cada paciente tiene un N° de ficha único.",
    donde: { etiqueta: "Pacientes", href: "/pacientes" },
  },
  prevision: {
    termino: "Previsión",
    modulo: "Pacientes",
    definicion: "Sistema de salud del paciente (FONASA, Isapre, particular…). Define qué arancel se le sugiere al crear un tratamiento.",
    donde: { etiqueta: "Administración › Previsiones", href: "/administracion#previsiones" },
  },
  odontograma: {
    termino: "Odontograma",
    modulo: "Pacientes",
    definicion: "Dibujo de las piezas dentales donde el dentista marca hallazgos y planifica prestaciones por pieza y cara.",
  },
  evolucion: {
    termino: "Evolución",
    modulo: "Pacientes",
    definicion: "Registro clínico de lo que se hizo en una sesión. Al evolucionar una prestación se indica su avance (25%, 50%, 75% o 100%).",
  },
  avance: {
    termino: "Avance",
    modulo: "Tratamientos",
    definicion: "Porcentaje realizado de una prestación. Cuando llega al 100% queda terminada y, si además está pagada, se puede liquidar al dentista.",
  },

  prestacion: {
    termino: "Prestación",
    modulo: "Prestaciones",
    definicion: "Cada procedimiento que ofrece la clínica (destartraje, resina, endodoncia…), con su código, duración y precio.",
    donde: { etiqueta: "Prestaciones", href: "/prestaciones" },
  },
  arancel: {
    termino: "Arancel",
    modulo: "Prestaciones",
    definicion: "Lista de precios. Hay arancel particular, FONASA y uno por cada convenio. El precio de cada prestación depende del arancel del tratamiento.",
    donde: { etiqueta: "Prestaciones › Aranceles y categorías", href: "/prestaciones/configuracion" },
  },
  codigo_fonasa: {
    termino: "Código FONASA",
    modulo: "Prestaciones",
    definicion: "Código oficial de FONASA para la prestación. Solo las prestaciones con código FONASA pueden pagarse con bono.",
    donde: { etiqueta: "Prestaciones › editar prestación", href: "/prestaciones" },
  },
  fase: {
    termino: "Fase",
    modulo: "Tratamientos",
    definicion: "Etapa de un presupuesto (ej. Fase 1: Higiene, Fase 2: Operatoria). Agrupa prestaciones y muestra su subtotal en el presupuesto impreso.",
  },
  tratamiento: {
    termino: "Tratamiento",
    modulo: "Tratamientos",
    definicion: "Plan (presupuesto) de un paciente: conjunto de prestaciones con un arancel. Se paga por prestación y se evoluciona por prestación.",
  },

  abono: {
    termino: "Abono",
    modulo: "Pagos",
    definicion: "Dinero aplicado a una prestación. Puede abonarse antes de realizarla (anticipo).",
  },
  deuda: {
    termino: "Deuda",
    modulo: "Pagos",
    definicion: "Lo que el paciente ya recibió (prestaciones realizadas) y todavía no paga.",
  },
  saldo: {
    termino: "Saldo del tratamiento",
    modulo: "Pagos",
    definicion: "Lo que falta pagar del tratamiento completo, incluyendo prestaciones que aún no se realizan.",
  },
  anular: {
    termino: "Anular",
    modulo: "General",
    definicion: "En SoftDent nada se borra: se anula con un motivo. Queda registrado quién, cuándo y por qué, y se revierten sus efectos (abonos, caja…).",
  },
  metodo_pago: {
    termino: "Método de pago",
    modulo: "Pagos",
    definicion: "Forma en que se recibe el dinero (efectivo, débito, transferencia…). Cada método indica si pide N° de operación y si entra a la caja.",
    donde: { etiqueta: "Administración › Métodos de pago", href: "/administracion#metodos-pago" },
  },
  entra_caja: {
    termino: "Entra a caja",
    modulo: "Pagos",
    definicion: "Si está marcado, los pagos con ese método exigen una caja abierta y se registran solos como ingreso en ella. Ej.: Bono FONASA no entra a caja.",
    donde: { etiqueta: "Administración › Métodos de pago", href: "/administracion#metodos-pago" },
  },
  pide_referencia: {
    termino: "Pide N° de operación",
    modulo: "Pagos",
    definicion: "Obliga a ingresar el N° de voucher, transferencia o cheque al registrar un pago con ese método.",
  },
  es_efectivo: {
    termino: "Efectivo",
    modulo: "Caja",
    definicion: "Dinero físico. Es lo único que se cuenta en el arqueo al cerrar la caja.",
  },

  caja: {
    termino: "Caja",
    modulo: "Caja",
    definicion: "Turno de recaudación. Se abre con un monto inicial, recibe los pagos del día y se cierra con un arqueo. Solo puede haber una abierta a la vez.",
    donde: { etiqueta: "Caja", href: "/caja" },
  },
  monto_inicial: {
    termino: "Monto inicial",
    modulo: "Caja",
    definicion: "Efectivo con que parte la caja (el sencillo para dar vuelto).",
  },
  movimiento: {
    termino: "Movimiento",
    modulo: "Caja",
    definicion: "Entrada (ingreso) o salida (egreso) de dinero. Puede ser manual, un pago de paciente, una cuota de convenio, el pago de una liquidación o un ajuste.",
  },
  arqueo: {
    termino: "Arqueo",
    modulo: "Caja",
    definicion: "Contar el efectivo que hay físicamente en la caja y compararlo con lo que el sistema dice que debería haber.",
  },
  esperado: {
    termino: "Efectivo esperado",
    modulo: "Caja",
    definicion: "Monto inicial + ingresos en efectivo − egresos en efectivo. Es lo que debería haber en la caja.",
  },
  diferencia: {
    termino: "Diferencia",
    modulo: "Caja",
    definicion: "Contado − esperado. Positiva = sobra dinero; negativa = falta. Si no es cero hay que justificarla para cerrar.",
  },
  ajuste: {
    termino: "Ajuste",
    modulo: "Caja",
    definicion: "Movimiento que corrige algo de una caja ya cerrada (por ejemplo, anular un pago que entró ayer). La caja cerrada no se modifica.",
  },

  liquidacion: {
    termino: "Liquidación",
    modulo: "Liquidaciones",
    definicion: "Cálculo de lo que se le paga a un dentista por su trabajo del mes, según su porcentaje.",
    donde: { etiqueta: "Liquidaciones", href: "/liquidaciones" },
  },
  porcentaje: {
    termino: "Porcentaje de liquidación",
    modulo: "Liquidaciones",
    definicion: "Parte del valor de cada prestación que gana el dentista (ej. 40% o 50%). El resto queda para la clínica.",
    donde: { etiqueta: "Liquidaciones › columna %", href: "/liquidaciones" },
  },
  produccion: {
    termino: "Producción",
    modulo: "Liquidaciones",
    definicion: "Valor total de las prestaciones que realizó el dentista.",
  },
  liquidable: {
    termino: "Liquidable",
    modulo: "Liquidaciones",
    definicion: "Prestación evolucionada al 100% y pagada al 100% que todavía no se le ha pagado al dentista. Solo eso entra en la liquidación.",
  },
  bonificacion: {
    termino: "Bonificación / Ajuste / Descuento",
    modulo: "Liquidaciones",
    definicion: "Montos extra de la liquidación: bonificación suma, descuento resta y ajuste corrige (positivo o negativo) errores de meses anteriores.",
  },
  estado_liquidacion: {
    termino: "Calculada → Aprobada → Pagada",
    modulo: "Liquidaciones",
    definicion: "Calculada: lista para revisar. Aprobada: revisada, lista para pagar. Pagada: ya se le pagó al dentista y no se puede modificar.",
  },

  bono: {
    termino: "Bono FONASA",
    modulo: "FONASA",
    definicion: "Documento con folio que emite FONASA y cubre parte del valor de una prestación. Al usarlo se abona solo a esa prestación.",
    donde: { etiqueta: "FONASA y convenios › Bonos", href: "/fonasa-convenios" },
  },
  folio: {
    termino: "Folio",
    modulo: "FONASA",
    definicion: "Número único del bono. Un folio no se puede registrar ni usar dos veces.",
  },
  copago: {
    termino: "Copago",
    modulo: "FONASA",
    definicion: "Parte que paga el paciente además de lo que cubre el bono.",
  },
  convenio: {
    termino: "Convenio",
    modulo: "Convenios",
    definicion: "Acuerdo con una empresa o sindicato que da un % de descuento. Al crearlo se crea su propio arancel con ese descuento.",
    donde: { etiqueta: "FONASA y convenios › Convenios", href: "/fonasa-convenios?tab=convenios" },
  },
  beneficiario: {
    termino: "Beneficiario",
    modulo: "Convenios",
    definicion: "Paciente adherido a un convenio. Solo los beneficiarios activos pueden usar el arancel del convenio.",
  },
  cuotas: {
    termino: "Contrato en cuotas",
    modulo: "Convenios",
    definicion: "Monto pactado con un convenio que se paga en cuotas con fecha de vencimiento. Las cuotas deben sumar exactamente el total.",
  },
  vigencia: {
    termino: "Vigencia",
    modulo: "Convenios",
    definicion: "Período en que el convenio es válido. Fuera de su vigencia no se puede usar su arancel.",
  },

  estado_cita: {
    termino: "Estados de la cita",
    modulo: "Agenda",
    definicion: "No confirmada → Confirmada → En espera (llegó) → En box (en atención) → Atendido. También: No asistió, Anulada y Reprogramada.",
  },
  sobrecupo: {
    termino: "Sobrecupo",
    modulo: "Agenda",
    definicion: "Cita agendada encima de otra o fuera del horario del dentista. Requiere permiso y un motivo.",
  },
  bloqueo: {
    termino: "Bloqueo",
    modulo: "Agenda",
    definicion: "Período en que no se puede agendar a un dentista (vacaciones, reunión, capacitación).",
  },
  box: {
    termino: "Box",
    modulo: "Agenda",
    definicion: "Sala o sillón de atención. Dos citas no pueden usar el mismo box a la misma hora.",
    donde: { etiqueta: "Agenda › Configuración", href: "/agenda/configuracion" },
  },
  horario: {
    termino: "Horario de atención",
    modulo: "Agenda",
    definicion: "Días y horas en que atiende cada dentista. Fuera de ese horario solo se puede agendar como sobrecupo.",
    donde: { etiqueta: "Agenda › Configuración", href: "/agenda/configuracion" },
  },
  tipo_atencion: {
    termino: "Tipo de atención",
    modulo: "Agenda",
    definicion: "Clasificación de la cita (primera consulta, control, urgencia…) con una duración sugerida.",
    donde: { etiqueta: "Administración › Tipos de atención", href: "/administracion#tipos_atencion" },
  },
  hoja_ruta: {
    termino: "Hoja de ruta",
    modulo: "Agenda",
    definicion: "Listado imprimible de las citas del día por dentista, con teléfono, motivo y lo que tiene por cobrar cada paciente.",
  },

  rol: {
    termino: "Rol",
    modulo: "Usuarios",
    definicion: "Define qué puede hacer cada usuario: Administrador, Dentista, Asistente dental o Recepcionista.",
    donde: { etiqueta: "Usuarios y roles", href: "/usuarios" },
  },
  catalogo: {
    termino: "Catálogo",
    modulo: "Administración",
    definicion: "Lista de opciones que se usan en otras pantallas (previsiones, tipos de atención, especialidades, boxes…). Lo que ya se usó no se borra: se desactiva.",
    donde: { etiqueta: "Administración", href: "/administracion" },
  },
  parametro: {
    termino: "Parámetro",
    modulo: "Administración",
    definicion: "Valor de configuración general (nombre de la clínica, minutos de inactividad…). Cada uno tiene un rango permitido.",
    donde: { etiqueta: "Administración › Parámetros", href: "/administracion#parametros" },
  },
  auditoria: {
    termino: "Registro de cambios",
    modulo: "Administración",
    definicion: "Historial de quién cambió qué configuración, cuándo, y cuál era el valor anterior.",
    donde: { etiqueta: "Administración › Registro de cambios", href: "/administracion#auditoria" },
  },
} satisfies Record<string, EntradaGlosario>

export type TerminoId = keyof typeof GLOSARIO

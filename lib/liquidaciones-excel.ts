import { crearExcel, type Celda, type Hoja } from "@/lib/excel"
import { formatearFecha, formatearFechaHora } from "@/lib/formato"
import { fechaChile, montoProfesional, motivoEspera } from "@/lib/liquidaciones"
import { ESTADO_LIQUIDACION, METODO_LIQUIDACION, nombrePeriodo, type DetalleLiquidacion, type Liquidacion, type Produccion } from "@/types/liquidacion"

const fecha = (iso: string | null | undefined) => (iso ? formatearFecha(fechaChile(iso)) : "")
const fechaHora = (iso: string | null | undefined) => (iso ? formatearFechaHora(iso) : "")
const periodo = (p: string | null) => {
  const n = nombrePeriodo(p)
  return n === "—" ? "" : n.charAt(0).toUpperCase() + n.slice(1)
}
const baseProfesional = (l: Liquidacion) => l.base_profesional ?? l.total
const totalClinica = (l: Liquidacion) => l.total_clinica ?? l.total_base - baseProfesional(l)

function hojaLiquidaciones(liquidaciones: Liquidacion[], clinica: string, subtitulo: string): Hoja {
  const vigentes = liquidaciones.filter((l) => l.estado !== "ANULADA")
  const suma = (fn: (l: Liquidacion) => number) => vigentes.reduce((s, l) => s + fn(l), 0)
  return {
    nombre: "Liquidaciones",
    titulo: `${clinica} · Liquidaciones de profesionales`,
    subtitulo,
    columnas: [
      { titulo: "N°", ancho: 8, tipo: "numero" },
      { titulo: "Profesional", ancho: 28 },
      { titulo: "Período", ancho: 20 },
      { titulo: "Emitida", ancho: 23 },
      { titulo: "Estado", ancho: 22 },
      { titulo: "Prestaciones", ancho: 13, tipo: "numero" },
      { titulo: "Producción", ancho: 14, tipo: "pesos" },
      { titulo: "% profesional", ancho: 13, tipo: "porcentaje" },
      { titulo: "Base profesional", ancho: 16, tipo: "pesos" },
      { titulo: "Bonificación", ancho: 14, tipo: "pesos" },
      { titulo: "Ajuste", ancho: 12, tipo: "pesos" },
      { titulo: "Descuento", ancho: 13, tipo: "pesos" },
      { titulo: "Total a pagar", ancho: 15, tipo: "pesos" },
      { titulo: "Para la clínica", ancho: 15, tipo: "pesos" },
      { titulo: "Aprobada", ancho: 23 },
      { titulo: "Pagada", ancho: 23 },
      { titulo: "Método de pago", ancho: 15 },
      { titulo: "N° operación", ancho: 15 },
    ],
    filas: liquidaciones.map((l): Celda[] => [
      l.numero,
      l.profesional?.nombre_completo ?? "",
      periodo(l.periodo),
      fechaHora(l.created_at),
      ESTADO_LIQUIDACION[l.estado].etiqueta,
      l.cantidad,
      l.total_base,
      l.porcentaje,
      baseProfesional(l),
      l.bonificacion,
      l.ajuste,
      l.descuento,
      l.total,
      totalClinica(l),
      fechaHora(l.fecha_aprobacion),
      fechaHora(l.fecha_pago),
      l.metodo_pago ? METODO_LIQUIDACION[l.metodo_pago] : "",
      l.referencia_pago ?? "",
    ]),
    totales:
      liquidaciones.length > 0
        ? [
            "Total",
            "(sin anuladas)",
            "",
            "",
            "",
            suma((l) => l.cantidad),
            suma((l) => l.total_base),
            "",
            suma(baseProfesional),
            suma((l) => l.bonificacion),
            suma((l) => l.ajuste),
            suma((l) => l.descuento),
            suma((l) => l.total),
            suma(totalClinica),
            "",
            "",
            "",
            "",
          ]
        : undefined,
  }
}

function hojaPendiente(produccion: Produccion[], clinica: string): Hoja {
  const ordenada = [...produccion].sort(
    (a, b) => Number(b.liquidable) - Number(a.liquidable) || a.profesional_nombre.localeCompare(b.profesional_nombre) || a.fecha_avance.localeCompare(b.fecha_avance)
  )
  const listos = ordenada.filter((p) => p.liquidable)
  return {
    nombre: "Pendiente por liquidar",
    titulo: `${clinica} · Producción pendiente de liquidar`,
    subtitulo: "“Listo” = evolucionado al 100% y pagado al 100%. “En espera” indica qué falta para poder liquidarlo.",
    columnas: [
      { titulo: "Profesional", ancho: 26 },
      { titulo: "Estado", ancho: 12 },
      { titulo: "Paciente", ancho: 28 },
      { titulo: "Ficha", ancho: 8, tipo: "numero" },
      { titulo: "Prestación", ancho: 34 },
      { titulo: "Pieza", ancho: 8, tipo: "numero" },
      { titulo: "Tratamiento N°", ancho: 14, tipo: "numero" },
      { titulo: "Avance", ancho: 12 },
      { titulo: "Fecha avance", ancho: 13 },
      { titulo: "Valor del tramo", ancho: 15, tipo: "pesos" },
      { titulo: "% profesional", ancho: 13, tipo: "porcentaje" },
      { titulo: "Monto profesional", ancho: 17, tipo: "pesos" },
      { titulo: "Qué falta", ancho: 40 },
    ],
    filas: ordenada.map((p): Celda[] => [
      p.profesional_nombre,
      p.liquidable ? "Listo" : "En espera",
      p.paciente_nombre,
      p.numero_ficha,
      p.prestacion_nombre,
      p.pieza,
      p.tratamiento_numero,
      `${p.progreso_anterior}% → ${p.progreso_nuevo}%`,
      fecha(p.fecha_avance),
      p.monto_base,
      p.porcentaje,
      montoProfesional(p.monto_base, p.porcentaje),
      p.liquidable ? "" : motivoEspera(p),
    ]),
    totales:
      ordenada.length > 0
        ? [
            "Total listo para liquidar",
            `${listos.length} tramo(s)`,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            listos.reduce((s, p) => s + p.monto_base, 0),
            "",
            listos.reduce((s, p) => s + montoProfesional(p.monto_base, p.porcentaje), 0),
            "",
          ]
        : undefined,
  }
}

export function libroLiquidaciones(liquidaciones: Liquidacion[], produccion: Produccion[], clinica: string, subtitulo: string) {
  return crearExcel([hojaLiquidaciones(liquidaciones, clinica, subtitulo), hojaPendiente(produccion, clinica)])
}

export function libroLiquidacion(l: Liquidacion, detalle: DetalleLiquidacion[], clinica: string) {
  const resumen: Hoja = {
    nombre: "Resumen",
    filtro: false,
    titulo: `${clinica} · Liquidación N° ${String(l.numero).padStart(6, "0")}`,
    subtitulo: "Liquidación de honorarios profesionales",
    columnas: [
      { titulo: "Concepto", ancho: 34 },
      { titulo: "Valor", ancho: 34, tipo: "pesos" },
    ],
    filas: [
      ["Profesional", l.profesional?.nombre_completo ?? ""],
      ["RUT", l.profesional?.rut ?? ""],
      ["Registro profesional", l.profesional?.registro_profesional ?? ""],
      ["Período", periodo(l.periodo)],
      ["Fecha de corte", formatearFecha(l.fecha_corte)],
      ["Estado", ESTADO_LIQUIDACION[l.estado].etiqueta],
      ["Prestaciones incluidas", String(l.cantidad)],
      ["Producción", l.total_base],
      ["% profesional", `${l.porcentaje}%`],
      ["% clínica", `${l.porcentaje_clinica ?? 100 - l.porcentaje}%`],
      ["Base profesional", baseProfesional(l)],
      ["Para la clínica", totalClinica(l)],
      ["+ Bonificación", l.bonificacion],
      ["± Ajuste", l.ajuste],
      ["− Descuento", l.descuento],
      ["Calculada por", `${l.creador?.nombre_completo ?? ""} · ${fechaHora(l.created_at)}`],
      ["Aprobada por", l.fecha_aprobacion ? `${l.aprobador?.nombre_completo ?? ""} · ${fechaHora(l.fecha_aprobacion)}` : ""],
      [
        "Pagada",
        l.fecha_pago
          ? `${fechaHora(l.fecha_pago)} · ${l.metodo_pago ? METODO_LIQUIDACION[l.metodo_pago] : ""}${l.referencia_pago ? ` · N° ${l.referencia_pago}` : ""}`
          : "",
      ],
      ...(l.estado === "ANULADA" ? [["Anulada", `${fechaHora(l.fecha_anulacion)} · ${l.motivo_anulacion ?? ""}`]] : []),
      ...(l.nota ? [["Nota", l.nota]] : []),
    ],
    totales: ["TOTAL A PAGAR AL PROFESIONAL", l.total],
  }

  const hojaDetalle: Hoja = {
    nombre: "Detalle",
    titulo: `Detalle de prestaciones · ${l.profesional?.nombre_completo ?? ""}`,
    subtitulo: `${periodo(l.periodo)} · ${l.porcentaje}% para el profesional`,
    columnas: [
      { titulo: "Paciente", ancho: 28 },
      { titulo: "Prestación", ancho: 34 },
      { titulo: "Pieza", ancho: 8, tipo: "numero" },
      { titulo: "Tramo", ancho: 14 },
      { titulo: "Terminada", ancho: 12 },
      { titulo: "Pagada", ancho: 12 },
      { titulo: "Valor", ancho: 14, tipo: "pesos" },
      { titulo: "%", ancho: 8, tipo: "porcentaje" },
      { titulo: "Monto profesional", ancho: 17, tipo: "pesos" },
    ],
    filas: detalle.map((d): Celda[] => [
      d.paciente_nombre,
      d.prestacion_nombre,
      d.pieza,
      d.tramo,
      fecha(d.fecha_realizado),
      fecha(d.fecha_pagado),
      d.monto_base,
      d.porcentaje,
      d.monto,
    ]),
    totales:
      detalle.length > 0
        ? ["Total", `${detalle.length} prestación(es)`, "", "", "", "", detalle.reduce((s, d) => s + d.monto_base, 0), "", detalle.reduce((s, d) => s + d.monto, 0)]
        : undefined,
  }

  return crearExcel([resumen, hojaDetalle])
}

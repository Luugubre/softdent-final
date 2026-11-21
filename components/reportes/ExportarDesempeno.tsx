"use client"

import { indicadores, type FilaDesempeno } from "@/lib/reportes-calculo"

export function ExportarDesempeno({ filas, desde, hasta }: { filas: FilaDesempeno[]; desde: string; hasta: string }) {
  function exportar() {
    const encabezado = [
      "Dentista", "Citas", "Atendidas", "No asistió", "Canceladas", "Pacientes", "Asistencia %", "Ocupación %",
      "Producción", "Presupuestos creados", "Presupuestos aprobados", "Recetas", "Documentos",
    ]
    const lineas = filas.map((f) => {
      const i = indicadores(f)
      return [
        f.profesional_nombre, f.citas_total, f.realizadas, f.no_asistio, f.canceladas, f.pacientes_atendidos,
        i.asistencia ?? "", i.ocupacion ?? "", f.produccion, f.presupuestos_creados, f.presupuestos_aprobados, f.recetas, f.documentos,
      ]
    })
    const celda = (v: string | number) => {
      let s = String(v)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return `"${s.replace(/"/g, '""')}"`
    }
    const csv = "﻿" + [encabezado, ...lineas].map((l) => l.map(celda).join(";")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `desempeno-${desde}-${hasta}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={filas.length === 0}
      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
    >
      ⬇️ Exportar CSV
    </button>
  )
}

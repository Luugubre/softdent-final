"use client"

import { useState } from "react"
import { SelectorMedicamentos, type MedicamentoCatalogo } from "@/components/recetas/SelectorMedicamentos"
import { AlertaAlergiaModal } from "@/components/recetas/AlertaAlergiaModal"
import { emitirReceta } from "@/app/recetas/actions"

export type MedicamentoItem = {
  id?: string
  medicamento: string
  presentacion: string
  dosis: string
  frecuencia: string
  duracion: string
  via: string
  cantidad: string
}

type PacienteOpt = {
  id: string
  nombre_completo: string
  rut: string
  antecedentes?: { categoria: string; detalle: string }[]
}

type DentistaOpt = {
  id: string
  nombre_completo: string
  rut: string
  especialidad: string
}

type Props = {
  catalogo: MedicamentoItem[]
  pacientes: PacienteOpt[]
  dentistas: DentistaOpt[]
  rolUsuario: string
}

export default function FormNuevaReceta({ catalogo, pacientes, dentistas, rolUsuario }: Props) {
  const [pacienteId, setPacienteId] = useState("")
  const [profesionalId, setProfesionalId] = useState("")
  const [diagnostico, setDiagnostico] = useState("")
  const [indicaciones, setIndicaciones] = useState("")
  const [items, setItems] = useState<MedicamentoItem[]>([])

  const esRecepcionista = rolUsuario === "RECEPCIONISTA" || rolUsuario === "RECEPCION" || rolUsuario === "ADMIN"

  const [medActual, setMedActual] = useState<MedicamentoItem>({
    medicamento: "",
    presentacion: "",
    dosis: "1 comprimido",
    frecuencia: "Cada 12 horas",
    duracion: "7 días",
    via: "Oral",
    cantidad: "1 caja",
  })

  const [alergiaConflicto, setAlergiaConflicto] = useState<{ alergia: string; medicamento: string } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recetaEmitidaId, setRecetaEmitidaId] = useState<string | null>(null)

  // Mapeo adaptado al tipo MedicamentoCatalogo del selector
  const catalogoTyped: MedicamentoCatalogo[] = catalogo.map((m) => ({
    id: m.id || m.medicamento,
    nombre: m.medicamento,
    medicamento: m.medicamento,
    presentacion: m.presentacion,
    dosis: m.dosis,
    frecuencia: m.frecuencia,
    duracion: m.duracion,
    via: m.via,
    cantidad: m.cantidad,
  } as unknown as MedicamentoCatalogo))

  const agregarMedicamentoConValidacion = (item: MedicamentoItem) => {
    const pacienteSeleccionado = pacientes.find((p) => p.id === pacienteId)
    const alergiasPaciente = pacienteSeleccionado?.antecedentes?.filter((a) => a.categoria === "ALERGIA") ?? []

    const conflicto = alergiasPaciente.find((a) =>
      item.medicamento.toLowerCase().includes(a.detalle.toLowerCase()) ||
      a.detalle.toLowerCase().includes(item.medicamento.toLowerCase())
    )

    if (conflicto) {
      setAlergiaConflicto({
        alergia: conflicto.detalle,
        medicamento: item.medicamento,
      })
    } else {
      setItems((prev) => [...prev, item])
      resetFormMedicamento()
    }
  }

  const resetFormMedicamento = () => {
    setMedActual({
      medicamento: "",
      presentacion: "",
      dosis: "1 comprimido",
      frecuencia: "Cada 12 horas",
      duracion: "7 días",
      via: "Oral",
      cantidad: "1 caja",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteId) return setError("Debes seleccionar un paciente")
    if (esRecepcionista && !profesionalId) return setError("Debes seleccionar el dentista emisor de la receta")
    if (items.length === 0) return setError("Debes agregar al menos un medicamento a la receta")

    setCargando(true)
    setError(null)

    const res = await emitirReceta({
      paciente_id: pacienteId,
      profesional_id: esRecepcionista ? profesionalId : undefined,
      diagnostico,
      indicaciones_generales: indicaciones,
      items,
    })

    setCargando(false)

    if (res.error) {
      setError(res.error)
    } else if (res.recetaId) {
      setRecetaEmitidaId(res.recetaId)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900">📄 Emitir Nueva Receta Médica</h1>
      </div>

      {/* Banner de Advertencia Legal */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs leading-relaxed">
        <span className="text-base leading-none">⚠️</span>
        <div>
          <strong className="font-bold">Aviso sobre el uso del Recetario Electrónico:</strong>
          <p className="mt-0.5 text-amber-800 font-medium">
            Este módulo está diseñado exclusivamente para la emisión de <strong>Recetas Médicas Simples</strong> (antibióticos, analgésicos, antiinflamatorios y fármacos de venta directa). Para medicamentos sujetos a control de stock, receta cheque o psicotrópicos con retención, utilice los talonarios oficiales autorizados por la SEREMI / MINSAL.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Selector de Paciente */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Paciente *</label>
            <select
              required
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              disabled={!!recetaEmitidaId}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
            >
              <option value="">-- Seleccionar Paciente --</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo} ({p.rut})
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Dentista (visible si el rol es Recepcionista / Admin) */}
          {esRecepcionista && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Dentista Emisor *</label>
              <select
                required
                value={profesionalId}
                onChange={(e) => setProfesionalId(e.target.value)}
                disabled={!!recetaEmitidaId}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
              >
                <option value="">-- Seleccionar Dentista --</option>
                {dentistas.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr(a). {d.nombre_completo} ({d.especialidad})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Diagnóstico */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Diagnóstico Clínico *</label>
          <input
            type="text"
            required
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
            disabled={!!recetaEmitidaId}
            placeholder="Ej: Periodontitis crónica, Pulpitis irreversible..."
            className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Indicaciones Generales */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Indicaciones Generales / Recomendaciones</label>
          <textarea
            value={indicaciones}
            onChange={(e) => setIndicaciones(e.target.value)}
            disabled={!!recetaEmitidaId}
            placeholder="Ej: Reposo relativo por 48 hrs, aplicar frío local, evitar alimentos calientes..."
            rows={2}
            className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Formulario de Fármacos */}
        {!recetaEmitidaId && (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">Agregar Fármaco</h3>
            <SelectorMedicamentos
              catalogo={catalogoTyped}
              onSeleccionar={(sel) => {
                const s = sel as unknown as Record<string, string>
                setMedActual((prev) => ({
                  ...prev,
                  medicamento: s.nombre || s.medicamento || prev.medicamento,
                  presentacion: s.presentacion || prev.presentacion,
                  dosis: s.dosis || prev.dosis,
                  frecuencia: s.frecuencia || prev.frecuencia,
                  duracion: s.duracion || prev.duracion,
                  via: s.via || prev.via,
                  cantidad: s.cantidad || prev.cantidad,
                }))
              }}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500">Medicamento</label>
                <input
                  type="text"
                  value={medActual.medicamento}
                  onChange={(e) => setMedActual({ ...medActual, medicamento: e.target.value })}
                  className="w-full rounded-lg border p-2 text-xs"
                  placeholder="Nombre"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500">Presentación</label>
                <input
                  type="text"
                  value={medActual.presentacion}
                  onChange={(e) => setMedActual({ ...medActual, presentacion: e.target.value })}
                  className="w-full rounded-lg border p-2 text-xs"
                  placeholder="Ej: Comprimidos 500mg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500">Dosis</label>
                <input
                  type="text"
                  value={medActual.dosis}
                  onChange={(e) => setMedActual({ ...medActual, dosis: e.target.value })}
                  className="w-full rounded-lg border p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500">Frecuencia</label>
                <input
                  type="text"
                  value={medActual.frecuencia}
                  onChange={(e) => setMedActual({ ...medActual, frecuencia: e.target.value })}
                  className="w-full rounded-lg border p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500">Duración</label>
                <input
                  type="text"
                  value={medActual.duracion}
                  onChange={(e) => setMedActual({ ...medActual, duracion: e.target.value })}
                  className="w-full rounded-lg border p-2 text-xs"
                  placeholder="Ej: 7 días"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500">Vía de Adm.</label>
                <input
                  type="text"
                  value={medActual.via}
                  onChange={(e) => setMedActual({ ...medActual, via: e.target.value })}
                  className="w-full rounded-lg border p-2 text-xs"
                  placeholder="Ej: Oral"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500">Cantidad Prescrita</label>
                <input
                  type="text"
                  value={medActual.cantidad}
                  onChange={(e) => setMedActual({ ...medActual, cantidad: e.target.value })}
                  className="w-full rounded-lg border p-2 text-xs"
                  placeholder="Ej: 1 caja"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => agregarMedicamentoConValidacion(medActual)}
              disabled={!medActual.medicamento}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              + Añadir a la Receta
            </button>
          </div>
        )}

        {/* Medicamentos prescritos */}
        {items.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700">Medicamentos prescritos ({items.length}):</h4>
            {items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                <div>
                  <strong className="text-gray-900">{it.medicamento}</strong> ({it.presentacion})
                  <p className="text-gray-500">{it.dosis} · {it.frecuencia} · {it.duracion} · Vía: {it.via} ({it.cantidad})</p>
                </div>
                {!recetaEmitidaId && (
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="text-rose-600 font-bold hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

        {/* Tarjeta de Confirmación / Botón Emisión */}
        {recetaEmitidaId ? (
          <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <h3 className="text-lg font-black text-emerald-900">¡Receta emitida con éxito!</h3>
            <p className="text-xs text-emerald-700 font-medium">
              La receta inmutable se ha registrado correctamente en el sistema.
            </p>

            <div className="flex justify-center gap-3 pt-2">
              <a
                href={`/recetas/${recetaEmitidaId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700 shadow-md transition-all"
              >
                🖨️ Imprimir / Guardar PDF
              </a>
              <button
                type="button"
                onClick={() => {
                  setRecetaEmitidaId(null)
                  setItems([])
                  setDiagnostico("")
                  setIndicaciones("")
                  setPacienteId("")
                  setProfesionalId("")
                }}
                className="rounded-xl bg-white border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                + Emitir Otra Receta
              </button>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={cargando || items.length === 0}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50"
          >
            {cargando ? "Guardando..." : "Emitir Receta Digital"}
          </button>
        )}
      </form>

      {/* Modal de Alerta de Alergia */}
      <AlertaAlergiaModal
        alergiaDetectada={alergiaConflicto?.alergia ?? null}
        medicamentoConflicto={alergiaConflicto?.medicamento ?? null}
        onConfirmar={() => {
          setItems((prev) => [...prev, medActual])
          setAlergiaConflicto(null)
          resetFormMedicamento()
        }}
        onCancelar={() => setAlergiaConflicto(null)}
      />
    </div>
  )
}
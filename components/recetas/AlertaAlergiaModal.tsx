"use client"

type Props = {
  alergiaDetectada: string | null
  medicamentoConflicto: string | null
  onConfirmar: () => void
  onCancelar: () => void
}

export function AlertaAlergiaModal({ alergiaDetectada, medicamentoConflicto, onConfirmar, onCancelar }: Props) {
  if (!alergiaDetectada || !medicamentoConflicto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border-2 border-rose-500">
        <div className="flex items-center gap-3 text-rose-600">
          <span className="text-3xl">⚠️</span>
          <div>
            <h3 className="text-lg font-black text-rose-900">¡Alerta Clínica de Alergia!</h3>
            <p className="text-xs font-semibold text-rose-700">El paciente presenta antecedentes de hipersensibilidad</p>
          </div>
        </div>

        <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-sm space-y-2">
          <p className="text-gray-800">
            Estás intentando agregar: <strong className="text-rose-900">{medicamentoConflicto}</strong>
          </p>
          <p className="text-gray-800">
            Alergia registrada en la ficha: <strong className="text-rose-900">{alergiaDetectada}</strong>
          </p>
        </div>

        <p className="text-xs text-gray-500">
          ¿Deseas incluir este medicamento bajo tu supervisión profesional o prefieres cancelar?
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancelar medicamento
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-700 shadow-sm transition-colors"
          >
            Agregar de todos modos
          </button>
        </div>
      </div>
    </div>
  )
}
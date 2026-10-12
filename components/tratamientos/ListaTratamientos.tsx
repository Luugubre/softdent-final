import Link from "next/link"
import { formatearFechaHora, formatearPesos } from "@/lib/formato"
import { ESTADO_TRATAMIENTO, type ResumenTratamiento } from "@/types/tratamiento"

export function ListaTratamientos({
  pacienteId,
  tratamientos,
  compacta = false,
}: {
  pacienteId: string
  tratamientos: ResumenTratamiento[]
  compacta?: boolean
}) {
  if (tratamientos.length === 0) {
    return <p className="py-6 text-center text-sm font-semibold text-gray-400">El paciente aún no tiene tratamientos.</p>
  }

  return (
    <div className={`grid grid-cols-1 gap-3 ${compacta ? "md:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2"}`}>
      {tratamientos.map((t) => {
        const estado = ESTADO_TRATAMIENTO[t.estado]
        return (
          <Link
            key={t.id}
            href={`/pacientes/${pacienteId}/tratamientos/${t.id}`}
            className={`block bg-white border rounded-2xl p-4 space-y-3 hover:border-blue-400 hover:shadow-md transition ${
              t.porPagar > 0 ? "border-orange-300" : "border-gray-200"
            } ${t.estado === "ANULADO" ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Tratamiento N° {t.numero}</p>
                <p className="text-base font-extrabold text-gray-900">{t.nombre}</p>
                <p className="text-xs font-medium text-gray-500">
                  {t.profesional ? `Dr.(a) ${t.profesional.nombre_completo} · ` : ""}
                  {formatearFechaHora(t.created_at).slice(0, 10)}
                  {t.arancel && ` · ${t.arancel.nombre}`}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${estado.estilo}`}>{estado.etiqueta}</span>
            </div>

            <div>
              <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                <div className={`h-full ${t.avance === 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${t.avance}%` }} />
              </div>
              <p className="mt-1 text-[11px] font-bold text-gray-500">
                {t.avance}% realizado · {t.cantidad} {t.cantidad === 1 ? "prestación" : "prestaciones"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400">Total</p>
                <p className="text-sm font-extrabold text-gray-900">{formatearPesos(t.total)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400">Abonado</p>
                <p className="text-sm font-extrabold text-gray-900">{formatearPesos(t.abonado)}</p>
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase ${t.porPagar > 0 ? "text-orange-600" : "text-gray-400"}`}>Por pagar</p>
                <p className={`text-sm font-extrabold ${t.porPagar > 0 ? "text-orange-700" : "text-gray-900"}`}>{formatearPesos(t.porPagar)}</p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

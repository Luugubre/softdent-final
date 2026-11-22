import { minutosAHora, rangoEnDia } from "@/lib/fechas-agenda"
import { TIPO_BLOQUEO, type BloqueoAgenda } from "@/types/cita"

export function BloqueosDelDia({ bloqueos, fecha, compacto = false }: { bloqueos: BloqueoAgenda[]; fecha: string; compacto?: boolean }) {
  const delDia = bloqueos
    .map((b) => ({ b, r: rangoEnDia(b.inicio, b.fin, fecha) }))
    .filter((x): x is { b: BloqueoAgenda; r: [number, number] } => x.r !== null)
  if (delDia.length === 0) return null
  return (
    <div className="space-y-1.5">
      {delDia.map(({ b, r }) => {
        const todoElDia = r[0] === 0 && r[1] === 1440
        const quien = b.profesional?.nombre_completo ?? (b.box ? `Box ${b.box.nombre}` : "Toda la clínica")
        return (
          <div
            key={b.id}
            title={b.motivo}
            className={`rounded-xl border-2 border-red-400 bg-[repeating-linear-gradient(45deg,#fecaca,#fecaca_6px,#fee2e2_6px,#fee2e2_12px)] ${compacto ? "px-2 py-1.5" : "px-4 py-2.5"}`}
          >
            <p className={`font-black uppercase text-red-800 ${compacto ? "text-[9px]" : "text-xs"}`}>
              🔒 Horario bloqueado · {todoElDia ? "todo el día" : `${minutosAHora(r[0])} – ${minutosAHora(r[1])}`}
            </p>
            <p className={`font-bold text-red-700 ${compacto ? "text-[9px] leading-tight" : "text-xs"}`}>
              {TIPO_BLOQUEO[b.tipo]} · {quien}
              {!compacto && b.motivo ? ` · ${b.motivo}` : ""}
            </p>
          </div>
        )
      })}
    </div>
  )
}

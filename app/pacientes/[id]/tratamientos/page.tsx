import { getSupabase } from "@/lib/supabase"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerTratamientos } from "@/lib/tratamientos"
import { obtenerPaciente } from "@/lib/paciente"
import { formatearPesos } from "@/lib/formato"
import { ListaTratamientos } from "@/components/tratamientos/ListaTratamientos"
import { NuevoTratamiento } from "@/components/tratamientos/NuevoTratamiento"

export default async function TratamientosPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirPermiso("pacientes.ver")
  const { id } = await params
  const [paciente, tratamientos] = await Promise.all([obtenerPaciente(id), obtenerTratamientos(id)])

  const puedeCrear = !!paciente?.activo && puede(usuario.rol, "presupuestos.gestionar")
  const porPagar = tratamientos.filter((t) => t.estado !== "ANULADO").reduce((s, t) => s + t.porPagar, 0)

  let formulario = null
  if (puedeCrear) {
    const supabase = getSupabase()
    const [{ data: profesionales }, { data: aranceles }, { data: sugerido }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre_completo").in("rol", ["DENTISTA", "ADMINISTRADOR"]).eq("activo", true).order("nombre_completo"),
      supabase.from("aranceles").select("id, nombre").eq("activo", true).order("es_base", { ascending: false }).order("nombre"),
      supabase.rpc("arancel_paciente", { p_paciente: id }),
    ])
    formulario = (
      <NuevoTratamiento
        pacienteId={id}
        siguienteNumero={(tratamientos[0]?.numero ?? 0) + 1}
        profesionales={profesionales ?? []}
        aranceles={aranceles ?? []}
        arancelSugerido={(sugerido as string) ?? null}
        profesionalSugerido={usuario.rol === "DENTISTA" ? usuario.id : null}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Tratamientos</h2>
          <p className="text-xs font-medium text-gray-500">
            Cada tratamiento tiene su propio odontograma y sus prestaciones. Todo se refleja en el odontograma general.
          </p>
        </div>
        {porPagar > 0 && (
          <div className="rounded-xl border-2 border-orange-300 bg-orange-50 px-4 py-2 text-right">
            <p className="text-[10px] font-black uppercase text-orange-700">Total por pagar</p>
            <p className="text-lg font-black text-orange-700">{formatearPesos(porPagar)}</p>
          </div>
        )}
      </div>

      {formulario}

      <ListaTratamientos pacienteId={id} tratamientos={tratamientos} />
    </div>
  )
}

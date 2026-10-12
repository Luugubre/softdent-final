import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerBonos, obtenerContratos, obtenerConvenios } from "@/lib/fonasa"
import { obtenerMetodosPago } from "@/lib/catalogos"
import { hoyEnChile } from "@/lib/fechas-agenda"
import { GestionBonos } from "@/components/fonasa/GestionBonos"
import { GestionConvenios, GestionCuotas } from "@/components/fonasa/GestionConvenios"

const PESTANAS = [
  { id: "bonos", etiqueta: "🏥 Bonos FONASA" },
  { id: "convenios", etiqueta: "🤝 Convenios y beneficiarios" },
  { id: "cuotas", etiqueta: "📆 Cuotas" },
] as const

export default async function FonasaConveniosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const usuario = await requerirPermiso("fonasa.gestionar")
  const { tab } = await searchParams
  const actual = PESTANAS.some((p) => p.id === tab) ? tab : "bonos"
  const hoy = hoyEnChile()

  const [bonos, convenios, contratos, metodos] = await Promise.all([
    actual === "bonos" ? obtenerBonos() : Promise.resolve([]),
    actual !== "bonos" ? obtenerConvenios() : Promise.resolve([]),
    actual === "cuotas" ? obtenerContratos() : Promise.resolve([]),
    actual === "cuotas" ? obtenerMetodosPago(true) : Promise.resolve([]),
  ])

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">FONASA y Convenios</h1>
        <p className="text-sm font-medium text-gray-500">
          Bonos con folio único, convenios con empresas y sindicatos, sus beneficiarios y el control de cuotas.
        </p>
      </div>

      <nav className="flex gap-1 overflow-x-auto bg-white border border-gray-200 rounded-2xl p-1 shadow-sm w-fit">
        {PESTANAS.map((p) => (
          <Link
            key={p.id}
            href={`/fonasa-convenios?tab=${p.id}`}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${actual === p.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {p.etiqueta}
          </Link>
        ))}
      </nav>

      {actual === "bonos" && <GestionBonos bonos={bonos} hoy={hoy} />}
      {actual === "convenios" && <GestionConvenios convenios={convenios} hoy={hoy} puedeConfigurar={puede(usuario.rol, "convenios.configurar")} />}
      {actual === "cuotas" && <GestionCuotas contratos={contratos} convenios={convenios} metodos={metodos.filter((m) => m.codigo !== "BONO_FONASA")} hoy={hoy} />}
    </div>
  )
}

import Link from "next/link"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { obtenerBonos, obtenerContratos, obtenerConvenios } from "@/lib/fonasa"
import { obtenerMetodosPago } from "@/lib/catalogos"
import { hoyEnChile } from "@/lib/fechas-agenda"
import { GestionBonos } from "@/components/fonasa/GestionBonos"
import { GestionConvenios, GestionCuotas } from "@/components/fonasa/GestionConvenios"
import { ComoFunciona, Encabezado, SeConfigura, Termino } from "@/components/ui/Ayuda"

const PESTANAS = [
  { id: "bonos", etiqueta: "🏥 Bonos FONASA", ayuda: "Registrar folios y abonarlos a la prestación" },
  { id: "convenios", etiqueta: "🤝 Convenios y beneficiarios", ayuda: "Empresas o sindicatos con descuento" },
  { id: "cuotas", etiqueta: "📆 Cuotas", ayuda: "Montos pactados en cuotas y su cobro" },
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
      <Encabezado
        icono="🏥"
        titulo="FONASA y convenios"
        descripcion="Bonos FONASA, convenios con empresas o sindicatos, sus beneficiarios y el control de cuotas."
        migas={[{ etiqueta: "FONASA y convenios" }]}
      />

      <nav className="flex gap-1 overflow-x-auto bg-white border border-gray-200 rounded-2xl p-1 shadow-sm w-fit max-w-full">
        {PESTANAS.map((p) => (
          <Link
            key={p.id}
            href={`/fonasa-convenios?tab=${p.id}`}
            className={`px-4 py-2 rounded-xl whitespace-nowrap leading-tight ${actual === p.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <span className="block text-sm font-bold">{p.etiqueta}</span>
            <span className={`block text-[11px] font-medium ${actual === p.id ? "text-blue-100" : "text-gray-400"}`}>{p.ayuda}</span>
          </Link>
        ))}
      </nav>

      {actual === "bonos" && (
        <>
          <ComoFunciona
            titulo="¿Cómo funcionan los bonos FONASA?"
            pasos={[
              <>El paciente trae su <Termino t="bono" /> (o lo compra en FONASA) con un <Termino t="folio" />.</>,
              <>Regístralo con el folio, el paciente, la prestación y la <strong>prestación del plan</strong> a la que se aplica.</>,
              <>Cuando se realiza la atención, presiona <strong>Usar</strong>: el monto se abona solo a esa prestación.</>,
              <>Si el paciente paga una diferencia (<Termino t="copago" />), anótala en el bono y cóbrala en su ficha › Pagos.</>,
            ]}
            reglas={[
              <>Un folio <strong>no se puede repetir</strong> ni usar dos veces.</>,
              <>Solo se aceptan prestaciones con <Termino t="codigo_fonasa" />.</>,
              <>Un bono ya utilizado no se puede anular.</>,
              <>El bono no entra a caja: no necesita caja abierta.</>,
            ]}
          />
          {puede(usuario.rol, "prestaciones.gestionar") && (
            <SeConfigura items={[{ que: "Código FONASA de cada prestación", etiqueta: "Prestaciones › prestación › Datos", href: "/prestaciones" }]} />
          )}
        </>
      )}
      {actual === "convenios" && (
        <ComoFunciona
          titulo="¿Cómo funcionan los convenios?"
          pasos={[
            <>Crea el <Termino t="convenio" /> con su % de descuento y su <Termino t="vigencia" />.</>,
            <>El sistema crea automáticamente un <Termino t="arancel" /> con ese descuento.</>,
            <>Agrega a los pacientes como <Termino t="beneficiario">beneficiarios</Termino>.</>,
            <>Al crearle un tratamiento a un beneficiario, se le sugiere el arancel del convenio.</>,
          ]}
          reglas={[
            <>Solo los beneficiarios <strong>activos</strong> pueden usar el arancel del convenio.</>,
            <>Fuera de la vigencia, el arancel del convenio no se puede usar.</>,
            <>Solo el administrador crea o edita convenios; recepción puede agregar beneficiarios.</>,
          ]}
        />
      )}
      {actual === "cuotas" && (
        <ComoFunciona
          titulo="¿Cómo funcionan las cuotas?"
          pasos={[
            <>Crea un <Termino t="cuotas">contrato</Termino>: convenio, monto total y cantidad de cuotas.</>,
            <>Presiona <strong>Generar cuotas mensuales</strong>; luego puedes ajustar montos y fechas.</>,
            <>Cuando paguen una cuota, presiona <strong>Registrar pago</strong> en esa cuota, elige el método y confirma con OK.</>,
          ]}
          reglas={[
            <>Las cuotas deben sumar <strong>exactamente</strong> el total del contrato.</>,
            <>Las cuotas vencidas y sin pagar se marcan en rojo.</>,
            <>Pagar una cuota exige caja abierta y entra a la caja como “Cuota convenio”.</>,
          ]}
        />
      )}

      {actual === "bonos" && <GestionBonos bonos={bonos} hoy={hoy} />}
      {actual === "convenios" && <GestionConvenios convenios={convenios} hoy={hoy} puedeConfigurar={puede(usuario.rol, "convenios.configurar")} />}
      {actual === "cuotas" && <GestionCuotas contratos={contratos} convenios={convenios} metodos={metodos.filter((m) => m.codigo !== "BONO_FONASA")} hoy={hoy} />}
    </div>
  )
}

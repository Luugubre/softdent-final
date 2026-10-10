import Link from "next/link"
import { notFound } from "next/navigation"
import { obtenerAntecedentes, obtenerPaciente, obtenerResumenPaciente } from "@/lib/paciente"
import { calcularEdad, formatearRut } from "@/lib/validaciones"
import { BotonEstadoPaciente } from "@/components/BotonEstadoPaciente"
import { NavPaciente } from "@/components/ficha/NavPaciente"
import type { Antecedente } from "@/types/antecedente"
import { requerirPermiso } from "@/lib/auth"
import { puede } from "@/lib/permisos"

function TarjetaResumen({
  titulo,
  items,
  vacio,
  alerta,
  href,
}: {
  titulo: string
  items: Antecedente[]
  vacio: string
  alerta?: boolean
  href: string
}) {
  const destacar = alerta && items.length > 0
  return (
    <div
      className={`rounded-2xl border p-4 space-y-2 ${
        destacar ? "bg-rose-50 border-rose-300" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-black uppercase tracking-wider ${destacar ? "text-rose-700" : "text-gray-500"}`}>
          {destacar && "⚠ "}
          {titulo}
        </h3>
        <Link href={href} className="text-[11px] font-bold text-blue-600 hover:underline">
          Editar
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm font-medium text-gray-400">{vacio}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((a) => (
            <li key={a.id} className={`text-sm font-semibold ${destacar ? "text-rose-900" : "text-gray-800"}`}>
              {a.contenido}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default async function LayoutPaciente({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const usuario = await requerirPermiso("pacientes.ver")
  const verClinico = puede(usuario.rol, "clinico.ver")

  const { id } = await params
  const paciente = await obtenerPaciente(id)
  if (!paciente) notFound()

  const [antecedentes, titular] = await Promise.all([
    verClinico ? obtenerAntecedentes(id) : Promise.resolve([] as Antecedente[]),
    paciente.titular_id ? obtenerResumenPaciente(paciente.titular_id) : Promise.resolve(null),
  ])

  const vigentes = antecedentes.filter((a) => a.vigente)
  const edad = calcularEdad(paciente.fecha_nacimiento)
  const base = `/pacientes/${id}`

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4 md:p-8 space-y-5">
      <Link href="/pacientes" className="text-sm font-bold text-blue-600 hover:underline">
        ← Volver al directorio
      </Link>

      {/* ENCABEZADO */}
      <header className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight uppercase">
            {paciente.nombres} {paciente.apellidos}
          </h1>
          <BotonEstadoPaciente
            pacienteId={paciente.id}
            activo={paciente.activo}
            puedeCambiar={puede(usuario.rol, "pacientes.deshabilitar")}
          />
          {paciente.activo && puede(usuario.rol, "agenda.gestionar") && (
            <Link
              href={`/agenda?agendar=${paciente.id}`}
              className="ml-auto px-4 py-2 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700"
            >
              📅 Agendar cita
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-x-2 text-sm text-gray-600 font-medium">
          <span>
            {paciente.extranjero ? "Documento" : "RUT"}:{" "}
            <strong className="font-mono text-gray-900">
              {paciente.extranjero ? paciente.rut : formatearRut(paciente.rut)}
            </strong>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Edad: <strong className="text-gray-900">{edad !== null ? `${edad} años` : "N/A"}</strong>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Previsión: <strong className="text-gray-900">{paciente.prevision}</strong>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Ficha: <strong className="text-gray-900">#{paciente.numero_ficha}</strong>
          </span>
          {titular && (
            <>
              <span className="text-gray-300">|</span>
              <span>
                Carga de{" "}
                <Link href={`/pacientes/${titular.id}`} className="font-bold text-blue-600 hover:underline">
                  {titular.nombres} {titular.apellidos}
                </Link>
              </span>
            </>
          )}
        </div>
        {!paciente.activo && (
          <p className="text-sm font-semibold text-gray-500">
            Paciente deshabilitado{paciente.motivo_deshabilitado ? `: ${paciente.motivo_deshabilitado}` : "."}
          </p>
        )}
      </header>

      <div className={`grid grid-cols-1 gap-5 items-start ${verClinico ? "lg:grid-cols-[260px_1fr]" : ""}`}>
        {/* COLUMNA IZQUIERDA: resumen clínico (solo roles clínicos) */}
        {verClinico && (
        <aside className="space-y-3 lg:sticky lg:top-4">
          <TarjetaResumen
            titulo="Alertas"
            items={vigentes.filter((a) => a.categoria === "ALERGIA")}
            vacio="Ninguna"
            alerta
            href={`${base}/antecedentes`}
          />
          <TarjetaResumen
            titulo="Enfermedades"
            items={vigentes.filter((a) => a.categoria === "ENFERMEDAD")}
            vacio="Ninguna"
            href={`${base}/antecedentes`}
          />
          <TarjetaResumen
            titulo="Medicamentos"
            items={vigentes.filter((a) => a.categoria === "MEDICAMENTO")}
            vacio="Ninguno"
            href={`${base}/antecedentes`}
          />
        </aside>
        )}

        {/* COLUMNA DERECHA: navegación + contenido */}
        <main className="space-y-5 min-w-0">
          <NavPaciente pacienteId={id} verClinico={verClinico} />
          {children}
        </main>
      </div>
    </div>
  )
}

import { notFound } from "next/navigation"
import { requerirPermiso } from "@/lib/auth"
import { obtenerAuditoria, obtenerCatalogo, obtenerMetodosPago, obtenerParametros } from "@/lib/catalogos"
import { formatearFechaHora } from "@/lib/formato"
import { seccionAdmin } from "@/lib/admin-secciones"
import { TablaCatalogo, TablaMetodosPago, TablaParametros } from "@/components/admin/TablasAdmin"
import { NavAdmin } from "@/components/admin/NavAdmin"
import { ComoFunciona, Encabezado, Termino } from "@/components/ui/Ayuda"
import type { RegistroAuditoria } from "@/types/admin"

const NOMBRE_TABLA: Record<string, string> = {
  especialidades: "Especialidad",
  categorias_prestaciones: "Categoría",
  boxes: "Box",
  previsiones: "Previsión",
  tipos_atencion: "Tipo de atención",
  metodos_pago: "Método de pago",
  parametros_sistema: "Parámetro",
  convenios: "Convenio",
  laboratorios: "Laboratorio",
  bancos: "Banco",
}

function cambios(r: RegistroAuditoria) {
  if (!r.anterior || !r.nuevo) return r.nuevo ? String(r.nuevo.nombre ?? r.nuevo.valor ?? r.registro_id) : ""
  return Object.keys(r.nuevo)
    .filter((k) => !["updated_at", "created_at"].includes(k) && JSON.stringify(r.anterior?.[k]) !== JSON.stringify(r.nuevo?.[k]))
    .map((k) => `${k}: ${String(r.anterior?.[k] ?? "—")} → ${String(r.nuevo?.[k] ?? "—")}`)
    .join(" · ")
}

async function RegistroCambios() {
  const auditoria = await obtenerAuditoria(200)
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <p className="text-sm text-gray-600">
        Quién cambió qué configuración y cuándo. En “Cambio” se ve el valor anterior → el nuevo. Este registro no se puede editar.
      </p>
      {auditoria.length === 0 ? (
        <p className="text-sm font-semibold text-gray-400">Aún no hay cambios registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-2 text-left">Fecha</th>
                <th className="py-2 text-left">Usuario</th>
                <th className="py-2 text-left">Qué</th>
                <th className="py-2 text-left">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {auditoria.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 align-top">
                  <td className="whitespace-nowrap py-2 text-gray-500">{formatearFechaHora(r.fecha)}</td>
                  <td className="py-2 font-semibold">{r.usuario?.nombre_completo ?? "Sistema"}</td>
                  <td className="py-2">
                    <span className="font-semibold">{NOMBRE_TABLA[r.tabla] ?? r.tabla}</span>{" "}
                    <span className={`text-[10px] font-bold ${r.accion === "CREADO" ? "text-emerald-600" : "text-blue-600"}`}>{r.accion}</span>
                  </td>
                  <td className="break-all py-2 text-xs text-gray-600">{cambios(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default async function SeccionAdministracionPage({ params }: { params: Promise<{ seccion: string }> }) {
  await requerirPermiso("administracion.gestionar")
  const { seccion } = await params
  const s = seccionAdmin(seccion)
  if (!s) notFound()

  let contenido: React.ReactNode
  if (s.tabla) {
    contenido = <TablaCatalogo tabla={s.tabla} items={await obtenerCatalogo(s.tabla)} completa />
  } else if (s.slug === "parametros") {
    contenido = <TablaParametros parametros={await obtenerParametros()} />
  } else if (s.slug === "metodos-pago") {
    contenido = <TablaMetodosPago metodos={await obtenerMetodosPago(false)} />
  } else {
    contenido = <RegistroCambios />
  }

  return (
    <div className="w-full min-h-screen p-6 md:p-10 space-y-6">
      <Encabezado
        icono={s.icono}
        titulo={s.titulo}
        descripcion={s.descripcion}
        migas={[{ href: "/administracion", etiqueta: "Administración" }, { etiqueta: s.titulo }]}
      >
        <NavAdmin />
      </Encabezado>
      {s.tabla && (
        <ComoFunciona
          pasos={[
            <>Escribe el nombre y presiona <strong>Agregar</strong>; usa <strong>Editar</strong> para corregir.</>,
            <>Lo que ya se usó no se borra: se <strong>desactiva</strong> y deja de aparecer en las listas.</>,
            <>Todo cambio queda en el <Termino t="auditoria" /> con tu nombre.</>,
          ]}
        />
      )}
      {contenido}
    </div>
  )
}

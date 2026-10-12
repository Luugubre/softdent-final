import { requerirPermiso } from "@/lib/auth"
import { obtenerAuditoria, obtenerCatalogo, obtenerMetodosPago, obtenerParametros } from "@/lib/catalogos"
import { formatearFechaHora } from "@/lib/formato"
import { TablaCatalogo, TablaMetodosPago, TablaParametros } from "@/components/admin/TablasAdmin"
import type { RegistroAuditoria } from "@/types/admin"
import { ComoFunciona, Encabezado, Termino } from "@/components/ui/Ayuda"

const NOMBRE_TABLA: Record<string, string> = {
  especialidades: "Especialidad",
  categorias_prestaciones: "Categoría",
  boxes: "Box",
  previsiones: "Previsión",
  tipos_atencion: "Tipo de atención",
  metodos_pago: "Método de pago",
  parametros_sistema: "Parámetro",
  convenios: "Convenio",
}

function cambios(r: RegistroAuditoria) {
  if (!r.anterior || !r.nuevo) return r.nuevo ? String(r.nuevo.nombre ?? r.nuevo.valor ?? r.registro_id) : ""
  return Object.keys(r.nuevo)
    .filter((k) => !["updated_at", "created_at"].includes(k) && JSON.stringify(r.anterior?.[k]) !== JSON.stringify(r.nuevo?.[k]))
    .map((k) => `${k}: ${String(r.anterior?.[k] ?? "—")} → ${String(r.nuevo?.[k] ?? "—")}`)
    .join(" · ")
}

export default async function AdministracionPage() {
  await requerirPermiso("administracion.gestionar")

  const [especialidades, categorias, boxes, previsiones, tipos, metodos, parametros, auditoria] = await Promise.all([
    obtenerCatalogo("especialidades"),
    obtenerCatalogo("categorias_prestaciones"),
    obtenerCatalogo("boxes"),
    obtenerCatalogo("previsiones"),
    obtenerCatalogo("tipos_atencion"),
    obtenerMetodosPago(false),
    obtenerParametros(),
    obtenerAuditoria(),
  ])

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="⚙️"
        titulo="Administración"
        descripcion="Las opciones generales del sistema: datos de la clínica, métodos de pago y las listas que aparecen en otras pantallas."
        migas={[{ etiqueta: "Administración" }]}
      >
        <nav aria-label="Secciones" className="flex flex-wrap gap-2 text-xs font-bold">
          {[
            ["#parametros", "🔧 Parámetros"],
            ["#metodos-pago", "💳 Métodos de pago"],
            ["#previsiones", "🩺 Previsiones"],
            ["#tipos_atencion", "🏷️ Tipos de atención"],
            ["#especialidades", "🎓 Especialidades"],
            ["#categorias_prestaciones", "🗂️ Categorías"],
            ["#boxes", "🚪 Boxes"],
            ["#auditoria", "🕵️ Registro de cambios"],
          ].map(([href, etiqueta]) => (
            <a key={href} href={href} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-blue-300 hover:text-blue-700">
              {etiqueta}
            </a>
          ))}
        </nav>
      </Encabezado>
      <ComoFunciona
        pasos={[
          <>Usa los botones de arriba para saltar a la sección que quieres cambiar.</>,
          <>En cada <Termino t="catalogo" />, escribe el nombre y presiona <strong>Agregar</strong>; usa <strong>Editar</strong> para corregir.</>,
          <>En los <Termino t="parametro">parámetros</Termino>, cambia el valor y presiona el botón <strong>Guardar</strong> que aparece.</>,
          <>Cada sección dice <strong>📍 dónde se usa</strong> ese dato en el resto del sistema.</>,
        ]}
        reglas={[
          <>Nada se borra: lo que ya se usó se <strong>desactiva</strong> y deja de aparecer en las listas.</>,
          <>Los parámetros solo aceptan valores dentro de su rango.</>,
          <>Todo cambio queda en el <Termino t="auditoria" /> con tu nombre.</>,
        ]}
      />

      <TablaParametros parametros={parametros} />
      <TablaMetodosPago metodos={metodos} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TablaCatalogo tabla="previsiones" items={previsiones} />
        <TablaCatalogo tabla="tipos_atencion" items={tipos} />
        <TablaCatalogo tabla="especialidades" items={especialidades} />
        <TablaCatalogo tabla="categorias_prestaciones" items={categorias} />
        <TablaCatalogo tabla="boxes" items={boxes} />
      </div>

      <section id="auditoria" className="scroll-mt-20 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">🕵️ Registro de cambios</h2>
          <p className="text-xs font-semibold text-gray-600">
            Quién cambió qué configuración y cuándo. En “Cambio” se ve el valor anterior → el nuevo. Este registro no se puede editar.
          </p>
        </div>
        {auditoria.length === 0 ? (
          <p className="text-sm font-semibold text-gray-400">Aún no hay cambios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Usuario</th>
                  <th className="text-left py-2">Qué</th>
                  <th className="text-left py-2">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 whitespace-nowrap text-gray-500">{formatearFechaHora(r.fecha)}</td>
                    <td className="py-2 font-semibold">{r.usuario?.nombre_completo ?? "Sistema"}</td>
                    <td className="py-2">
                      <span className="font-bold">{NOMBRE_TABLA[r.tabla] ?? r.tabla}</span>{" "}
                      <span className={`text-[10px] font-black ${r.accion === "CREADO" ? "text-emerald-600" : "text-blue-600"}`}>{r.accion}</span>
                    </td>
                    <td className="py-2 text-xs text-gray-600 break-all">{cambios(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

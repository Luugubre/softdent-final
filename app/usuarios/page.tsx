import { getSupabase } from "@/lib/supabase"
import { requerirPermiso } from "@/lib/auth"
import { LISTA_PERMISOS, PERMISO_ETIQUETAS, ROLES, ROL_COLOR, ROL_DESCRIPCION, ROL_ETIQUETAS, puede } from "@/lib/permisos"
import { formatearRut } from "@/lib/validaciones"
import { UsuarioForm } from "@/components/usuarios/UsuarioForm"
import { AccionesUsuario } from "@/components/usuarios/AccionesUsuario"
import type { Perfil } from "@/types/perfil"
import { ComoFunciona, Encabezado, Termino } from "@/components/ui/Ayuda"

export default async function UsuariosPage() {
  const yo = await requerirPermiso("usuarios.gestionar")

  const { data, error } = await getSupabase()
    .from("perfiles")
    .select("*")
    .order("activo", { ascending: false })
    .order("nombre_completo")
  const usuarios = (data ?? []) as Perfil[]

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6 md:p-10 space-y-6">
      <Encabezado
        icono="🔐"
        titulo="Usuarios y roles"
        descripcion="Quién puede entrar al sistema y qué puede hacer cada uno según su rol."
        migas={[{ etiqueta: "Usuarios y roles" }]}
      />
      <ComoFunciona
        pasos={[
          <>Abre <strong>➕ Crear usuario</strong>, completa nombre, correo, contraseña inicial y <Termino t="rol" />.</>,
          <>Para los dentistas agrega especialidad y registro profesional: así aparecen en la agenda y en liquidaciones.</>,
          <>Para cambiar el rol, <strong>restablecer la contraseña</strong> o desactivar a alguien, usa los botones de su fila.</>,
          <>Revisa al final la <strong>Matriz de permisos</strong> para ver qué puede hacer cada rol.</>,
        ]}
        reglas={[
          <>Un usuario no se borra: se <strong>desactiva</strong> y ya no puede entrar.</>,
          <>No puedes cambiar tu propio rol ni desactivarte a ti mismo.</>,
          <>Los permisos se validan siempre en el servidor, aunque se oculte un botón.</>,
        ]}
      />

      <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm" open={usuarios.length <= 1}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
          <span className="text-base font-extrabold text-gray-900">➕ Crear usuario</span>
          <span className="text-xs font-bold text-blue-600 group-open:hidden">Abrir formulario ▾</span>
          <span className="hidden text-xs font-bold text-blue-600 group-open:inline">Cerrar ▴</span>
        </summary>
        <div className="border-t border-gray-100 p-2">
          <UsuarioForm />
        </div>
      </details>

      {error && (
        <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800">
          Error al cargar usuarios: {error.message}
        </p>
      )}

      <div className="w-full bg-white shadow-sm rounded-2xl overflow-x-auto border border-gray-200">
        <table className="w-full divide-y divide-gray-200 text-left">
          <thead className="bg-gray-100">
            <tr>
              {["Nombre", "Correo", "RUT", "Rol", "Estado", "Acciones"].map((h) => (
                <th key={h} className="px-5 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo ? "" : "opacity-60"}>
                <td className="px-5 py-3 text-sm">
                  <p className="font-extrabold text-gray-900">
                    {u.nombre_completo} {u.id === yo.id && <span className="text-xs font-bold text-blue-600">(tú)</span>}
                  </p>
                  {(u.especialidad || u.registro_profesional) && (
                    <p className="text-xs font-medium text-gray-500">
                      {[u.especialidad, u.registro_profesional && `Reg. ${u.registro_profesional}`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-gray-700">{u.email}</td>
                <td className="px-5 py-3 text-sm font-mono text-gray-700">{u.rut ? formatearRut(u.rut) : "—"}</td>
                <td className="px-5 py-3 text-sm">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase ${ROL_COLOR[u.rol]}`}>
                    {ROL_ETIQUETAS[u.rol]}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm font-bold">
                  {u.activo ? <span className="text-emerald-700">Activo</span> : <span className="text-gray-500">Inactivo</span>}
                </td>
                <td className="px-5 py-3 text-sm">
                  <AccionesUsuario usuario={u} esYo={u.id === yo.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-extrabold text-gray-900">Matriz de permisos</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {ROLES.map((r) => (
            <div key={r} className="rounded-xl border border-gray-200 p-3 space-y-1">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase ${ROL_COLOR[r]}`}>
                {ROL_ETIQUETAS[r]}
              </span>
              <p className="text-xs font-medium text-gray-600">{ROL_DESCRIPCION[r]}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 pr-4 text-left text-xs font-bold text-gray-500 uppercase">Acción</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-2 px-3 text-center text-xs font-bold text-gray-500 uppercase">{ROL_ETIQUETAS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {LISTA_PERMISOS.map((p) => (
                <tr key={p}>
                  <td className="py-2 pr-4 font-semibold text-gray-800">{PERMISO_ETIQUETAS[p]}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="py-2 px-3 text-center">
                      {puede(r, p) ? <span className="text-emerald-600 font-black">✓</span> : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

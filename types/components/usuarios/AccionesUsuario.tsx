"use client"

import { useTransition } from "react"
import { cambiarEstadoUsuario, cambiarRol, restablecerContrasena } from "@/app/usuarios/actions"
import { ROLES, ROL_ETIQUETAS, type Rol } from "@/lib/permisos"
import type { Perfil } from "@/types/perfil"

export function AccionesUsuario({ usuario, esYo }: { usuario: Perfil; esYo: boolean }) {
  const [pendiente, startTransition] = useTransition()

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje: string }>) {
    startTransition(async () => {
      const res = await accion()
      if (!res.ok) alert(res.mensaje)
    })
  }

  if (esYo) return <span className="text-xs font-medium text-gray-400">—</span>

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={usuario.rol}
        disabled={pendiente}
        onChange={(e) => {
          const nuevo = e.target.value as Rol
          if (window.confirm(`¿Cambiar el rol de ${usuario.nombre_completo} a ${ROL_ETIQUETAS[nuevo]}?`)) {
            ejecutar(() => cambiarRol(usuario.id, nuevo))
          }
        }}
        className="px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-xs font-bold text-gray-800"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROL_ETIQUETAS[r]}</option>
        ))}
      </select>

      <button
        disabled={pendiente}
        onClick={() => {
          const nueva = window.prompt(`Nueva contraseña para ${usuario.nombre_completo} (mínimo 8 caracteres):`)
          if (nueva) ejecutar(() => restablecerContrasena(usuario.id, nueva))
        }}
        className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-50"
      >
        Contraseña
      </button>

      <button
        disabled={pendiente}
        onClick={() => {
          const accion = usuario.activo ? "desactivar" : "activar"
          if (window.confirm(`¿Seguro que quieres ${accion} a ${usuario.nombre_completo}?`)) {
            ejecutar(() => cambiarEstadoUsuario(usuario.id))
          }
        }}
        className={`text-xs font-bold hover:underline disabled:opacity-50 ${usuario.activo ? "text-rose-600" : "text-emerald-700"}`}
      >
        {usuario.activo ? "Desactivar" : "Activar"}
      </button>
    </div>
  )
}

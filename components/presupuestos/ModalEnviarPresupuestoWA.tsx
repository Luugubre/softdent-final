"use client"

import { useState, useEffect, useCallback } from "react"
import {
  obtenerPresupuestosActivosPaciente,
  registrarEnvioPresupuestoWhatsApp,
  type PresupuestoOpt,
} from "@/app/presupuestos/whatsapp/actions"

type Props = {
  pacienteId: string
  pacienteNombre: string
  pacienteTelefono?: string | null
  presupuestoIdInicial?: string
  onClose: () => void
}

export function ModalEnviarPresupuestoWA({
  pacienteId,
  pacienteNombre,
  pacienteTelefono,
  presupuestoIdInicial,
  onClose,
}: Props) {
  const [cargando, setCargando] = useState(true)
  const [presupuestos, setPresupuestos] = useState<PresupuestoOpt[]>([])
  const [presupuestoSel, setPresupuestoSel] = useState<PresupuestoOpt | null>(null)
  const [mensaje, setMensaje] = useState("")
  const [telefono, setTelefono] = useState(pacienteTelefono || "")
  const [error, setError] = useState<string | null>(null)

  const armarTextoMensaje = useCallback(
    (p: PresupuestoOpt) => {
      setPresupuestoSel(p)

      const formatoCLP = (v: number) => `$${v.toLocaleString("es-CL")}`

      const detalleItems = p.items
        .map(
          (it) =>
            `• ${it.nombre_prestacion}${it.pieza ? ` (Pieza: ${it.pieza})` : ""}: ${formatoCLP(it.precio)}`
        )
        .join("\n")

      let txt = `Hola ${pacienteNombre}, adjuntamos el detalle de tu plan de tratamiento de Clínica SoftDent:\n\n`
      txt += `📋 *${p.nombre}* (Folio #${p.folio})\n\n`
      if (detalleItems) {
        txt += `*Prestaciones:*\n${detalleItems}\n\n`
      }
      txt += `💰 *Total Tratamiento:* ${formatoCLP(p.total)}\n`
      if (p.descuento > 0) {
        txt += `🏷️ *Descuento Convenio:* -${formatoCLP(p.descuento)}\n`
      }
      txt += `💳 *Monto Abonado:* ${formatoCLP(p.abonado)}\n`
      txt += `📌 *Saldo Pendiente:* *${formatoCLP(p.saldo)}*\n`

      txt += `\n¿Quedamos atentos a tus comentarios o para agendar tus horas!`
      setMensaje(txt)
    },
    [pacienteNombre]
  )

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const res = await obtenerPresupuestosActivosPaciente(pacienteId)
      setCargando(false)

      if (res.error) {
        setError(res.error)
      } else if (res.presupuestos) {
        setPresupuestos(res.presupuestos)
        if (presupuestoIdInicial) {
          const inicial = res.presupuestos.find((p) => p.id === presupuestoIdInicial)
          if (inicial) armarTextoMensaje(inicial)
          else if (res.presupuestos[0]) armarTextoMensaje(res.presupuestos[0])
        } else if (res.presupuestos.length > 0) {
          armarTextoMensaje(res.presupuestos[0])
        }
      }
    }
    cargar()
  }, [pacienteId, presupuestoIdInicial, armarTextoMensaje])

  const handleCambioPresupuesto = (id: string) => {
    const p = presupuestos.find((x) => x.id === id)
    if (p) armarTextoMensaje(p)
  }

  const handleEnviarWhatsApp = async () => {
    if (!telefono) return setError("Debes ingresar un teléfono válido.")
    if (!presupuestoSel) return setError("Selecciona un presupuesto.")

    let numLimpio = telefono.replace(/\D/g, "")
    if (numLimpio.length === 9 && numLimpio.startsWith("9")) {
      numLimpio = `56${numLimpio}`
    }

    const linkWa = `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensaje)}`

    await registrarEnvioPresupuestoWhatsApp({
      paciente_id: pacienteId,
      presupuesto_id: presupuestoSel.id,
      telefono: numLimpio,
      mensaje,
    })

    window.open(linkWa, "_blank")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-5">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <span>💬</span> Enviar Presupuesto por WhatsApp
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-sm">
            ✕
          </button>
        </div>

        {cargando ? (
          <p className="text-xs text-gray-500 italic py-6 text-center">Cargando presupuestos del paciente...</p>
        ) : error ? (
          <p className="text-xs font-bold text-rose-600">{error}</p>
        ) : presupuestos.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-xs font-semibold text-gray-500">El paciente no posee presupuestos activos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {presupuestos.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Seleccionar Plan de Tratamiento ({presupuestos.length} activos):
                </label>
                <select
                  value={presupuestoSel?.id ?? ""}
                  onChange={(e) => handleCambioPresupuesto(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2 text-xs font-medium bg-white"
                >
                  {presupuestos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — Saldo: ${p.saldo.toLocaleString("es-CL")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Teléfono WhatsApp</label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: +56912345678"
                className="w-full rounded-xl border border-gray-300 p-2 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Mensaje (Editable)</label>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-gray-300 p-3 text-xs font-mono leading-relaxed bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={handleEnviarWhatsApp}
              className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white hover:bg-emerald-700 shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>📲</span> Abrir WhatsApp y Registrar Envío
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
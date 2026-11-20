"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { obtenerPacientesEnEspera, type PacienteEnEspera } from "@/app/agenda/actions"

/** Genera un timbre doble suave de clínica usando Web Audio API (sin archivos externos) */
function reproducirTimbreSuave() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const ahora = ctx.currentTime

    const notas = [
      { freq: 587.33, inicio: 0, duracion: 0.25 }, // Re5
      { freq: 880.0, inicio: 0.18, duracion: 0.45 }, // La5
    ]

    for (const n of notas) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(n.freq, ahora + n.inicio)

      gain.gain.setValueAtTime(0.001, ahora + n.inicio)
      gain.gain.exponentialRampToValueAtTime(0.12, ahora + n.inicio + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, ahora + n.inicio + n.duracion)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ahora + n.inicio)
      osc.stop(ahora + n.inicio + n.duracion + 0.05)
    }
  } catch {
    // El navegador puede bloquear audio si aún no hubo interacción del usuario
  }
}

function minutosEsperando(llegadaAt: string | null, ahoraMs: number): number {
  if (!llegadaAt) return 0
  const diff = Math.floor((ahoraMs - new Date(llegadaAt).getTime()) / 60_000)
  return Math.max(0, diff)
}

export function AvisoSalaEspera({ esDentista }: { esDentista: boolean }) {
  const [pacientes, setPacientes] = useState<PacienteEnEspera[]>([])
  const [ocultos, setOcultos] = useState<Set<string>>(new Set())
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())
  const [permisoNotif, setPermisoNotif] = useState<NotificationPermission | "unsupported">("unsupported")

  // Guarda los IDs de citas que ya notificamos para sonar solo cuando entra uno nuevo
  const notificadosRef = useRef<Set<string>>(new Set())
  const primeraCargaRef = useRef(true)

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermisoNotif(Notification.permission)
    }
  }, [])

  const dispararNotificacionNavegador = useCallback((p: PacienteEnEspera) => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return

    try {
      const n = new Notification("Paciente en sala de espera", {
        body: `${p.paciente_nombre} · Cita de las ${p.hora_cita}${p.box_nombre ? ` (${p.box_nombre})` : ""}`,
        tag: `espera-${p.id}`,
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
    } catch {
      // Ignorar si el entorno no soporta notificaciones nativas
    }
  }, [])

  const consultar = useCallback(async () => {
    if (!esDentista) return
    const lista = await obtenerPacientesEnEspera()
    setPacientes(lista)
    setAhoraMs(Date.now())

    // Limpiar de "ocultos" citas que ya salieron de EN_ESPERA
    const idsActuales = new Set(lista.map((x) => x.id))
    setOcultos((prev) => {
      const next = new Set<string>()
      for (const id of prev) if (idsActuales.has(id)) next.add(id)
      return next
    })

    // Detectar llegadas nuevas
    const nuevos = lista.filter((p) => !notificadosRef.current.has(p.id))
    for (const p of lista) notificadosRef.current.add(p.id)

    if (nuevos.length > 0 && !primeraCargaRef.current) {
      reproducirTimbreSuave()
      for (const p of nuevos) {
        dispararNotificacionNavegador(p)
      }
    }
    primeraCargaRef.current = false
  }, [esDentista, dispararNotificacionNavegador])

  // Consulta inicial + cada 15 segundos
  useEffect(() => {
    if (!esDentista) return
    consultar()
    const intervalo = setInterval(consultar, 15_000)
    return () => clearInterval(intervalo)
  }, [esDentista, consultar])

  // Reloj interno cada 30s para actualizar "esperando hace X min"
  useEffect(() => {
    if (pacientes.length === 0) return
    const reloj = setInterval(() => setAhoraMs(Date.now()), 30_000)
    return () => clearInterval(reloj)
  }, [pacientes.length])

  async function pedirPermisoNotificaciones() {
    if (typeof window === "undefined" || !("Notification" in window)) return
    const res = await Notification.requestPermission()
    setPermisoNotif(res)
  }

  if (!esDentista) return null

  const visibles = pacientes.filter((p) => !ocultos.has(p.id))
  if (visibles.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0">
      {visibles.map((p) => {
        const mins = minutosEsperando(p.llegada_at, ahoraMs)
        return (
          <div
            key={p.id}
            className="rounded-2xl border-2 border-amber-400 bg-white p-4 shadow-xl ring-4 ring-amber-500/10 animate-in slide-in-from-bottom-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                  Paciente en sala de espera
                </span>
              </div>
              <button
                onClick={() => setOcultos((prev) => new Set(prev).add(p.id))}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1"
                title="Ocultar aviso"
              >
                ✕
              </button>
            </div>

            <p className="mt-1.5 text-base font-black text-gray-900 uppercase truncate">{p.paciente_nombre}</p>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-gray-600">
              <span>🕒 Cita {p.hora_cita}</span>
              <span>·</span>
              <span className={mins >= 15 ? "text-rose-600 font-black" : "text-amber-700"}>
                ⏳ Esperando hace {mins} min
              </span>
              {p.box_nombre && (
                <>
                  <span>·</span>
                  <span>🚪 {p.box_nombre}</span>
                </>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <Link
                href={`/pacientes/${p.paciente_id}`}
                className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-600 transition"
              >
                Ver ficha
              </Link>

              {permisoNotif === "default" && (
                <button
                  onClick={pedirPermisoNotificaciones}
                  className="text-[11px] font-bold text-blue-600 hover:underline"
                >
                  🔔 Activar alertas de escritorio
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
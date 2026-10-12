"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { marcarAusente, marcarSano } from "@/app/pacientes/[id]/odontograma/actions"
import { Diente, type EstadoDiente } from "@/components/odontograma/Diente"
import { ModalHallazgo, ModalInfo } from "@/components/odontograma/Modales"
import { PanelPrestaciones } from "@/components/odontograma/PanelPrestaciones"
import type { Catalogo } from "@/lib/catalogo"
import { IconoMuestra } from "@/lib/iconos-dentales"
import { ICONOS_DE_CARA, ICONOS_PRESTACION, iconoPorNombre } from "@/lib/iconos-datos"
import {
  ARCADAS,
  COLORES,
  LESIONES,
  PREEXISTENCIAS,
  etiquetaHallazgo,
  iconoHallazgo,
  esSuperior,
  esTemporal,
  type Avance,
  type Cara,
  type Denticion,
  type Hallazgo,
  type ItemTratamiento,
} from "@/types/odontograma"
import type { TratamientoOpcion } from "@/types/tratamiento"

type Permisos = { editar: boolean; agregar: boolean }
type ModalAbierto =
  | { tipo: "PREEXISTENCIA" | "LESION" | "INFO"; pieza: number }
  | null

function calcularEstado(pieza: number, hallazgos: Hallazgo[], items: ItemTratamiento[]): EstadoDiente {
  const estado: EstadoDiente = { caras: {}, iconos: [], ausente: false, tinte: "normal" }
  const pintar = (caras: Cara[], color: string) => caras.forEach((c) => (estado.caras[c] = color))

  const marcar = (tipoIcono: string, caras: Cara[], color: string, titulo: string, malEstado = false) => {
    if (caras.length) pintar(caras, color)
    if (!(caras.length && ICONOS_DE_CARA.has(tipoIcono))) estado.iconos.push({ tipo: tipoIcono, color, malEstado, titulo })
  }

  const propios = hallazgos.filter((h) => h.pieza === pieza)
  const prest = items.filter((i) => i.pieza === pieza)
  const iconoItem = (i: ItemTratamiento) => i.prestacion?.icono || iconoPorNombre(i.prestacion?.nombre ?? "")

  for (const h of propios.filter((h) => h.tipo === "PREEXISTENCIA")) {
    const ic = iconoHallazgo(h.tipo, h.codigo)
    marcar(ic.tipo, h.caras, COLORES.PREEXISTENCIA, etiquetaHallazgo(h.tipo, h.codigo))
  }
  for (const i of prest.filter((i) => i.estado === "REALIZADO")) {
    marcar(iconoItem(i), i.caras, COLORES.REALIZADO, `${i.prestacion?.nombre} (realizada)`)
  }
  for (const i of prest.filter((i) => i.estado === "PENDIENTE" || i.estado === "EN_PROCESO")) {
    marcar(iconoItem(i), i.caras, COLORES.PENDIENTE, `${i.prestacion?.nombre} (${i.progreso}%)`)
  }
  for (const h of propios.filter((h) => h.tipo === "LESION")) {
    const ic = iconoHallazgo(h.tipo, h.codigo)
    marcar(ic.tipo, h.caras, COLORES.LESION, etiquetaHallazgo(h.tipo, h.codigo), ic.malEstado)
  }

  estado.ausente = propios.some((h) => h.tipo === "AUSENTE")
  const pendientes = prest.some((i) => i.estado === "PENDIENTE" || i.estado === "EN_PROCESO")
  const realizadas = prest.some((i) => i.estado === "REALIZADO")
  estado.tinte = propios.some((h) => h.tipo === "LESION")
    ? "lesion"
    : pendientes
      ? "pendiente"
      : realizadas
        ? "realizado"
        : propios.some((h) => h.tipo === "PREEXISTENCIA")
          ? "preexistencia"
          : "normal"
  return estado
}

export function Odontograma({
  pacienteId,
  hallazgos,
  items,
  avances,
  permisos,
  tratamientos = [],
  tratamientoFijo,
  catalogo,
}: {
  pacienteId: string
  hallazgos: Hallazgo[]
  items: ItemTratamiento[]
  avances: Avance[]
  permisos: Permisos
  tratamientos?: TratamientoOpcion[]
  tratamientoFijo?: TratamientoOpcion
  catalogo?: Catalogo | null
}) {
  const esGeneral = !tratamientoFijo
  const vigentes = useMemo(() => hallazgos.filter((h) => h.vigente), [hallazgos])
  const activos = useMemo(() => items.filter((i) => i.estado !== "ANULADO"), [items])

  const tieneTemporales = [...vigentes, ...activos].some((x) => x.pieza !== null && esTemporal(x.pieza))
  const tienePermanentes = [...vigentes, ...activos].some((x) => x.pieza !== null && !esTemporal(x.pieza))
  const [denticion, setDenticion] = useState<Denticion>(tieneTemporales && !tienePermanentes ? "TEMPORAL" : "PERMANENTE")

  const [seleccionada, setSeleccionada] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ pieza: number; x: number; y: number } | null>(null)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [panel, setPanel] = useState<{ pieza: number | null; caras: Cara[] } | null>(null)
  const puedeAgregar = permisos.agregar && !!catalogo
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()

  useEffect(() => {
    if (!menu) return
    const cerrar = () => setMenu(null)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar()
    window.addEventListener("click", cerrar)
    window.addEventListener("scroll", cerrar, true)
    window.addEventListener("keydown", esc)
    return () => {
      window.removeEventListener("click", cerrar)
      window.removeEventListener("scroll", cerrar, true)
      window.removeEventListener("keydown", esc)
    }
  }, [menu])

  const arcada = ARCADAS[denticion]
  const estadoDe = (pieza: number) => calcularEstado(pieza, vigentes, activos)
  const esAusente = (pieza: number) => vigentes.some((h) => h.pieza === pieza && h.tipo === "AUSENTE")
  const tieneHallazgos = (pieza: number) => vigentes.some((h) => h.pieza === pieza)

  function clicIzquierdo(pieza: number) {
    setSeleccionada(pieza)
    setMenu(null)
    if (puedeAgregar) setPanel({ pieza, caras: [] })
    else setModal({ tipo: "INFO", pieza })
  }

  function clicCara(pieza: number, cara: Cara) {
    setSeleccionada(pieza)
    setMenu(null)
    if (!puedeAgregar) return setModal({ tipo: "INFO", pieza })
    setPanel((prev) =>
      prev?.pieza === pieza
        ? { pieza, caras: prev.caras.includes(cara) ? prev.caras.filter((c) => c !== cara) : [...prev.caras, cara] }
        : { pieza, caras: [cara] }
    )
  }

  function clicDerecho(e: React.MouseEvent, pieza: number) {
    e.preventDefault()
    e.stopPropagation()
    setSeleccionada(pieza)
    const x = Math.min(e.clientX, window.innerWidth - 240)
    const y = Math.min(e.clientY, window.innerHeight - 300)
    setMenu({ pieza, x, y })
  }

  function terminar(m: { ok: boolean; texto: string }) {
    setModal(null)
    setAviso(m)
  }

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje: string }>) {
    startTransition(async () => {
      const res = await accion()
      setAviso({ ok: res.ok, texto: res.mensaje })
    })
  }

  const opcionesMenu = menu
    ? [
        {
          texto: "Agregar Preexistencia",
          icono: "🔵",
          visible: permisos.editar,
          deshabilitada: esAusente(menu.pieza),
          accion: () => setModal({ tipo: "PREEXISTENCIA", pieza: menu.pieza }),
        },
        {
          texto: "Definir Lesión",
          icono: "🔴",
          visible: permisos.editar,
          deshabilitada: esAusente(menu.pieza),
          accion: () => setModal({ tipo: "LESION", pieza: menu.pieza }),
        },
        {
          texto: "Agregar Prestación",
          icono: "➕",
          visible: puedeAgregar,
          deshabilitada: false,
          accion: () => setPanel({ pieza: menu.pieza, caras: [] }),
        },
        {
          texto: "Ver Información",
          icono: "ℹ️",
          visible: true,
          deshabilitada: false,
          accion: () => setModal({ tipo: "INFO", pieza: menu.pieza }),
        },
        {
          texto: "Marcar Ausente",
          icono: "✖",
          visible: permisos.editar,
          deshabilitada: esAusente(menu.pieza),
          accion: () => {
            const p = menu.pieza
            if (window.confirm(`¿Marcar la pieza ${p} como ausente? Se darán de baja sus hallazgos actuales.`))
              ejecutar(() => marcarAusente(pacienteId, p))
          },
        },
        {
          texto: "Marcar Sano (Borrar)",
          icono: "✔",
          visible: permisos.editar,
          deshabilitada: !tieneHallazgos(menu.pieza),
          accion: () => {
            const p = menu.pieza
            if (window.confirm(`¿Marcar la pieza ${p} como sana? Sus hallazgos quedarán en el historial.`))
              ejecutar(() => marcarSano(pacienteId, p))
          },
        },
      ].filter((o) => o.visible)
    : []

  const fila = (piezas: readonly (readonly number[])[]) => (
    <div className="flex justify-center gap-3 min-w-max">
      {piezas.map((cuadrante, i) => (
        <div key={i} className={`flex gap-0.5 ${i === 0 ? "pr-3 border-r-2 border-dashed border-slate-300" : ""}`}>
          {cuadrante.map((p) => (
            <Diente
              key={p}
              pieza={p}
              superior={esSuperior(p)}
              estado={estadoDe(p)}
              seleccionado={seleccionada === p}
              onClick={() => clicIzquierdo(p)}
              onContextMenu={(e) => clicDerecho(e, p)}
              onClickCara={(cara) => clicCara(p, cara)}
            />
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">
            {esGeneral ? "Odontograma general" : `Odontograma · Tratamiento N° ${tratamientoFijo?.numero}`}
          </h2>
          <p className="text-xs font-medium text-gray-500">
            {esGeneral
              ? "Reúne los hallazgos y las prestaciones de todos los tratamientos · Clic en un diente: menú de prestaciones · Clic derecho: más opciones"
              : `Clic en un diente: ${puedeAgregar ? "menú de prestaciones" : "ver información"} · Clic derecho: más opciones`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(["PERMANENTE", "TEMPORAL"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDenticion(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  denticion === d ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"
                }`}
              >
                {d === "PERMANENTE" ? "Permanente" : "Temporal"}
              </button>
            ))}
          </div>
          {puedeAgregar && (
            <button
              onClick={() => {
                setSeleccionada(null)
                setPanel({ pieza: null, caras: [] })
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100"
              title="Prestación que no es de una pieza (ej: limpieza, radiografía panorámica)"
            >
              + Prestación general
            </button>
          )}
        </div>
      </div>

      {aviso && (
        <p
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold border ${
            aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {panel && catalogo && (
          <PanelPrestaciones
            key={panel.pieza ?? "general"}
            pacienteId={pacienteId}
            pieza={panel.pieza}
            caras={panel.caras}
            onCambiarCaras={(caras) => setPanel((prev) => (prev ? { ...prev, caras } : prev))}
            catalogo={catalogo}
            tratamientos={tratamientos}
            tratamientoFijo={tratamientoFijo}
            onCerrar={() => {
              setPanel(null)
              setSeleccionada(null)
            }}
            onAgregada={(m) => setAviso(m)}
          />
        )}
        <div className={`flex-1 min-w-0 overflow-x-auto py-2 space-y-4 ${pendiente ? "opacity-60" : ""}`}>
          {fila(arcada.superior)}
          <div className="border-t border-dashed border-gray-300 mx-auto w-full" />
          {fila(arcada.inferior)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold text-gray-600">
        {[
          ["Preexistencia", COLORES.PREEXISTENCIA],
          ["Lesión", COLORES.LESION],
          ["Prestación por realizar", COLORES.PENDIENTE],
          ["Prestación realizada", COLORES.REALIZADO],
        ].map(([t, c]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: c }} />
            {t}
          </span>
        ))}
      </div>

      <details className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-2">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-gray-500">Simbología</summary>
        <div className="mt-3 space-y-3">
          {[
            { titulo: "Preexistencias", color: COLORES.PREEXISTENCIA, lista: Object.values(PREEXISTENCIAS).map((v) => ({ id: v.icono, etiqueta: v.etiqueta })) },
            { titulo: "Lesiones", color: COLORES.LESION, lista: Object.values(LESIONES).map((v) => ({ id: v.icono, etiqueta: v.etiqueta })) },
            { titulo: "Prestaciones", color: COLORES.PENDIENTE, lista: ICONOS_PRESTACION.map((v) => ({ id: v.id as string, etiqueta: v.etiqueta })) },
          ].map((grupo) => (
            <div key={grupo.titulo}>
              <p className="text-[11px] font-black uppercase text-gray-400 mb-1">{grupo.titulo}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {grupo.lista.map((x) => (
                  <span key={grupo.titulo + x.etiqueta} className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                    <IconoMuestra tipo={x.id} color={grupo.color} size={18} malEstado={x.etiqueta === "Restauración defectuosa"} />
                    {x.etiqueta}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      {menu && (
        <div
          className="fixed z-40 w-56 rounded-xl bg-white border border-gray-200 shadow-xl py-1"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <p className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-gray-400 border-b border-gray-100">
            Pieza {menu.pieza}
          </p>
          {opcionesMenu.map((o) => (
            <button
              key={o.texto}
              disabled={o.deshabilitada}
              onClick={() => {
                setMenu(null)
                o.accion()
              }}
              className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-white flex items-center gap-2"
            >
              <span className="w-5 text-center">{o.icono}</span>
              {o.texto}
            </button>
          ))}
        </div>
      )}

      {modal && (modal.tipo === "PREEXISTENCIA" || modal.tipo === "LESION") && (
        <ModalHallazgo
          pacienteId={pacienteId}
          pieza={modal.pieza}
          tipo={modal.tipo}
          onClose={() => setModal(null)}
          onDone={terminar}
        />
      )}
      {modal?.tipo === "INFO" && (
        <ModalInfo
          pieza={modal.pieza}
          hallazgos={hallazgos.filter((h) => h.pieza === modal.pieza)}
          items={items.filter((i) => i.pieza === modal.pieza)}
          avances={avances}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  )
}

"use client"

import { IconoDental } from "@/lib/iconos-dentales"
import { CARA_ETIQUETAS, caraDeZona, type Cara, type Zona } from "@/types/odontograma"

const SILUETAS = {
  incisivo: "M31 10 Q50 2 69 10 L74 54 L60 120 Q50 130 40 120 L26 54 Z",
  canino: "M50 2 L71 18 L75 54 L58 124 Q50 132 42 124 L25 54 L29 18 Z",
  premolar: "M24 14 Q37 3 50 11 Q63 3 76 14 L80 54 L62 121 Q50 130 38 121 L20 54 Z",
  molar:
    "M11 16 Q23 3 36 11 Q50 1 64 11 Q77 3 89 16 L91 55 L81 119 Q72 130 63 119 L56 74 Q50 67 44 74 L37 119 Q28 130 19 119 L9 55 Z",
}
const CUELLO = {
  incisivo: "M26 54 Q50 62 74 54",
  canino: "M25 54 Q50 62 75 54",
  premolar: "M20 54 Q50 63 80 54",
  molar: "M9 55 Q50 65 91 55",
}

function tipoDiente(pieza: number): keyof typeof SILUETAS {
  const n = pieza % 10
  const temporal = Math.floor(pieza / 10) >= 5
  if (n <= 2) return "incisivo"
  if (n === 3) return "canino"
  if (temporal) return "molar"
  return n <= 5 ? "premolar" : "molar"
}

const CARAS_PATHS: { zona: Zona; d?: string; letra: [number, number] }[] = [
  { zona: "arriba", d: "M 16 16 A 48 48 0 0 1 84 16 L 64 36 A 20 20 0 0 0 36 36 Z", letra: [50, 25] },
  { zona: "abajo", d: "M 84 84 A 48 48 0 0 1 16 84 L 36 64 A 20 20 0 0 0 64 64 Z", letra: [50, 79] },
  { zona: "izquierda", d: "M 16 84 A 48 48 0 0 1 16 16 L 36 36 A 20 20 0 0 0 36 64 Z", letra: [22, 53] },
  { zona: "derecha", d: "M 84 16 A 48 48 0 0 1 84 84 L 64 64 A 20 20 0 0 0 64 36 Z", letra: [78, 53] },
  { zona: "centro", letra: [50, 53] },
]

export function CarasCirculo({
  pieza,
  colores,
  size = 28,
  conLetras = false,
  onClickCara,
}: {
  pieza: number
  colores: Partial<Record<Cara, string>>
  size?: number
  conLetras?: boolean
  onClickCara?: (cara: Cara, e: React.MouseEvent) => void
}) {
  return (
    <svg width={size} height={size} viewBox="-2 -2 104 104" className="drop-shadow-sm shrink-0">
      {CARAS_PATHS.map(({ zona, d, letra }) => {
        const cara = caraDeZona(pieza, zona)
        const color = colores[cara]
        const props = {
          fill: color ?? "#ffffff",
          stroke: "#cbd5e1",
          strokeWidth: 3,
          className: onClickCara ? "cursor-pointer hover:opacity-70 transition-opacity" : "",
          onClick: onClickCara
            ? (e: React.MouseEvent) => {
                e.stopPropagation()
                onClickCara(cara, e)
              }
            : undefined,
        }
        return (
          <g key={zona}>
            {d ? <path d={d} {...props} /> : <circle cx="50" cy="50" r="20" {...props} />}
            <title>{`Cara ${CARA_ETIQUETAS[cara]}`}</title>
            {conLetras && (
              <text
                x={letra[0]}
                y={letra[1]}
                textAnchor="middle"
                className="pointer-events-none"
                fontSize="13"
                fontWeight="900"
                fill={color ? "#ffffff" : "#64748b"}
              >
                {cara}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export type IconoPieza = { tipo: string; color: string; malEstado?: boolean; titulo: string }
export type Tinte = "normal" | "preexistencia" | "lesion" | "pendiente" | "realizado"

export type EstadoDiente = {
  caras: Partial<Record<Cara, string>>
  iconos: IconoPieza[]
  ausente: boolean
  tinte: Tinte
}

const TINTES: Record<Tinte, { borde: string; corona: string }> = {
  normal: { borde: "#94a3b8", corona: "#ffffff" },
  preexistencia: { borde: "#93c5fd", corona: "#eff6ff" },
  lesion: { borde: "#f87171", corona: "#fef2f2" },
  pendiente: { borde: "#fbbf24", corona: "#fffbeb" },
  realizado: { borde: "#34d399", corona: "#ecfdf5" },
}

export function Diente({
  pieza,
  superior,
  estado,
  seleccionado,
  onClick,
  onContextMenu,
  onClickCara,
}: {
  pieza: number
  superior: boolean
  estado: EstadoDiente
  seleccionado: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onClickCara?: (cara: Cara, e: React.MouseEvent) => void
}) {
  const tipo = tipoDiente(pieza)
  const tinte = TINTES[estado.tinte]
  const idGradiente = `grad-${pieza}`
  const titulo = estado.iconos.length
    ? `Pieza ${pieza}: ${estado.iconos.map((i) => i.titulo).join(", ")}`
    : `Pieza ${pieza}`

  return (
    <div
      className={`flex items-center gap-1 rounded-xl px-0.5 py-1 transition-colors ${
        superior ? "flex-col" : "flex-col-reverse"
      } ${seleccionado ? "bg-blue-50 ring-2 ring-blue-400" : "hover:bg-slate-50"}`}
      onContextMenu={onContextMenu}
    >
      <svg
        width={38}
        height={50}
        viewBox="-8 -8 116 146"
        onClick={onClick}
        className="cursor-pointer overflow-visible drop-shadow-sm hover:scale-105 transition-transform"
        role="button"
        aria-label={titulo}
      >
        <title>{titulo}</title>
        <defs>
          <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tinte.corona} />
            <stop offset="42%" stopColor={estado.tinte === "normal" ? "#f8fafc" : tinte.corona} />
            <stop offset="50%" stopColor="#f6efdf" />
            <stop offset="100%" stopColor="#eadfc6" />
          </linearGradient>
        </defs>

        <g transform={superior ? "translate(0,130) scale(1,-1)" : undefined} opacity={estado.ausente ? 0.35 : 1}>
          <path d={SILUETAS[tipo]} fill={`url(#${idGradiente})`} stroke={tinte.borde} strokeWidth={4} strokeLinejoin="round" />
          <path d={CUELLO[tipo]} fill="none" stroke="#d6cbb3" strokeWidth={2.5} />
          {!estado.ausente &&
            estado.iconos.map((ic, i) => <IconoDental key={i} tipo={ic.tipo} color={ic.color} malEstado={ic.malEstado} />)}
        </g>
        {estado.ausente && (
          <g stroke="#475569" strokeWidth={10} strokeLinecap="round" opacity={0.75}>
            <line x1="12" y1="10" x2="88" y2="120" />
            <line x1="88" y1="10" x2="12" y2="120" />
          </g>
        )}
      </svg>

      <span onClick={onClick} className="cursor-pointer text-[10px] font-black italic text-slate-400 leading-none">
        {pieza}
      </span>

      <div className={estado.ausente ? "opacity-30 pointer-events-none" : ""}>
        <CarasCirculo pieza={pieza} colores={estado.caras} onClickCara={onClickCara} />
      </div>
    </div>
  )
}

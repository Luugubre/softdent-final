"use client"

import { useId } from "react"

// Los datos y funciones (lista de íconos, iconoPorNombre) están en lib/iconos-datos.ts,
// para poder usarlos también desde el servidor.

// =====================================================================
// Íconos del odontograma.
// Se dibujan en el "espacio del diente": 100 × 130, con la corona arriba
// (y 0-58) y la raíz abajo (y 58-130). En los dientes superiores el
// diente completo se voltea, así que los íconos quedan en su lugar.
// =====================================================================

/** Ícono dibujado dentro del diente */
export function IconoDental({ tipo, color, malEstado = false }: { tipo: string; color: string; malEstado?: boolean }) {
  const id = useId().replace(/:/g, "")
  const relleno = malEstado ? `url(#rayado-${id})` : color
  const patron = malEstado ? (
    <defs>
      <pattern id={`rayado-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="3" />
      </pattern>
    </defs>
  ) : null
  const trazo = { stroke: color, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

  switch (tipo) {
    // ---------------- Caras / corona ----------------
    case "restauracion":
      return <g>{patron}<rect x="33" y="17" width="34" height="26" rx="9" fill={relleno} /></g>
    case "amalgama":
      return <g>{patron}<path d="M38 20 Q50 10 62 20 Q73 30 62 40 Q50 50 38 40 Q27 30 38 20 Z" fill={relleno} /></g>
    case "caries":
      return <g>{patron}<path d="M40 19 Q48 12 56 18 Q67 17 64 27 Q71 36 60 41 Q52 47 44 41 Q33 42 36 32 Q29 23 40 19 Z" fill={relleno} /></g>
    case "incrustacion":
      return <g>{patron}<polygon points="32,18 68,18 61,43 39,43" fill={relleno} /></g>
    case "sellante":
      return <path d="M18 20 Q28 9 38 20 T58 20 T78 20" {...trazo} strokeWidth="7" />
    case "corona":
      return <path d="M14 12 Q50 -6 86 12 L88 57 Q50 66 12 57 Z" {...trazo} fill={malEstado ? relleno : "none"} strokeWidth="7" />
    case "carilla":
      return <g>{patron}<path d="M20 10 Q36 32 20 56 Q10 33 20 10 Z" fill={relleno} /></g>
    case "atricion":
      return <line x1="18" y1="7" x2="82" y2="7" {...trazo} strokeWidth="9" />
    case "fractura":
      return <path d="M64 4 L44 30 L60 33 L36 66" {...trazo} strokeWidth="7" />

    // ---------------- Raíz ----------------
    case "endodoncia":
      return <path d="M42 56 L40 122 M58 56 L60 122" {...trazo} strokeWidth="7" />
    case "perno":
      return <g>{patron}<polygon points="36,28 64,28 53,104 47,104" fill={relleno} stroke={color} strokeWidth="3" strokeLinejoin="round" /></g>
    case "implante":
      return (
        <g>
          <rect x="40" y="56" width="20" height="68" rx="6" fill={relleno} />
          {[70, 84, 98, 112].map((y) => (
            <line key={y} x1="32" y1={y} x2="68" y2={y} stroke={color} strokeWidth="5" strokeLinecap="round" />
          ))}
        </g>
      )
    case "implante_corona":
      return (
        <g>
          <rect x="40" y="58" width="20" height="66" rx="6" fill={color} />
          {[72, 88, 104].map((y) => (
            <line key={y} x1="32" y1={y} x2="68" y2={y} stroke={color} strokeWidth="5" strokeLinecap="round" />
          ))}
          <path d="M16 14 Q50 -4 84 14 L86 52 Q50 60 14 52 Z" {...trazo} strokeWidth="7" />
        </g>
      )
    case "infeccion":
      return <circle cx="50" cy="126" r="11" fill={relleno} />
    case "rr":
      return (
        <g>
          <path d="M40 60 L42 120 M60 60 L58 120" {...trazo} strokeWidth="11" />
          <line x1="24" y1="58" x2="76" y2="58" stroke={color} strokeWidth="5" strokeDasharray="6 5" />
        </g>
      )
    case "retenido":
      return <path d="M50 8 L50 104 M35 88 L50 106 L65 88" {...trazo} strokeWidth="8" />

    // ---------------- Pieza completa ----------------
    case "fija":
      return (
        <g stroke={color} strokeLinecap="round">
          <line x1="-2" y1="30" x2="102" y2="30" strokeWidth="11" />
          <line x1="18" y1="30" x2="18" y2="54" strokeWidth="6" />
          <line x1="82" y1="30" x2="82" y2="54" strokeWidth="6" />
        </g>
      )
    case "removible":
      return (
        <g stroke={color} strokeLinecap="round" strokeWidth="7">
          <line x1="6" y1="22" x2="94" y2="22" />
          <line x1="6" y1="40" x2="94" y2="40" />
        </g>
      )
    case "extraccion":
      return (
        <g stroke={color} strokeWidth="11" strokeLinecap="round" opacity="0.9">
          <line x1="10" y1="8" x2="90" y2="122" />
          <line x1="90" y1="8" x2="10" y2="122" />
        </g>
      )
    case "cirugia":
      return (
        <g {...trazo} strokeWidth="7">
          <circle cx="50" cy="64" r="44" />
          <line x1="30" y1="44" x2="70" y2="84" />
          <line x1="70" y1="44" x2="30" y2="84" />
        </g>
      )
    case "movilidad":
      return (
        <g {...trazo} strokeWidth="7">
          <path d="M4 26 Q-10 60 4 94" />
          <path d="M96 26 Q110 60 96 94" />
        </g>
      )
    case "ortodoncia":
      return (
        <g>
          <rect x="35" y="19" width="30" height="24" rx="6" fill="none" stroke={color} strokeWidth="7" />
          <line x1="-2" y1="31" x2="102" y2="31" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case "limpieza":
      return (
        <g fill={color}>
          <circle cx="32" cy="20" r="7" />
          <circle cx="66" cy="24" r="6" />
          <circle cx="47" cy="42" r="8" />
        </g>
      )
    case "blanqueamiento":
      return <path d="M50 8 L55 25 L72 30 L55 35 L50 52 L45 35 L28 30 L45 25 Z" fill={color} />
    case "rayos":
      return (
        <g {...trazo} strokeWidth="6">
          <rect x="27" y="14" width="46" height="34" rx="7" />
          <circle cx="50" cy="31" r="8" />
        </g>
      )
    case "otro":
      return <polygon points="50,6 57,21 73,23 61,34 64,50 50,42 36,50 39,34 27,23 43,21" fill={relleno} />
    default:
      return <circle cx="50" cy="30" r="14" fill={relleno} opacity="0.9" />
  }
}

const SILUETA_MUESTRA =
  "M24 14 Q37 4 50 12 Q63 4 76 14 L80 52 L62 120 Q50 128 38 120 L20 52 Z"

/** Miniatura del ícono sobre un diente gris, para leyendas y selectores */
export function IconoMuestra({ tipo, color, size = 28, malEstado }: { tipo: string; color: string; size?: number; malEstado?: boolean }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="-8 -8 116 146" className="shrink-0">
      <path d={SILUETA_MUESTRA} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="4" />
      <IconoDental tipo={tipo} color={color} malEstado={malEstado} />
    </svg>
  )
}

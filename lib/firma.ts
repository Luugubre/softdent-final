// Normaliza la firma: conserva solo los trazos (comandos M/L) y reconstruye el SVG.

const TRAZO = /\sd="([MLml0-9.,\s-]{3,20000})"/g
const MAX_TRAZOS = 300
const MAX_LARGO = 200_000

export function normalizarFirmaSvg(entrada: string | null | undefined): string | null {
  if (!entrada || entrada.length > MAX_LARGO) return null
  const trazos = [...entrada.matchAll(TRAZO)].map((m) => m[1].replace(/\s+/g, " ").trim()).slice(0, MAX_TRAZOS)
  if (trazos.length === 0) return null
  const paths = trazos
    .map((d) => `<path d="${d}" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160">${paths}</svg>`
}

// Escape de HTML
export function escaparHtml(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Valida el destino de "?next=" para que solo pueda ser una ruta interna de la app.
// Evita "open redirect": /\sitio.com o //sitio.com los navegadores los tratan como otro dominio.
export function rutaSegura(destino: string | null | undefined): string {
  if (!destino || !destino.startsWith("/") || destino.startsWith("//")) return "/"
  if (destino.includes("\\") || /[\u0000-\u001f\u007f]/.test(destino)) return "/"

  try {
    const base = "http://softdent.local"
    const url = new URL(destino, base)
    if (url.origin !== base) return "/"
    if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return "/"
    return url.pathname + url.search + url.hash
  } catch {
    return "/"
  }
}
// Datos de la clínica que aparecen en los mensajes de WhatsApp y en la hoja de ruta.
// Cámbialos por los de tu clínica.
export const NOMBRE_CLINICA = "Clínica Dental SoftDent"
export const DIRECCION_CLINICA = "" // ej: "Av. Siempre Viva 742, Santiago"

/** Normaliza teléfonos chilenos para wa.me (9 dígitos → 56XXXXXXXXX; 8 dígitos → 569XXXXXXXX) */
export function telefonoWhatsapp(tel?: string | null): string | null {
  const n = (tel ?? "").replace(/\D/g, "")
  if (!n) return null
  if (n.length === 9) return `56${n}`
  if (n.length === 8) return `569${n}`
  return n.length >= 10 ? n : null
}

export function enlaceWhatsapp(tel: string | null | undefined, mensaje: string) {
  const n = telefonoWhatsapp(tel)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}` : null
}

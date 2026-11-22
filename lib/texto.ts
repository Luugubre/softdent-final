// Utilidades de texto de costo lineal (sin expresiones regulares con retroceso)

export function quitarEtiquetas(html: string, reemplazo = ""): string {
  let salida = ""
  let dentro = false
  for (const c of html) {
    if (c === "<") {
      dentro = true
    } else if (c === ">" && dentro) {
      dentro = false
      salida += reemplazo
    } else if (!dentro) {
      salida += c
    }
  }
  return salida
}

export function recortarCaracter(texto: string, caracter: string): string {
  let inicio = 0
  let fin = texto.length
  while (inicio < fin && texto[inicio] === caracter) inicio++
  while (fin > inicio && texto[fin - 1] === caracter) fin--
  return texto.slice(inicio, fin)
}

export function correoValido(correo: string): boolean {
  if (/\s/.test(correo)) return false
  const partes = correo.split("@")
  if (partes.length !== 2) return false
  const [usuario, dominio] = partes
  const punto = dominio.lastIndexOf(".")
  return usuario.length > 0 && punto > 0 && punto < dominio.length - 1
}

export function separarMiles(digitos: string, separador = "."): string {
  let salida = ""
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) salida += separador
    salida += digitos[i]
  }
  return salida
}

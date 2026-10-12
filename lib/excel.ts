import { deflateRawSync } from "zlib"

export type TipoColumna = "texto" | "pesos" | "numero" | "porcentaje"

export type Columna = { titulo: string; ancho?: number; tipo?: TipoColumna }

export type Celda = string | number | null | undefined

export type Hoja = {
  nombre: string
  titulo?: string
  subtitulo?: string
  columnas: Columna[]
  filas: Celda[][]
  totales?: Celda[]
  filtro?: boolean
}

const ESTILO = { normal: 0, encabezado: 1, pesos: 2, titulo: 3, porcentaje: 4, totalTexto: 5, totalPesos: 6, numero: 7, subtitulo: 8, totalNumero: 9 }

const ESTILOS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/><numFmt numFmtId="165" formatCode="0&quot;%&quot;"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><color rgb="FF1D4ED8"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="FF9CA3AF"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="3" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function escapar(texto: string) {
  return texto
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function letraColumna(indice: number) {
  let n = indice + 1
  let letras = ""
  while (n > 0) {
    const resto = (n - 1) % 26
    letras = String.fromCharCode(65 + resto) + letras
    n = Math.floor((n - 1) / 26)
  }
  return letras
}

function celdaXml(ref: string, valor: Celda, estilo: number) {
  if (valor === null || valor === undefined || valor === "") return estilo ? `<c r="${ref}" s="${estilo}"/>` : ""
  if (typeof valor === "number" && Number.isFinite(valor)) return `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>`
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(String(valor))}</t></is></c>`
}

function estiloColumna(tipo: TipoColumna | undefined, total: boolean) {
  if (tipo === "pesos") return total ? ESTILO.totalPesos : ESTILO.pesos
  if (tipo === "numero") return total ? ESTILO.totalNumero : ESTILO.numero
  if (tipo === "porcentaje") return total ? ESTILO.totalTexto : ESTILO.porcentaje
  return total ? ESTILO.totalTexto : ESTILO.normal
}

function hojaXml(hoja: Hoja) {
  const filas: string[] = []
  let r = 1
  if (hoja.titulo) {
    filas.push(`<row r="${r}" ht="22" customHeight="1">${celdaXml(`A${r}`, hoja.titulo, ESTILO.titulo)}</row>`)
    r++
  }
  if (hoja.subtitulo) {
    filas.push(`<row r="${r}">${celdaXml(`A${r}`, hoja.subtitulo, ESTILO.subtitulo)}</row>`)
    r++
  }
  if (hoja.titulo || hoja.subtitulo) r++

  const filaEncabezado = r
  filas.push(
    `<row r="${r}" ht="30" customHeight="1">${hoja.columnas.map((c, i) => celdaXml(`${letraColumna(i)}${r}`, c.titulo, ESTILO.encabezado)).join("")}</row>`
  )
  r++

  for (const fila of hoja.filas) {
    filas.push(
      `<row r="${r}">${hoja.columnas.map((c, i) => celdaXml(`${letraColumna(i)}${r}`, fila[i], estiloColumna(c.tipo, false))).join("")}</row>`
    )
    r++
  }
  const ultimaFilaDatos = r - 1

  if (hoja.totales) {
    filas.push(
      `<row r="${r}">${hoja.columnas.map((c, i) => celdaXml(`${letraColumna(i)}${r}`, hoja.totales?.[i], estiloColumna(c.tipo, true))).join("")}</row>`
    )
  }

  const ultimaColumna = letraColumna(Math.max(hoja.columnas.length - 1, 0))
  const anchos = hoja.columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho ?? 14}" customWidth="1"/>`).join("")
  const filtro = hoja.filtro !== false && hoja.filas.length > 0 ? `<autoFilter ref="A${filaEncabezado}:${ultimaColumna}${ultimaFilaDatos}"/>` : ""

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${filaEncabezado}" topLeftCell="A${filaEncabezado + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${anchos}</cols>
<sheetData>${filas.join("")}</sheetData>
${filtro}
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`
}

function nombreHoja(nombre: string, usados: Set<string>) {
  let base = nombre.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Hoja"
  let candidato = base
  let n = 2
  while (usados.has(candidato.toLowerCase())) {
    const sufijo = ` (${n++})`
    candidato = base.slice(0, 31 - sufijo.length) + sufijo
  }
  usados.add(candidato.toLowerCase())
  return candidato
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(datos: Buffer) {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function crearZip(archivos: { nombre: string; contenido: string }[]) {
  const partes: Buffer[] = []
  const central: Buffer[] = []
  let desplazamiento = 0

  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, "utf8")
    const datos = Buffer.from(a.contenido, "utf8")
    const comprimido = deflateRawSync(datos)
    const crc = crc32(datos)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(datos.length, 22)
    local.writeUInt16LE(nombre.length, 26)
    local.writeUInt16LE(0, 28)
    partes.push(local, nombre, comprimido)

    const cabecera = Buffer.alloc(46)
    cabecera.writeUInt32LE(0x02014b50, 0)
    cabecera.writeUInt16LE(20, 4)
    cabecera.writeUInt16LE(20, 6)
    cabecera.writeUInt16LE(0x0800, 8)
    cabecera.writeUInt16LE(8, 10)
    cabecera.writeUInt16LE(0, 12)
    cabecera.writeUInt16LE(0x21, 14)
    cabecera.writeUInt32LE(crc, 16)
    cabecera.writeUInt32LE(comprimido.length, 20)
    cabecera.writeUInt32LE(datos.length, 24)
    cabecera.writeUInt16LE(nombre.length, 28)
    cabecera.writeUInt32LE(desplazamiento, 42)
    central.push(cabecera, nombre)

    desplazamiento += local.length + nombre.length + comprimido.length
  }

  const directorio = Buffer.concat(central)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(archivos.length, 8)
  fin.writeUInt16LE(archivos.length, 10)
  fin.writeUInt32LE(directorio.length, 12)
  fin.writeUInt32LE(desplazamiento, 16)

  return Buffer.concat([...partes, directorio, fin])
}

export function crearExcel(hojas: Hoja[]): Buffer {
  const usados = new Set<string>()
  const nombres = hojas.map((h) => nombreHoja(h.nombre, usados))

  const archivos = [
    {
      nombre: "[Content_Types].xml",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`,
    },
    {
      nombre: "_rels/.rels",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      nombre: "xl/workbook.xml",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${nombres.map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`,
    },
    {
      nombre: "xl/_rels/workbook.xml.rels",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { nombre: "xl/styles.xml", contenido: ESTILOS_XML },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: hojaXml(h) })),
  ]

  return crearZip(archivos)
}

export function respuestaExcel(libro: Buffer, archivo: string) {
  const nombre = archivo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-")
  return new Response(new Uint8Array(libro), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  })
}

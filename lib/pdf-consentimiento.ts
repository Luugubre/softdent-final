import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function limpiarHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function envolverLinea(texto: string, maxChars = 88): string[] {
  const limpio = texto.trim();
  if (!limpio) return [];
  if (limpio.length <= maxChars) return [limpio];

  const palabras = limpio.split(/\s+/);
  const resultado: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    if ((actual + ' ' + palabra).trim().length <= maxChars) {
      actual = (actual + ' ' + palabra).trim();
    } else {
      if (actual) resultado.push(actual);
      actual = palabra;
    }
  }
  if (actual) resultado.push(actual);
  return resultado;
}

function extraerBytesPng(dataUrlOrBase64?: string | null): Uint8Array | null {
  if (!dataUrlOrBase64) return null;
  const trimmed = dataUrlOrBase64.trim();
  if (trimmed.startsWith('data:image/png;base64,')) {
    const b64 = trimmed.slice('data:image/png;base64,'.length);
    return Buffer.from(b64, 'base64');
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 100) {
    return Buffer.from(trimmed, 'base64');
  }
  return null;
}

export interface DatosPdfConsentimiento {
  id: string;
  folio?: number | null;
  titulo: string;
  estado: string;
  contenido_snapshot: string;
  hash_contenido_sha256?: string | null;
  firma_paciente_url?: string | null;
  firma_doctor_url?: string | null;
  firmado_at?: string | null;
  firmante_nombre?: string | null;
  firmante_rut?: string | null;
  firmante_es_apoderado?: boolean | null;
  firmante_ip?: string | null;
  paciente_nombre?: string | null;
  paciente_rut?: string | null;
  doctor_nombre?: string | null;
  doctor_especialidad?: string | null;
  doctor_registro?: string | null;
  doctor_firma_svg?: string | null;
  motivo_revocacion?: string | null;
}

export async function generarPdfConsentimientoBase64(doc: DatosPdfConsentimiento): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();
  const folioTexto = doc.folio ? `N° ${String(doc.folio).padStart(6, '0')}` : doc.id.slice(0, 8).toUpperCase();
  let y = height - 48;

  // Encabezado
  page.drawText(`CONSENTIMIENTO INFORMADO · FOLIO ${folioTexto}`, {
    x: 50,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.35, 0.35, 0.4),
  });
  page.drawText(`ESTADO: ${doc.estado}`, {
    x: width - 190,
    y,
    size: 9,
    font: fontBold,
    color:
      doc.estado === 'FIRMADO'
        ? rgb(0.08, 0.5, 0.24)
        : doc.estado === 'REVOCADO'
        ? rgb(0.75, 0.12, 0.15)
        : rgb(0.65, 0.4, 0.05),
  });
  y -= 24;

  // Título
  for (const lineaTitulo of envolverLinea(doc.titulo || 'Consentimiento Informado', 62)) {
    page.drawText(lineaTitulo, {
      x: 50,
      y,
      size: 13,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.55),
    });
    y -= 18;
  }
  y -= 6;

  // Identificación del paciente
  if (doc.paciente_nombre) {
    page.drawText(
      `Paciente: ${doc.paciente_nombre}${doc.paciente_rut ? ` · RUT: ${doc.paciente_rut}` : ''}`,
      { x: 50, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) }
    );
    y -= 16;
  }

  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.6,
    color: rgb(0.85, 0.85, 0.88),
  });
  y -= 18;

  // Cuerpo del documento congelado (snapshot)
  const textoLimpio = limpiarHtml(doc.contenido_snapshot || '');
  const parrafos = textoLimpio.split('\n');

  for (const parrafo of parrafos) {
    const trimmed = parrafo.trim();
    if (!trimmed) {
      y -= 6;
      continue;
    }

    const sublineas = envolverLinea(trimmed, 88);
    for (const linea of sublineas) {
      if (y < 235) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }
      page.drawText(linea, {
        x: 50,
        y,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.12, 0.12, 0.12),
      });
      y -= 13.5;
    }
  }

  // Asegurar espacio suficiente para bloque de firmas + pie legal (~215pt)
  if (y < 235) {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = height - 55;
  }

  y -= 14;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.7,
    color: rgb(0.8, 0.8, 0.85),
  });
  y -= 18;

  // Bloque de dos columnas: Firma Paciente (izquierda) y Firma Doctor (derecha)
  const colIzqX = 50;
  const colDerX = width / 2 + 15;
  const anchoCaja = width / 2 - 65;
  const altoCajaFirma = 68;
  const baseCajaY = y - altoCajaFirma;

  // Recuadros visuales para firmas
  page.drawRectangle({
    x: colIzqX,
    y: baseCajaY,
    width: anchoCaja,
    height: altoCajaFirma,
    borderColor: rgb(0.82, 0.84, 0.88),
    borderWidth: 0.7,
    color: rgb(0.99, 0.99, 1),
  });

  page.drawRectangle({
    x: colDerX,
    y: baseCajaY,
    width: anchoCaja,
    height: altoCajaFirma,
    borderColor: rgb(0.82, 0.84, 0.88),
    borderWidth: 0.7,
    color: rgb(0.99, 0.99, 1),
  });

  // Incrustar firma PNG del paciente
  const bytesFirmaPaciente = extraerBytesPng(doc.firma_paciente_url);
  if (bytesFirmaPaciente) {
    try {
      const imgPaciente = await pdfDoc.embedPng(bytesFirmaPaciente);
      const dims = imgPaciente.scaleToFit(anchoCaja - 16, altoCajaFirma - 10);
      page.drawImage(imgPaciente, {
        x: colIzqX + (anchoCaja - dims.width) / 2,
        y: baseCajaY + (altoCajaFirma - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      });
    } catch (e) {
      console.error('No se pudo incrustar PNG firma paciente:', e);
    }
  } else {
    page.drawText('Pendiente de firma', {
      x: colIzqX + 55,
      y: baseCajaY + 30,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.55, 0.55, 0.6),
    });
  }

  // Incrustar firma del doctor (si es PNG base64 o timbre profesional)
  const bytesFirmaDoctor = extraerBytesPng(doc.firma_doctor_url || doc.doctor_firma_svg);
  if (bytesFirmaDoctor) {
    try {
      const imgDoctor = await pdfDoc.embedPng(bytesFirmaDoctor);
      const dims = imgDoctor.scaleToFit(anchoCaja - 16, altoCajaFirma - 10);
      page.drawImage(imgDoctor, {
        x: colDerX + (anchoCaja - dims.width) / 2,
        y: baseCajaY + (altoCajaFirma - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      });
    } catch (e) {
      console.error('No se pudo incrustar PNG firma doctor:', e);
    }
  } else if (doc.doctor_nombre) {
    // Timbre digital del profesional tratante
    page.drawText('FIRMADO DIGITALMENTE POR PROFESIONAL', {
      x: colDerX + 12,
      y: baseCajaY + 46,
      size: 7,
      font: fontBold,
      color: rgb(0.12, 0.25, 0.55),
    });
    page.drawText(doc.doctor_nombre, {
      x: colDerX + 12,
      y: baseCajaY + 32,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.15),
    });
    if (doc.doctor_especialidad || doc.doctor_registro) {
      page.drawText(
        [doc.doctor_especialidad, doc.doctor_registro ? `Reg. ${doc.doctor_registro}` : null]
          .filter(Boolean)
          .join(' · '),
        {
          x: colDerX + 12,
          y: baseCajaY + 18,
          size: 7.5,
          font: fontRegular,
          color: rgb(0.35, 0.35, 0.4),
        }
      );
    }
  }

  // Etiquetas debajo de cada caja de firma
  let yLabel = baseCajaY - 13;
  page.drawText('FIRMA DEL PACIENTE / REPRESENTANTE', {
    x: colIzqX,
    y: yLabel,
    size: 8,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.2),
  });
  page.drawText('FIRMA DEL PROFESIONAL TRATANTE', {
    x: colDerX,
    y: yLabel,
    size: 8,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.2),
  });

  yLabel -= 12;
  const descFirmante = doc.firmante_nombre
    ? `${doc.firmante_nombre}${doc.firmante_rut ? ` (${doc.firmante_rut})` : ''}${doc.firmante_es_apoderado ? ' · Apoderado' : ''}`
    : doc.paciente_nombre || '';
  if (descFirmante) {
    page.drawText(descFirmante.slice(0, 46), {
      x: colIzqX,
      y: yLabel,
      size: 8,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.35),
    });
  }
  if (doc.doctor_nombre) {
    page.drawText(doc.doctor_nombre.slice(0, 46), {
      x: colDerX,
      y: yLabel,
      size: 8,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.35),
    });
  }

  // Si está revocado, agregar nota de revocación
  if (doc.estado === 'REVOCADO' && doc.motivo_revocacion) {
    yLabel -= 16;
    page.drawText(`DOCUMENTO REVOCADO: ${doc.motivo_revocacion}`, {
      x: 50,
      y: yLabel,
      size: 8.5,
      font: fontBold,
      color: rgb(0.75, 0.12, 0.15),
    });
  }

  // Pie legal con fecha de firma, folio y hash SHA-256
  const pieY = 42;
  page.drawRectangle({
    x: 50,
    y: pieY,
    width: width - 100,
    height: 44,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: rgb(0.84, 0.86, 0.9),
    borderWidth: 0.6,
  });

  const fechaFirmaTexto = doc.firmado_at
    ? new Date(doc.firmado_at).toLocaleString('es-CL', {
        timeZone: 'America/Santiago',
        dateStyle: 'short',
        timeStyle: 'medium',
      })
    : 'Pendiente';

  page.drawText(
    `Folio: ${folioTexto}  |  Fecha de firma: ${fechaFirmaTexto}${doc.firmante_ip ? `  |  IP: ${doc.firmante_ip}` : ''}`,
    {
      x: 58,
      y: pieY + 28,
      size: 7.5,
      font: fontBold,
      color: rgb(0.2, 0.22, 0.28),
    }
  );
  page.drawText(`Hash SHA-256: ${doc.hash_contenido_sha256 || 'No generado'}`, {
    x: 58,
    y: pieY + 13,
    size: 7,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.4),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}
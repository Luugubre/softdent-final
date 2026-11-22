"use server"

import { revalidatePath } from "next/cache"
import { registrarCambio } from "@/lib/registro-auditoria"
import { autorizar } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"
import { MENSAJE_SIN_PERMISO } from "@/lib/permisos"
import { plantillaSchema } from "@/lib/validaciones"
import { limpiarHtmlDocumento } from "@/lib/html-seguro"

type PlantillaPayload = {
  tipo: string
  nombre: string
  contenido: string
}

// Plantillas base iniciales
const PLANTILLAS_BASE = [
  {
    tipo: "CONSENTIMIENTO_EXTRACCION",
    nombre: "Consentimiento Informado para Exodoncia / Extracción Dental",
    contenido: `CONSENTIMIENTO INFORMADO PARA EXODONCIA (EXTRACCIÓN DENTAL)

En la ciudad de Santiago, a {{fecha}}, el/la paciente {{paciente.nombre}}, RUT {{paciente.rut}}, de {{paciente.edad}} años de edad, declara haber sido informado/a por el/la profesional Dr(a). {{profesional.nombre}} (Reg. N° {{profesional.registro}}) sobre la necesidad de realizar el procedimiento de extracción dental de las siguientes prestaciones: {{prestaciones}}.

DECLARACIONES DEL PACIENTE:
1. Comprendo el diagnóstico, la naturaleza del procedimiento de exodoncia y los beneficios esperados.
2. He sido informado/a de los riesgos potenciales, tales como: hemorragia postoperatoria, infección, inflamación, dolor, hematomas, alveolitis post-extracción y eventual parestesia temporal o permanente de nervios adyacentes.
3. Me comprometo a seguir rigurosamente las indicaciones postoperatorias prescritas en la clínica {{clinica.nombre}}.

Firma del Paciente: _______________________
RUT: {{paciente.rut}}

Dr(a). {{profesional.nombre}}
Cirujano Dentista - Reg. {{profesional.registro}}
{{clinica.nombre}}`,
  },
  {
    tipo: "CONSENTIMIENTO_ENDODONCIA",
    nombre: "Consentimiento Informado para Tratamiento de Conducto (Endodoncia)",
    contenido: `CONSENTIMIENTO INFORMADO PARA TRATAMIENTO DE ENDODONCIA

Fecha: {{fecha}}
Paciente: {{paciente.nombre}} | RUT: {{paciente.rut}} | Edad: {{paciente.edad}} años
Profesional Tratante: Dr(a). {{profesional.nombre}} (Reg. {{profesional.registro}})
Clínica: {{clinica.nombre}}

Por medio del presente documento, acepto la realización del tratamiento de conducto (endodoncia) para las prestaciones: {{prestaciones}}.

INFORMACIÓN SOBRE EL PROCEDIMIENTO Y RIESGOS:
- Comprendo que el objetivo es conservar la pieza dental eliminando el tejido pulpar infectado o inflamado.
- Admito conocer los posibles riesgos o complicaciones, incluyendo dolor o molestia post-tratamiento, fractura del instrumento dentro del conducto, perforación radicular o fracaso del tratamiento que requiera cirugía apical o exodoncia.
- Entiendo que tras la endodoncia la pieza dental requiere una restauración o corona definitiva.

Firma del Paciente: _______________________
Nombre: {{paciente.nombre}}
RUT: {{paciente.rut}}`,
  },
  {
    tipo: "CONSENTIMIENTO_IMPLANTE",
    nombre: "Consentimiento Informado para Implantología Oral",
    contenido: `CONSENTIMIENTO INFORMADO PARA IMPLANTOLOGÍA ORAL Y CIRUGÍA GUIADA

Con fecha {{fecha}}, se emite el presente consentimiento para el/la paciente {{paciente.nombre}}, RUT {{paciente.rut}}, de {{paciente.edad}} años.

El/la Dr(a). {{profesional.nombre}}, profesional de {{clinica.nombre}}, me ha explicado la necesidad quirúrgica e instalación de implantes osteointegrados para la rehabilitación de: {{prestaciones}}.

COMPROMISOS Y RIESGOS:
- Sé que el éxito del implante depende de la respuesta ósea y del mantenimiento de una correcta higiene bucal.
- Se me han explicado riesgos como fallo en la osteointegración, periimplantitis, sangrado, parestesia del nervio dentario o necesidad de injertos óseos adicionales.
- Acepto acudir a los controles periódicos programados en {{clinica.nombre}}.

Firma Paciente: _______________________
RUT: {{paciente.rut}}

Firma Profesional: _______________________
Dr(a). {{profesional.nombre}} - Reg. {{profesional.registro}}`,
  },
  {
    tipo: "CONSENTIMIENTO_ORTODONCIA",
    nombre: "Consentimiento Informado para Tratamiento de Ortodoncia",
    contenido: `CONSENTIMIENTO INFORMADO PARA TRATAMIENTO DE ORTODONCIA

Fecha de emisión: {{fecha}}
Paciente: {{paciente.nombre}} (RUT: {{paciente.rut}}, {{paciente.edad}} años)
Atendido por: Dr(a). {{profesional.nombre}} (Reg. {{profesional.registro}})
Lugar: {{clinica.nombre}}

Declaro haber recibido explicación detallada sobre el plan de tratamiento ortodóncico propuesto ({{prestaciones}}).

PUNTOS CLAVE DEL TRATAMIENTO:
1. Comprendo la importancia de utilizar los aparatos indicados y mantener impecable la higiene oral para evitar descalcificaciones o caries.
2. Entiendo los riesgos asociados: reabsorción radicular leve, molestias al ajustar aparatología, gingivitis o recaída post-tratamiento si no utilizo los retenedores.
3. El tiempo total estimado de tratamiento es aproximado y dependerá del cumplimiento de mis citas de control.

Firma Paciente / Tutor: _______________________
RUT: {{paciente.rut}}`,
  },
  {
    tipo: "CONSENTIMIENTO_BLANQUEAMIENTO",
    nombre: "Consentimiento Informado para Blanqueamiento Dental",
    contenido: `CONSENTIMIENTO INFORMADO PARA BLANQUEAMIENTO DENTAL

En {{clinica.nombre}}, a {{fecha}}, el/la paciente {{paciente.nombre}} (RUT: {{paciente.rut}}, {{paciente.edad}} años) consiente la realización del procedimiento de blanqueamiento dental.

PROFESIONAL RESPONSABLE: Dr(a). {{profesional.nombre}} (Reg. {{profesional.registro}}).

ADVERTENCIAS Y EFECTOS SECUNDARIOS:
- Comprendo que el blanqueamiento actúa sobre dientes naturales y no altera el color de resinas, coronas o carillas preexistentes.
- Acepto que es normal experimentar sensibilidad dentaria temporal o irritación gingival leve durante o después del procedimiento.
- Me comprometo a cumplir con la "dieta blanca" (evitar café, té, vino tinto y tabaco) durante las 48 horas posteriores.

Firma Paciente: _______________________
RUT: {{paciente.rut}}`,
  },
  {
    tipo: "CONSENTIMIENTO_ANESTESIA",
    nombre: "Consentimiento Informado para Administración de Anestesia Local",
    contenido: `CONSENTIMIENTO INFORMADO PARA ANESTESIA LOCAL ODONTOLÓGICA

Fecha: {{fecha}}
Paciente: {{paciente.nombre}} | RUT: {{paciente.rut}} | Edad: {{paciente.edad}} años
Atendido en: {{clinica.nombre}} por Dr(a). {{profesional.nombre}} (Reg. {{profesional.registro}}).

Declaro haber sido informado/a sobre la aplicación de anestesia local para realizar los procedimientos: {{prestaciones}}.

INFORMACIÓN AL PACIENTE:
- Comprendo que la anestesia local adormece la zona para evitar el dolor durante el tratamiento.
- Se me han advertido riesgos inusuales como hematomas en el sitio de punción, reacciones alérgicas, o adormecimiento prolongado (parestesia).
- Me comprometo a tener precaución de no morder mi labio, lengua o mejilla mientras persista el efecto anestésico.

Firma del Paciente: _______________________
RUT: {{paciente.rut}}`,
  },
]

type PlantillaFila = {
  id: string
  tipo: string
  nombre: string
  contenido: string
  version: number
  activa: boolean
  updated_at: string
}

type ResultadoPlantilla = { error?: string; success?: boolean; version?: number; plantilla?: PlantillaFila }

async function plantillaActiva(tipo: string): Promise<PlantillaFila | null> {
  const { data } = await getSupabase()
    .from("plantillas_documento")
    .select("id, tipo, nombre, contenido, version, activa, updated_at")
    .eq("tipo", tipo)
    .eq("activa", true)
    .maybeSingle()
  return data ? { ...data, id: String(data.id) } : null
}

function codigoTipo(categoria: string, nombre: string): string {
  const limpiar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  return `${limpiar(categoria) || "DOCUMENTO"}_${limpiar(nombre).slice(0, 40) || Date.now()}`
}

/** Crea una plantilla nueva (versión 1). */
export async function crearPlantilla(payload: { categoria: string; nombre: string; contenido: string }): Promise<ResultadoPlantilla> {
  const usuario = await autorizar("plantillas.gestionar")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }

  let tipo = codigoTipo(payload.categoria || "DOCUMENTO", payload.nombre ?? "")
  if (await plantillaActiva(tipo)) tipo = `${tipo}_${Date.now().toString().slice(-4)}`.slice(0, 60)

  const datos = plantillaSchema.safeParse({ tipo, nombre: payload.nombre, contenido: limpiarHtmlDocumento(payload.contenido ?? "") })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const { error } = await getSupabase().rpc("guardar_plantilla", {
    p_tipo: datos.data.tipo,
    p_nombre: datos.data.nombre,
    p_contenido: datos.data.contenido,
    p_usuario: usuario.id,
  })
  if (error) return { error: "No se pudo crear la plantilla." }

  revalidatePath("/administracion/plantillas")
  const plantilla = await plantillaActiva(datos.data.tipo)
  await registrarCambio({
    tabla: "plantillas_documento",
    registroId: plantilla?.id ?? datos.data.tipo,
    accion: "CREADO",
    nuevo: { nombre: datos.data.nombre, tipo: datos.data.tipo, version: 1 },
    usuarioId: usuario.id,
  })
  return plantilla ? { success: true, plantilla } : { error: "La plantilla se creó, pero no se pudo leer." }
}

/** Guarda una nueva versión de la plantilla y desactiva la anterior (función SQL guardar_plantilla). */
export async function guardarPlantilla(payload: PlantillaPayload): Promise<ResultadoPlantilla> {
  const usuario = await autorizar("plantillas.gestionar")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }

  const datos = plantillaSchema.safeParse({ ...payload, contenido: limpiarHtmlDocumento(payload.contenido ?? "") })
  if (!datos.success) return { error: datos.error.issues[0].message }
  const previa = await plantillaActiva(datos.data.tipo)

  const { data: version, error } = await getSupabase().rpc("guardar_plantilla", {
    p_tipo: datos.data.tipo,
    p_nombre: datos.data.nombre,
    p_contenido: datos.data.contenido,
    p_usuario: usuario.id,
  })
  if (error) return { error: "No se pudo guardar la plantilla." }

  revalidatePath("/administracion/plantillas")
  const plantilla = await plantillaActiva(datos.data.tipo)
  await registrarCambio({
    tabla: "plantillas_documento",
    registroId: plantilla?.id ?? datos.data.tipo,
    accion: "MODIFICADO",
    anterior: previa
      ? { nombre: previa.nombre, version: previa.version, contenido: `${previa.contenido.replace(/<[^>]*>/g, " ").trim().slice(0, 120)}…` }
      : null,
    nuevo: {
      nombre: datos.data.nombre,
      version: Number(version),
      contenido: `${datos.data.contenido.replace(/<[^>]*>/g, " ").trim().slice(0, 120)}…`,
    },
    usuarioId: usuario.id,
  })
  return { success: true, version: Number(version), ...(plantilla ? { plantilla } : {}) }
}

/** Carga las plantillas base que aún no existen. */
export async function cargarPlantillasBase() {
  const usuario = await autorizar("plantillas.gestionar")
  if (!usuario) return { error: MENSAJE_SIN_PERMISO }

  const db = getSupabase()
  const { data: existentes, error: errLeer } = await db.from("plantillas_documento").select("tipo").eq("activa", true)
  if (errLeer) return { error: "No se pudieron revisar las plantillas existentes." }

  const tipos = new Set((existentes ?? []).map((p) => p.tipo))
  const faltantes = PLANTILLAS_BASE.filter((b) => !tipos.has(b.tipo))
  if (faltantes.length > 0) {
    const { error } = await db.from("plantillas_documento").insert(
      faltantes.map((b) => ({ tipo: b.tipo, nombre: b.nombre, contenido: b.contenido, version: 1, activa: true, creado_por: usuario.id }))
    )
    if (error) return { error: "No se pudieron cargar las plantillas base." }
    await registrarCambio({
      tabla: "plantillas_documento",
      registroId: "plantillas-base",
      accion: "CREADO",
      nuevo: { nombre: `${faltantes.length} plantilla(s) base`, plantillas: faltantes.map((b) => b.nombre).join(", ") },
      usuarioId: usuario.id,
    })
  }

  revalidatePath("/administracion/plantillas")
  return { success: true }
}

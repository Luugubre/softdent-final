"use server"

import { crearClienteAuth } from "@/lib/supabase-auth"
import { requerirUsuario } from "@/lib/auth"
import { revalidatePath } from "next/cache"

type PlantillaPayload = {
  tipo: string
  nombre: string
  contenido: string
}

// Constante interna privada (no se exporta) para cumplir la regla de Server Actions
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

/**
 * Guarda o actualiza una plantilla. Si ya existe, desactiva la versión previa e inserta versión v + 1.
 */
export async function guardarPlantilla(payload: PlantillaPayload) {
  try {
    const usuario = await requerirUsuario()
    if (usuario.rol !== "ADMINISTRADOR") {
      return { error: "Solo el ADMINISTRADOR puede gestionar las plantillas." }
    }

    const supabase = await crearClienteAuth()

    // 1. Verificar si existe una versión activa para este tipo
    const { data: existente } = await supabase
      .from("plantillas_documento")
      .select("id, version")
      .eq("tipo", payload.tipo)
      .eq("activa", true)
      .maybeSingle()

    const nuevaVersion = existente ? existente.version + 1 : 1

    // 2. Desactivar la versión anterior si existía
    if (existente) {
      const { error: errDesactivar } = await supabase
        .from("plantillas_documento")
        .update({ activa: false, updated_at: new Date().toISOString() })
        .eq("id", existente.id)

      if (errDesactivar) {
        console.error("Error desactivando plantilla anterior:", errDesactivar)
        return { error: "No se pudo actualizar la versión de la plantilla." }
      }
    }

    // 3. Insertar la nueva versión activa
    const { error: errInsertar } = await supabase
      .from("plantillas_documento")
      .insert({
        tipo: payload.tipo,
        nombre: payload.nombre,
        contenido: payload.contenido,
        version: nuevaVersion,
        activa: true,
        creado_por: usuario.id,
      })

    if (errInsertar) {
      console.error("Error al guardar nueva plantilla:", errInsertar)
      return { error: "Error al guardar la plantilla en la base de datos." }
    }

    revalidatePath("/administracion/plantillas")
    return { success: true, version: nuevaVersion }
  } catch (e: unknown) {
    console.error("Error en guardarPlantilla:", e)
    const msg = e instanceof Error ? e.message : "Error inesperado"
    return { error: msg }
  }
}

/**
 * Carga las 6 plantillas base iniciales si la tabla se encuentra vacía
 */
export async function cargarPlantillasBase() {
  try {
    const usuario = await requerirUsuario()
    if (usuario.rol !== "ADMINISTRADOR") {
      return { error: "Solo el ADMINISTRADOR puede inicializar las plantillas." }
    }

    const supabase = await crearClienteAuth()

    for (const base of PLANTILLAS_BASE) {
      const { data: existe } = await supabase
        .from("plantillas_documento")
        .select("id")
        .eq("tipo", base.tipo)
        .eq("activa", true)
        .maybeSingle()

      if (!existe) {
        await supabase.from("plantillas_documento").insert({
          tipo: base.tipo,
          nombre: base.nombre,
          contenido: base.contenido,
          version: 1,
          activa: true,
          creado_por: usuario.id,
        })
      }
    }

    revalidatePath("/administracion/plantillas")
    return { success: true }
  } catch (e: unknown) {
    console.error("Error cargando plantillas base:", e)
    const msg = e instanceof Error ? e.message : "Error inesperado"
    return { error: msg }
  }
}
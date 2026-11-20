"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { VARIABLES_DISPONIBLES, procesarPlantilla } from "@/lib/plantillas"
import { EditorTextoEnriquecido } from "@/components/plantillas/EditorTextoEnriquecido"
import { guardarPlantilla, crearPlantilla, cargarPlantillasBase } from "./actions"

export type PlantillaBD = {
  id: string
  tipo: string
  nombre: string
  contenido: string
  version: number
  activa: boolean
  updated_at: string
}

type Props = {
  plantillas: PlantillaBD[]
  esAdmin: boolean
}

const CATEGORIAS_DOCUMENTO = [
  {
    valor: "CONSENTIMIENTO",
    etiqueta: "Consentimiento Informado",
    borrador: `<h2>CONSENTIMIENTO INFORMADO</h2><p>En <b>{{clinica.nombre}}</b>, a <b>{{fecha}}</b>, el/la paciente <b>{{paciente.nombre}}</b>, RUT <b>{{paciente.rut}}</b>, de {{paciente.edad}} años, declara haber sido informado/a por Dr(a). <b>{{profesional.nombre}}</b> (Reg. {{profesional.registro}}) sobre el procedimiento: <u>{{prestaciones}}</u>.</p><p><b>INFORMACIÓN Y DECLARACIÓN:</b></p><ol><li>Comprendo la naturaleza del procedimiento, sus beneficios y posibles riesgos.</li><li>He tenido la oportunidad de realizar preguntas y aclarar mis dudas.</li></ol><p><br></p><p>Firma del Paciente: _______________________</p><p>RUT: {{paciente.rut}}</p>`,
  },
  {
    valor: "CERTIFICADO",
    etiqueta: "Certificado de Atención / Reposo",
    borrador: `<h2>CERTIFICADO DE ATENCIÓN ODONTOLÓGICA</h2><p><b>Fecha:</b> {{fecha}}</p><p>El/la profesional que suscribe, <b>Dr(a). {{profesional.nombre}}</b>, Cirujano Dentista (Reg. N° {{profesional.registro}}) de <b>{{clinica.nombre}}</b>, certifica que el/la paciente <b>{{paciente.nombre}}</b>, RUT <b>{{paciente.rut}}</b>, asistió a atención odontológica en esta clínica.</p><p><b>Observaciones / Indicaciones:</b></p><ul><li>Se sugiere reposo relativo por ______ horas.</li></ul><p>Se extiende el presente certificado a petición del interesado/a para los fines que estime conveniente.</p><p><br></p><p><b>Dr(a). {{profesional.nombre}}</b><br>Reg. {{profesional.registro}} · {{clinica.nombre}}</p>`,
  },
  {
    valor: "INDICACIONES",
    etiqueta: "Indicaciones Post-Operatorias",
    borrador: `<h2>INDICACIONES POST-OPERATORIAS</h2><p><b>Paciente:</b> {{paciente.nombre}} (RUT: {{paciente.rut}}) · <b>Fecha:</b> {{fecha}}</p><p><b>CUIDADOS POSTERIORES AL PROCEDIMIENTO ({{prestaciones}}):</b></p><ol><li>Mantener gasa estéril mordida firmemente durante <b>30 minutos</b>.</li><li>Aplicar frío local intermitente durante las primeras 6 horas.</li><li><u>No escupir, no enjuagarse vigorosamente y no fumar</u> durante las próximas 24 horas.</li><li>Consumir alimentos blandos y tibios o fríos.</li><li>Seguir la medicación indicada en su receta médica.</li></ol><p>Ante cualquier duda comunicarse con <b>{{clinica.nombre}}</b>.</p>`,
  },
  {
    valor: "DERIVACION",
    etiqueta: "Derivación / Interconsulta",
    borrador: `<h2>ORDEN DE DERIVACIÓN / INTERCONSULTA</h2><p><b>Fecha:</b> {{fecha}} · <b>Clínica Origen:</b> {{clinica.nombre}}</p><p><b>Paciente:</b> {{paciente.nombre}} | <b>RUT:</b> {{paciente.rut}} | <b>Edad:</b> {{paciente.edad}} años</p><p>Estimado/a Colega:</p><p>Derivo a usted al/la paciente individualizado/a para evaluación y manejo especializado respecto a: <b>{{prestaciones}}</b>.</p><p><br></p><p>Atentamente,<br><b>Dr(a). {{profesional.nombre}}</b><br>Cirujano Dentista · Reg. {{profesional.registro}}</p>`,
  },
  {
    valor: "DOCUMENTO",
    etiqueta: "Otro Documento Clínico",
    borrador: `<h2>DOCUMENTO CLÍNICO</h2><p><b>Fecha:</b> {{fecha}}</p><p><b>Paciente:</b> {{paciente.nombre}} (RUT: {{paciente.rut}}, {{paciente.edad}} años)</p><p><b>Profesional:</b> Dr(a). {{profesional.nombre}} (Reg. {{profesional.registro}}) · {{clinica.nombre}}</p><p><br></p><p>Detalle:</p>`,
  },
]

function prepararHTMLPrevisualizacion(htmlProcesado: string): string {
  const tieneTagsHTML = /<\/?(p|div|br|b|strong|i|em|u|ul|ol|li|h[1-4]|span)\b/i.test(htmlProcesado)
  if (tieneTagsHTML) return htmlProcesado
  return htmlProcesado.replace(/\n/g, "<br />")
}

export default function GestionPlantillasClient({ plantillas, esAdmin }: Props) {
  const router = useRouter()
  const [listaPlantillas, setListaPlantillas] = useState<PlantillaBD[]>(plantillas)
  const [modoNuevo, setModoNuevo] = useState(false)
  const [categoriaNueva, setCategoriaNueva] = useState(CATEGORIAS_DOCUMENTO[0].valor)

  const [plantillaSel, setPlantillaSel] = useState<PlantillaBD | null>(plantillas[0] ?? null)
  const [nombre, setNombre] = useState(plantillas[0]?.nombre ?? "")
  const [contenido, setContenido] = useState(plantillas[0]?.contenido ?? "")
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null)

  const insertarEnCursorRef = useRef<((texto: string) => void) | null>(null)

  const registrarInsertar = useCallback((fn: (texto: string) => void) => {
    insertarEnCursorRef.current = fn
  }, [])

  const datosPrueba = {
    paciente: { nombre: "Alexis Romero Soto", rut: "20.793.934-K", edad: 28 },
    profesional: { nombre: "Dra. Dentista Ejemplo", registro: "32323" },
    clinica: { nombre: "Clínica Odontológica SoftDent" },
    fecha: new Date().toLocaleDateString("es-CL"),
    prestaciones: "Exodoncia pieza 1.8 e Implante en pieza 3.6",
  }

  const seleccionarPlantilla = (p: PlantillaBD) => {
    setModoNuevo(false)
    setPlantillaSel(p)
    setNombre(p.nombre)
    setContenido(p.contenido)
    setMensaje(null)
  }

  const iniciarNuevaPlantilla = () => {
    const cat = CATEGORIAS_DOCUMENTO[0]
    setModoNuevo(true)
    setPlantillaSel(null)
    setCategoriaNueva(cat.valor)
    setNombre("")
    setContenido(cat.borrador)
    setMensaje(null)
  }

  const handleCambioCategoria = (valorCat: string) => {
    setCategoriaNueva(valorCat)
    const encontrada = CATEGORIAS_DOCUMENTO.find((c) => c.valor === valorCat)
    if (encontrada) {
      setContenido(encontrada.borrador)
    }
  }

  const insertarVariable = (variableClave: string) => {
    if (insertarEnCursorRef.current) {
      insertarEnCursorRef.current(variableClave)
    } else {
      setContenido((prev) => prev + " " + variableClave)
    }
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!esAdmin) {
      setMensaje({ tipo: "error", texto: "Solo el ADMINISTRADOR puede modificar las plantillas." })
      return
    }

    setCargando(true)
    setMensaje(null)

    if (modoNuevo) {
      const res = await crearPlantilla({
        categoria: categoriaNueva,
        nombre,
        contenido,
      })

      setCargando(false)

      if (res.error) {
        setMensaje({ tipo: "error", texto: res.error })
      } else if (res.plantilla) {
        setListaPlantillas((prev) =>
          [...prev, res.plantilla!].sort((a, b) => a.nombre.localeCompare(b.nombre))
        )
        setModoNuevo(false)
        setPlantillaSel(res.plantilla)
        setMensaje({
          tipo: "exito",
          texto: `¡Nueva plantilla "${res.plantilla.nombre}" creada con éxito (v1)!`,
        })
        router.refresh()
      }
      return
    }

    if (!plantillaSel) {
      setCargando(false)
      return
    }

    const res = await guardarPlantilla({
      tipo: plantillaSel.tipo,
      nombre,
      contenido,
    })

    setCargando(false)

    if (res.error) {
      setMensaje({ tipo: "error", texto: res.error })
    } else if (res.plantilla) {
      setListaPlantillas((prev) =>
        prev.map((item) => (item.tipo === res.plantilla!.tipo ? res.plantilla! : item))
      )
      setPlantillaSel(res.plantilla)
      setMensaje({
        tipo: "exito",
        texto: `¡Plantilla guardada con éxito! Se creó la Versión ${res.version}.`,
      })
      router.refresh()
    }
  }

  const handleInicializarBase = async () => {
    setCargando(true)
    setMensaje(null)
    const res = await cargarPlantillasBase()
    setCargando(false)

    if (res.error) {
      setMensaje({ tipo: "error", texto: res.error })
    } else {
      setMensaje({ tipo: "exito", texto: "Se han cargado las 6 plantillas base obligatorias." })
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {listaPlantillas.length === 0 && !modoNuevo && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm font-bold text-amber-900">
            No se han registrado plantillas de documentos en la base de datos.
          </p>
          {esAdmin && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleInicializarBase}
                disabled={cargando}
                className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-amber-700 shadow-md transition-all"
              >
                {cargando ? "Cargando..." : "⚡ Cargar las 6 Plantillas Base Obligatorias"}
              </button>
              <button
                type="button"
                onClick={iniciarNuevaPlantilla}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700 shadow-md transition-all"
              >
                + Crear Primera Plantilla
              </button>
            </div>
          )}
        </div>
      )}

      {mensaje && (
        <div
          className={`p-4 rounded-xl border text-xs font-bold ${
            mensaje.tipo === "exito"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Columna Izquierda: Lista de Plantillas + Botón Nueva Plantilla */}
        <div className="space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-500">
              Documentos ({listaPlantillas.length})
            </h2>
            {esAdmin && (
              <button
                type="button"
                onClick={iniciarNuevaPlantilla}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-700 shadow-2xs transition-colors"
              >
                + Nueva Plantilla
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {listaPlantillas.map((p) => {
              const activa = !modoNuevo && plantillaSel?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => seleccionarPlantilla(p)}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all ${
                    activa
                      ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold truncate">{p.nombre}</span>
                    <span className="ml-2 shrink-0 px-2 py-0.5 text-[10px] font-black rounded-full bg-blue-100 text-blue-700">
                      v{p.version}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 truncate">Tipo: {p.tipo}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Columna Central y Derecha: Editor y Previsualización */}
        {modoNuevo || plantillaSel ? (
          <div className="lg:col-span-3 space-y-6">
            <form onSubmit={handleGuardar} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    {modoNuevo ? "✨ Nueva Plantilla de Documento" : `Editando: ${plantillaSel?.nombre}`}
                  </h3>
                  <p className="text-xs font-medium text-gray-500">
                    {modoNuevo ? (
                      "Crea un nuevo consentimiento, certificado o documento clínico con formato y variables dinámicas."
                    ) : (
                      <>
                        Versión activa actual: <strong className="text-blue-600">v{plantillaSel?.version}</strong>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {modoNuevo && listaPlantillas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => seleccionarPlantilla(listaPlantillas[0])}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  )}
                  {esAdmin && (
                    <button
                      type="submit"
                      disabled={cargando}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700 shadow-md transition-all disabled:opacity-50"
                    >
                      {cargando
                        ? "Guardando..."
                        : modoNuevo
                        ? "💾 Crear Plantilla"
                        : "💾 Guardar Nueva Versión"}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modoNuevo && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Tipo / Categoría del Documento</label>
                    <select
                      value={categoriaNueva}
                      onChange={(e) => handleCambioCategoria(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      {CATEGORIAS_DOCUMENTO.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={modoNuevo ? "" : "md:col-span-2"}>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Documento *</label>
                  <input
                    type="text"
                    required
                    disabled={!esAdmin}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Certificado de Asistencia, Consentimiento Cirugía Periodontal..."
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </div>

              {esAdmin && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">
                    Insertar Variable (se inserta en la posición del cursor):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES_DISPONIBLES.map((v) => (
                      <button
                        key={v.clave}
                        type="button"
                        onClick={() => insertarVariable(v.clave)}
                        title={v.descripcion}
                        className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      >
                        {v.clave}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Editor de Texto Enriquecido tipo Word */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                  <span>📄</span> Cuerpo del Documento *
                </label>
                <EditorTextoEnriquecido
                  value={contenido}
                  onChange={setContenido}
                  disabled={!esAdmin}
                  onRegisterInsertar={registrarInsertar}
                />
              </div>
            </form>

            {/* Previsualización en Tiempo Real con formato HTML */}
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">
                👁️ Previsualización con datos de muestra
              </h4>
              <div
                className="bg-white p-6 rounded-xl border border-gray-300 font-sans text-xs leading-relaxed shadow-inner text-gray-800 [&_h2]:text-base [&_h2]:font-extrabold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1.5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1.5"
                dangerouslySetInnerHTML={{
                  __html: prepararHTMLPrevisualizacion(procesarPlantilla(contenido, datosPrueba)),
                }}
              />
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 bg-white p-10 text-center rounded-2xl border text-sm text-gray-400">
            Selecciona una plantilla del listado o presiona <strong>+ Nueva Plantilla</strong> para crear un documento.
          </div>
        )}
      </div>
    </div>
  )
}
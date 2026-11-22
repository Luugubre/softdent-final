"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { emitirDocumento } from "@/app/documentos/actions"
import { EditorTextoEnriquecido } from "@/components/plantillas/EditorTextoEnriquecido"
import { procesarPlantilla, type VariablesDocumento } from "@/lib/plantillas"
import { TIPOS_DOCUMENTO, type PlantillaDocumento, type TipoDocumento } from "@/lib/documentos-tipos"

const TITULO_BASE: Record<TipoDocumento, string> = {
  CERTIFICADO: "Certificado de atención odontológica",
  INDICACIONES: "Indicaciones post atención",
  DERIVACION: "Interconsulta / derivación",
  DOCUMENTO: "Documento clínico",
}

const BORRADOR: Record<TipoDocumento, string> = {
  CERTIFICADO:
    "<p>{{clinica.nombre}}, {{fecha}}.</p><p>El/la profesional que suscribe, <strong>Dr(a). {{profesional.nombre}}</strong>, certifica que el/la paciente <strong>{{paciente.nombre}}</strong>, RUT {{paciente.rut}}, asistió a atención odontológica en esta clínica en la fecha indicada.</p><p>Se extiende el presente certificado a petición del interesado/a para los fines que estime conveniente.</p>",
  INDICACIONES:
    "<p>Paciente: <strong>{{paciente.nombre}}</strong> · {{fecha}}</p><ul><li>No comer ni beber durante las próximas 2 horas.</li><li>Evitar alimentos muy calientes, duros o pegajosos por 24 horas.</li><li>Tomar los medicamentos indicados en la receta según horario.</li><li>Ante dolor intenso, sangrado o fiebre, comunicarse con la clínica.</li></ul>",
  DERIVACION:
    "<p>Estimado/a colega:</p><p>Derivo a <strong>{{paciente.nombre}}</strong>, RUT {{paciente.rut}}, de {{paciente.edad}} años, para evaluación y manejo por:</p><p><strong>Motivo:</strong> </p><p><strong>Antecedentes relevantes:</strong> </p><p>Agradeceré su contrarreferencia.</p><p>Atentamente,<br>Dr(a). {{profesional.nombre}}</p>",
  DOCUMENTO: "<p>{{clinica.nombre}}, {{fecha}}.</p><p>Paciente: <strong>{{paciente.nombre}}</strong>, RUT {{paciente.rut}}.</p><p></p>",
}

export function FormDocumento({
  pacienteId,
  plantillas,
  variables,
  sinFirma,
}: {
  pacienteId: string
  plantillas: PlantillaDocumento[]
  variables: VariablesDocumento
  sinFirma: boolean
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoDocumento>("CERTIFICADO")
  const [plantillaId, setPlantillaId] = useState<string>("")
  const [titulo, setTitulo] = useState(TITULO_BASE.CERTIFICADO)
  const [destinatario, setDestinatario] = useState("")
  const [contenido, setContenido] = useState(() => procesarPlantilla(BORRADOR.CERTIFICADO, variables))
  const [error, setError] = useState("")
  const [pendiente, startTransition] = useTransition()

  const delTipo = plantillas.filter((p) => p.tipo === tipo)

  function elegirTipo(t: TipoDocumento) {
    setTipo(t)
    setTitulo(TITULO_BASE[t])
    setPlantillaId("")
    setContenido(procesarPlantilla(BORRADOR[t], variables))
  }

  function elegirPlantilla(id: string) {
    setPlantillaId(id)
    const p = plantillas.find((x) => x.id === id)
    if (!p) {
      setTitulo(TITULO_BASE[tipo])
      setContenido(procesarPlantilla(BORRADOR[tipo], variables))
      return
    }
    setTitulo(p.nombre.slice(0, 150))
    setContenido(procesarPlantilla(p.contenido, variables))
  }

  function emitir(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const r = await emitirDocumento({
        pacienteId,
        tipo,
        titulo,
        contenido,
        destinatario: destinatario || undefined,
        plantillaId: plantillaId || null,
      })
      if (r.error) {
        setError(r.error)
        return
      }
      if (r.id) window.open(`/documentos/${r.id}/pdf`, "_blank", "noopener")
      router.push(`/pacientes/${pacienteId}/documentos`)
    })
  }

  const etiqueta = "block text-[10px] font-black uppercase text-gray-400 mb-1"
  const control = "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold bg-white"

  return (
    <form onSubmit={emitir} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">📑 Nuevo documento clínico</h2>
          <p className="text-xs font-medium text-gray-500">
            Una vez emitido no se puede modificar; si hay un error, anúlalo y emite uno nuevo.
          </p>
        </div>
        <Link href={`/pacientes/${pacienteId}/documentos`} className="text-xs font-bold text-gray-500 hover:text-gray-800">
          ← Volver
        </Link>
      </div>

      {sinFirma && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          Aún no guardas tu firma. El documento se emitirá sin firma visible.{" "}
          <Link href="/perfil" className="underline">
            Guardar mi firma
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="documento-tipo-de-documento" className={etiqueta}>Tipo de documento</label>
          <select id="documento-tipo-de-documento" value={tipo} onChange={(e) => elegirTipo(e.target.value as TipoDocumento)} className={control}>
            {Object.entries(TIPOS_DOCUMENTO).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="documento-plantilla" className={etiqueta}>Plantilla</label>
          <select id="documento-plantilla" value={plantillaId} onChange={(e) => elegirPlantilla(e.target.value)} className={control}>
            <option value="">{delTipo.length ? "Texto base" : "Texto base (no hay plantillas de este tipo)"}</option>
            {delTipo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className={tipo === "DERIVACION" ? "" : "md:col-span-3"}>
          <label htmlFor="documento-titulo" className={etiqueta}>Título</label>
          <input id="documento-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={150} required className={control} />
        </div>
        {tipo === "DERIVACION" && (
          <div className="md:col-span-2">
            <label htmlFor="documento-derivar-a" className={etiqueta}>Derivar a</label>
            <input id="documento-derivar-a"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              maxLength={200}
              required
              placeholder="Ej.: Dr. Juan Soto, cirujano maxilofacial · Hospital del Salvador"
              className={control}
            />
          </div>
        )}
      </div>

      <div>
        <p className={etiqueta}>Contenido</p>
        <EditorTextoEnriquecido value={contenido} onChange={setContenido} />
      </div>

      {error && <p className="text-sm font-bold text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Link
          href={`/pacientes/${pacienteId}/documentos`}
          className="rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pendiente ? "Emitiendo…" : "Emitir e imprimir"}
        </button>
      </div>
    </form>
  )
}

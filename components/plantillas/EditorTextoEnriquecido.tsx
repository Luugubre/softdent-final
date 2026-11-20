"use client"

import { useRef, useEffect } from "react"

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  onRegisterInsertar?: (fn: (texto: string) => void) => void
}

function normalizarContenidoInicial(raw: string): string {
  if (!raw) return ""
  const tieneTagsHTML = /<\/?(p|div|br|b|strong|i|em|u|ul|ol|li|h[1-4]|span)\b/i.test(raw)
  if (tieneTagsHTML) return raw
  // Convierte plantillas antiguas en texto plano a párrafos/saltos HTML limpios
  return raw
    .split("\n")
    .map((linea) => (linea.trim() === "" ? "<p><br></p>" : `<p>${linea}</p>`))
    .join("")
}

export function EditorTextoEnriquecido({
  value,
  onChange,
  disabled = false,
  onRegisterInsertar,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const ultimoHtmlInterno = useRef<string>("")

  // Sincroniza el DOM solo cuando cambia externamente (ej: al seleccionar otra plantilla)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const htmlNormalizado = normalizarContenidoInicial(value)
    if (htmlNormalizado !== ultimoHtmlInterno.current && el.innerHTML !== htmlNormalizado) {
      el.innerHTML = htmlNormalizado
      ultimoHtmlInterno.current = htmlNormalizado
    }
  }, [value])

  // Expone la función para insertar variables exactamente donde está el cursor
  useEffect(() => {
    if (!onRegisterInsertar) return
    onRegisterInsertar((variableClave: string) => {
      const el = editorRef.current
      if (!el || disabled) return
      el.focus()
      const ejecutado = document.execCommand("insertText", false, ` ${variableClave} `)
      if (!ejecutado) {
        el.innerHTML += ` ${variableClave} `
      }
      const actualizado = el.innerHTML
      ultimoHtmlInterno.current = actualizado
      onChange(actualizado)
    })
  }, [onRegisterInsertar, onChange, disabled])

  const ejecutarComando = (comando: string, valor?: string) => {
    if (disabled) return
    editorRef.current?.focus()
    document.execCommand(comando, false, valor)
    if (editorRef.current) {
      const actualizado = editorRef.current.innerHTML
      ultimoHtmlInterno.current = actualizado
      onChange(actualizado)
    }
  }

  const handleInput = () => {
    if (!editorRef.current) return
    const actualizado = editorRef.current.innerHTML
    ultimoHtmlInterno.current = actualizado
    onChange(actualizado)
  }

  return (
    <div className="rounded-xl border border-gray-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
      {/* Barra de herramientas tipo Word */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50/90 px-3 py-2 select-none">
        {/* Selector de estilo de párrafo */}
        <select
          disabled={disabled}
          defaultValue="P"
          onChange={(e) => ejecutarComando("formatBlock", e.target.value)}
          title="Estilo de texto"
          className="rounded-lg border border-transparent hover:border-gray-300 bg-transparent px-2 py-1 text-xs font-semibold text-gray-700 focus:bg-white focus:border-gray-300 focus:outline-none cursor-pointer disabled:opacity-50"
        >
          <option value="P">Normal</option>
          <option value="H2">Título</option>
          <option value="H3">Subtítulo</option>
        </select>

        <span className="h-4 w-px bg-gray-300 mx-1" />

        {/* Negrita */}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            ejecutarComando("bold")
          }}
          title="Negrita (Ctrl+B)"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black text-gray-700 hover:bg-gray-200/80 active:bg-gray-300 disabled:opacity-40"
        >
          B
        </button>

        {/* Cursiva */}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            ejecutarComando("italic")
          }}
          title="Cursiva (Ctrl+I)"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-serif italic font-bold text-gray-700 hover:bg-gray-200/80 active:bg-gray-300 disabled:opacity-40"
        >
          I
        </button>

        {/* Subrayado */}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            ejecutarComando("underline")
          }}
          title="Subrayado (Ctrl+U)"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-xs underline font-bold text-gray-700 hover:bg-gray-200/80 active:bg-gray-300 disabled:opacity-40"
        >
          U
        </button>

        <span className="h-4 w-px bg-gray-300 mx-1" />

        {/* Lista Numerada */}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            ejecutarComando("insertOrderedList")
          }}
          title="Lista numerada"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-200/80 active:bg-gray-300 disabled:opacity-40"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" />
            <path d="M4 10h2" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
          </svg>
        </button>

        {/* Lista con Viñetas */}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            ejecutarComando("insertUnorderedList")
          }}
          title="Lista con viñetas"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-200/80 active:bg-gray-300 disabled:opacity-40"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </button>

        <span className="h-4 w-px bg-gray-300 mx-1" />

        {/* Limpiar formato */}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            ejecutarComando("removeFormat")
            ejecutarComando("formatBlock", "P")
          }}
          title="Limpiar formato"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-200/80 active:bg-gray-300 disabled:opacity-40"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
            <line x1="17" y1="15" x2="21" y2="19" />
            <line x1="21" y1="15" x2="17" y2="19" />
          </svg>
        </button>
      </div>

      {/* Área editable */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        suppressContentEditableWarning
        className="min-h-[260px] max-h-[480px] overflow-y-auto p-4 text-sm text-gray-800 leading-relaxed focus:outline-none [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:my-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:my-1.5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1.5"
      />
    </div>
  )
}
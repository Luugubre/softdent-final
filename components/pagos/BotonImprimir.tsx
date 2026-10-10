"use client"

export function BotonImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700"
    >
      🖨 Imprimir
    </button>
  )
}

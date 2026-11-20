import type { Metadata } from "next"
import "./globals.css"
import { MenuLateral } from "@/components/navegacion/MenuLateral"
import { obtenerUsuarioActual } from "@/lib/auth"
import { AvisoSalaEspera } from "@/components/agenda/AvisoSalaEspera"

export const metadata: Metadata = {
  title: "SoftDent · Clínica Dental",
  description: "Sistema de gestión clínica dental",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obtenerUsuarioActual()

  return (
    <html lang="es">
      <body className="antialiased bg-gray-50 text-gray-900">
        <div className="lg:flex lg:min-h-screen">
          <MenuLateral />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        {usuario && (
          <AvisoSalaEspera esDentista={usuario.rol === "DENTISTA" || usuario.rol === "ADMINISTRADOR"} />
        )}
      </body>
    </html>
  )
}
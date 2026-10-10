import type { Metadata } from "next"
import "./globals.css"
import { BarraSuperior } from "@/components/BarraSuperior"

export const metadata: Metadata = {
  title: "SoftDent · Clínica Dental",
  description: "Sistema de gestión clínica dental",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased bg-gray-50 text-gray-900">
        <BarraSuperior />
        {children}
      </body>
    </html>
  )
}

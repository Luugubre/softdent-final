import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Cliente de Supabase que lee la SESIÓN del usuario desde las cookies.
 * Se usa solo para autenticación (iniciar/cerrar sesión y saber quién es).
 * Los datos se siguen consultando con getSupabase() de lib/supabase.ts.
 */
export async function crearClienteAuth() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Desde un Server Component no se pueden escribir cookies; el proxy las refresca.
          }
        },
      },
    }
  )
}

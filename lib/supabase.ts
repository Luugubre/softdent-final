import { createClient } from "@supabase/supabase-js"

/**
 * Cliente de Supabase para usar SOLO en el servidor
 * (Server Components y Server Actions). Usa la service role key,
 * que nunca debe llegar al navegador: no la importes en componentes "use client".
 */
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env.local"
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

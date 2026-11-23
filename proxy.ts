import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { rutaSegura } from "@/lib/rutas"

// Verifica que exista sesión; los permisos se validan en cada página y acción (lib/auth.ts).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Validación local del JWT (ES256)
  const { data } = await supabase.auth.getClaims()
  const haySesion = Boolean(data?.claims?.sub)

  const { pathname, search } = request.nextUrl
  const esLogin = pathname === "/login" || pathname.startsWith("/login/")
  // Rutas públicas: firma por token y API de agenda online (con clave propia)
  const esPublica = pathname.startsWith("/firmar/") || pathname.startsWith("/api/publico/")

  if (!haySesion && !esLogin && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    const destino = rutaSegura(pathname + search)
    url.search = destino === "/" ? "" : `?next=${encodeURIComponent(destino)}`
    return redirigir(url, response)
  }

  if (haySesion && esLogin) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return redirigir(url, response)
  }

  return response
}

// Conserva las cookies renovadas en la redirección
function redirigir(url: URL, response: NextResponse) {
  const redireccion = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie))
  return redireccion
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      // Se excluyen las precargas de enlaces
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}

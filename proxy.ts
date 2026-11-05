import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { rutaSegura } from "@/lib/rutas"

// Chequeo "optimista": solo decide si hay sesión para redirigir a /login.
// La validación real (perfil activo + permisos) se hace en cada página y server action
// con requerirPermiso() / autorizar() de lib/auth.ts.
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

  // getClaims() valida la firma del token con las llaves públicas del proyecto (ES256)
  // sin llamar al servidor de Auth en cada request, y renueva la sesión si venció.
  // getUser() hacía una llamada de red a Supabase en CADA navegación.
  const { data } = await supabase.auth.getClaims()
  const haySesion = Boolean(data?.claims?.sub)

  const { pathname, search } = request.nextUrl
  const esLogin = pathname === "/login" || pathname.startsWith("/login/")

  if (!haySesion && !esLogin) {
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

// Al redirigir se conservan las cookies que Supabase haya renovado/borrado en este request.
function redirigir(url: URL, response: NextResponse) {
  const redireccion = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie))
  return redireccion
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      // Las precargas (prefetch) de los <Link> no pasan por el proxy: la página igual valida
      // la sesión al renderizarse, y así no se revisa la sesión por cada enlace visible.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}

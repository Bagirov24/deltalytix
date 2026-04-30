import { createI18nMiddleware } from 'next-international/middleware'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest } from 'next/server'

const I18nMiddleware = createI18nMiddleware({
  locales: ['en', 'fr'],
  defaultLocale: 'en',
})

export async function middleware(request: NextRequest) {
  // 1. Run next-international middleware — handles locale redirect/rewrite.
  //    Returns a NextResponse (redirect, rewrite, or next()).
  const response = I18nMiddleware(request)

  // 2. Refresh the Supabase session token if it has expired.
  //    Cookie writes are merged into the already-created i18n response so we
  //    don't produce a second NextResponse (which would drop locale headers).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Persist updated auth cookies on the outgoing response.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() triggers a silent token refresh when the access_token is
  // expired but a valid refresh_token cookie is present.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * Run middleware on all routes EXCEPT:
     *   - /api/*          — API routes handle auth independently
     *   - /_next/static   — Next.js build assets
     *   - /_next/image    — image optimisation endpoint
     *   - /favicon.ico    — browser default request
     *   - files with an extension (*.png, *.svg, *.js, *.css …)
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.[^/]*$).*)',
  ],
}

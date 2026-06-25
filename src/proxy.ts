import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isPlatformHost, lookupVendorSlugByDomain } from '@/lib/domains'

// Renamed from `middleware` in Next.js 16 (the `middleware` file convention is
// deprecated -> `proxy`). Runs on the Node.js runtime by default.
export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()

  // Custom vendor domains: if the request arrives on a vendor's own domain,
  // serve their storefront at the root path while keeping the domain in the
  // address bar. We only remap the homepage; all other paths fall through.
  if (host && !isPlatformHost(host) && request.nextUrl.pathname === '/') {
    const slug = await lookupVendorSlugByDomain(host)
    if (slug) {
      const url = request.nextUrl.clone()
      url.pathname = `/vendors/${slug}`
      return NextResponse.rewrite(url)
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

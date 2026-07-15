import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isPlatformHost, lookupVendorSlugByDomain, BRAND_ORIGIN } from '@/lib/domains'

// Renamed from `middleware` in Next.js 16 (the `middleware` file convention is
// deprecated -> `proxy`). Runs on the Node.js runtime by default.
// Legacy / non-canonical brand hosts that should 308 (permanent) to the
// canonical apex everythinglocal.org — one host for SEO, and the interim
// .shop domain forwards its link equity to .org. GET pages only (skip /api so
// data calls on these hosts still work while DNS/clients transition).
const CANONICAL_BRAND_HOST = 'everythinglocal.org'
const REDIRECT_BRAND_HOSTS = new Set([
  'www.everythinglocal.org',
  'everythinglocal.shop',
  'www.everythinglocal.shop',
])

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()

  // Canonicalize brand hosts (SEO): permanent-redirect to the apex .org.
  if (REDIRECT_BRAND_HOSTS.has(host) && !request.nextUrl.pathname.startsWith('/api')) {
    const { pathname, search } = request.nextUrl
    return NextResponse.redirect(new URL(pathname + search, `https://${CANONICAL_BRAND_HOST}`), 308)
  }

  // A vendor's own (vanity) domain — e.g. 4kegs.com or www.4kegs.com — should
  // ONLY ever show that vendor's storefront. The homepage maps to their page;
  // navigating anywhere else hands the visitor off to the main brand site so
  // the full marketplace flow happens there, not under the vanity domain.
  if (host && !isPlatformHost(host)) {
    const slug = await lookupVendorSlugByDomain(host)
    if (slug) {
      const { pathname, search } = request.nextUrl

      if (pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = `/vendors/${slug}`
        return NextResponse.rewrite(url)
      }

      // Any other page navigation leaves the vanity domain for the brand site.
      // Skip /api so the storefront's own data/actions still work on this host;
      // Next internals (_next/*) are already excluded by the matcher below.
      if (request.method === 'GET' && !pathname.startsWith('/api')) {
        return NextResponse.redirect(new URL(pathname + search, BRAND_ORIGIN), 307)
      }
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

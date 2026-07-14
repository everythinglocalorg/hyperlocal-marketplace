// Helpers for routing custom vendor domains, used by the proxy (src/proxy.ts).

// Where to send visitors when they navigate off a vendor's vanity domain —
// browsing continues on the main brand site. www is the canonical brand host
// (the apex everythinglocal.shop 308-redirects to it).
export const BRAND_ORIGIN =
  process.env.NEXT_PUBLIC_BRAND_URL ?? "https://www.everythinglocal.shop";

// The platform's own hostnames — never treated as a vendor custom domain.
const BRAND_HOSTS = new Set([
  "everythinglocal.shop",
  "www.everythinglocal.shop",
  "every1local.com",
  "www.every1local.com",
]);

// Hosts that belong to the platform itself (not a vendor's custom domain).
// Anything else arriving as a Host header is a candidate custom domain.
export function isPlatformHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host.startsWith("127.0.0.1")) return true;
  if (host.endsWith(".vercel.app")) return true; // preview + default deploys
  if (BRAND_HOSTS.has(host)) return true;

  // The primary marketing/app domain from env, plus its www form.
  try {
    const appHost = new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ).hostname;
    if (host === appHost || host === `www.${appHost}`) return true;
  } catch {
    // ignore malformed env
  }
  return false;
}

// Resolve an incoming Host header to a vendor slug for a verified custom
// domain. Also matches when the visitor used the www. form of an apex domain
// (custom_domain is stored as the apex, e.g. "4kegs.com").
export async function lookupVendorSlugByDomain(
  host: string
): Promise<string | null> {
  const direct = await queryVendorSlug(host);
  if (direct) return direct;
  if (host.startsWith("www.")) return queryVendorSlug(host.slice(4));
  return null;
}

// Uses the public anon key + the existing "Anyone can view active vendors"
// RLS policy, so no service role needed. Returns null when there is no match.
async function queryVendorSlug(host: string): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;

  const url =
    `${base}/rest/v1/vendors?select=slug` +
    `&custom_domain=eq.${encodeURIComponent(host)}` +
    `&domain_verified=is.true&is_active=is.true&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { slug: string }[];
    return rows?.[0]?.slug ?? null;
  } catch {
    return null;
  }
}
